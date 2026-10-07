import asyncio
import logging
from typing import Any

import httpx

log = logging.getLogger("tb_client")


class TBError(Exception):
    """ThingsBoard trả lỗi hoặc không kết nối được."""


class DeviceTimeout(Exception):
    """Thiết bị không phản hồi (offline) khi gọi RPC."""


class TBClient:
    def __init__(self, base_url: str, username: str, password: str):
        self._username = username
        self._password = password
        self._token: str | None = None
        self._lock = asyncio.Lock()
        self._http = httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=15.0)

    async def close(self) -> None:
        await self._http.aclose()

    async def login(self) -> str:
        try:
            r = await self._http.post(
                "/api/auth/login",
                json={"username": self._username, "password": self._password},
            )
        except httpx.HTTPError as e:
            raise TBError(f"Không kết nối được ThingsBoard: {e}") from e
        if r.status_code != 200:
            raise TBError(f"Login ThingsBoard thất bại ({r.status_code}): {r.text}")
        self._token = r.json()["token"]
        log.info("Đã login ThingsBoard")
        return self._token

    async def _get_token(self) -> str:
        async with self._lock:
            if self._token is None:
                await self.login()
            return self._token

    async def _relogin(self, stale_token: str) -> str:
        async with self._lock:
            # request khác có thể đã login lại rồi
            if self._token == stale_token:
                await self.login()
            return self._token

    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        token = await self._get_token()
        for attempt in range(2):
            headers = {"X-Authorization": f"Bearer {token}"}
            try:
                r = await self._http.request(method, url, headers=headers, **kwargs)
            except httpx.TimeoutException as e:
                raise DeviceTimeout("Hết thời gian chờ phản hồi") from e
            except httpx.HTTPError as e:
                raise TBError(f"Không kết nối được ThingsBoard: {e}") from e
            if r.status_code == 401 and attempt == 0:
                log.info("Token hết hạn, login lại")
                token = await self._relogin(token)
                continue
            return r
        return r

    async def send_rpc(
        self,
        device_id: str,
        method: str,
        params: dict[str, Any],
        twoway: bool = False,
        timeout_ms: int = 5000,
    ) -> Any:
        kind = "twoway" if twoway else "oneway"
        body = {"method": method, "params": params, "timeout": timeout_ms}
        r = await self._request(
            "POST",
            f"/api/rpc/{kind}/{device_id}",
            json=body,
            timeout=timeout_ms / 1000 + 5,
        )
        if r.status_code in (408, 504):
            raise DeviceTimeout(f"ThingsBoard báo timeout ({r.status_code})")
        if r.status_code >= 400:
            raise TBError(f"ThingsBoard lỗi {r.status_code}: {r.text}")
        if not r.content:
            return None
        try:
            return r.json()
        except ValueError:
            return r.text

    async def check(self) -> None:
        """Dùng cho /health: đảm bảo login được và token còn hợp lệ."""
        r = await self._request("GET", "/api/auth/user")
        if r.status_code != 200:
            raise TBError(f"ThingsBoard trả {r.status_code}")
