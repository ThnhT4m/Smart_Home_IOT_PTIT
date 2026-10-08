import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import settings


class InvalidCommand(Exception):
    pass


@dataclass
class RpcCall:
    device_id: str
    method: str
    params: dict[str, Any]
    twoway: bool


def load_devices(path: str = settings.devices_file) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


DEVICES = load_devices()


UNKNOWN = "unknown"


def resolve(device: str, action: str) -> RpcCall:
    if device == UNKNOWN or action == UNKNOWN:
        raise InvalidCommand("Không hiểu lệnh, vui lòng nói lại.")
    dev = DEVICES.get(device)
    if dev is None:
        raise InvalidCommand(
            f"Không có thiết bị '{device}'. Thiết bị hợp lệ: {', '.join(DEVICES)}"
        )
    act = dev["actions"].get(action)
    if act is None:
        raise InvalidCommand(
            f"Thiết bị '{device}' không hỗ trợ lệnh '{action}'. "
            f"Lệnh hợp lệ: {', '.join(dev['actions'])}"
        )
    return RpcCall(
        device_id=dev["device_id"],
        method=act["method"],
        params=act.get("params", {}),
        twoway=dev.get("rpc_type", "oneway") == "twoway",
    )
