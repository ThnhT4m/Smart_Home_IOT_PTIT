import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import text_mapper
from .config import settings
from .mapping import DEVICES, InvalidCommand, resolve
from .schemas import Command, CommandResult, VoiceText
from .tb_client import DeviceTimeout, TBClient, TBError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("command")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.tb = TBClient(settings.tb_url, settings.tb_user, settings.tb_pass)
    yield
    await app.state.tb.close()


app = FastAPI(title="IoT Voice Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ApiError(Exception):
    def __init__(self, status: int, message: str, error: str):
        self.status, self.message, self.error = status, message, error


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, e: ApiError):
    # Format lỗi theo voice-web/docs/integration-contract.md: frontend đọc field `message`
    return JSONResponse(
        status_code=e.status,
        content={"success": False, "message": e.message, "error": e.error},
    )


@app.post("/api/voice", response_model=CommandResult)
async def voice(body: VoiceText):
    """Web Voice gửi text tiếng Việt, backend tự phân tích bằng Gemini rồi thực thi."""
    log.info("voice text=%r", body.text)
    try:
        parsed = await asyncio.to_thread(text_mapper.classify_command, body.text)
    except text_mapper.MapperError as e:
        log.error("Phân tích lệnh lỗi: %s", e)
        raise ApiError(502, "Không phân tích được lệnh, vui lòng thử lại.", "NLP_FAILED")
    return await command(Command(device=parsed.device, action=parsed.action, raw_text=body.text))


@app.post("/api/command", response_model=CommandResult)
async def command(cmd: Command):
    log.info("raw_text=%r command=%s/%s", cmd.raw_text, cmd.device, cmd.action)
    try:
        call = resolve(cmd.device, cmd.action)
    except InvalidCommand as e:
        log.warning("Lệnh không hợp lệ: %s", e)
        raise ApiError(400, str(e), "INVALID_COMMAND")

    log.info(
        "RPC %s -> device=%s method=%s params=%s",
        "twoway" if call.twoway else "oneway", call.device_id, call.method, call.params,
    )
    try:
        resp = await app.state.tb.send_rpc(
            call.device_id, call.method, call.params,
            twoway=call.twoway, timeout_ms=settings.rpc_timeout_ms,
        )
    except DeviceTimeout as e:
        log.error("Timeout: %s", e)
        raise ApiError(504, f"Thiết bị '{cmd.device}' không phản hồi (có thể đang offline).", "DEVICE_OFFLINE")
    except TBError as e:
        log.error("ThingsBoard lỗi: %s", e)
        raise ApiError(502, "Lỗi ThingsBoard, vui lòng thử lại.", "THINGSBOARD_ERROR")

    log.info("OK device_response=%s", resp)
    return CommandResult(success=True, command=cmd, device_response=resp)


@app.get("/api/devices")
async def devices():
    return {name: list(d["actions"]) for name, d in DEVICES.items()}


@app.get("/health")
async def health():
    try:
        await app.state.tb.check()
        tb = "ok"
    except (TBError, DeviceTimeout) as e:
        tb = f"error: {e}"
    return {"backend": "ok", "thingsboard": tb}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
