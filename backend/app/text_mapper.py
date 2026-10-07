"""Text -> command bằng Gemini.

Dựa trên code text mapping (voice_text_maper.py) của Giáp; Khôi chỉnh lại để khớp
contract backend (quat/den, bat/tat, unknown), đọc key từ .env và có timeout.
"""
import json
from typing import Literal

from google import genai
from google.genai import types
from pydantic import BaseModel

from .config import settings


class MapperError(Exception):
    """Gọi Gemini lỗi hoặc trả về dữ liệu không đọc được."""


class ParsedCommand(BaseModel):
    device: Literal["quat", "den", "unknown"]
    action: Literal["bat", "tat", "unknown"]


SYSTEM_PROMPT = """
You are an IoT command classifier. The user speaks Vietnamese (sometimes English).

Convert the user's command into exactly one IoT command.

Devices:
- quat  (quạt, fan)
- den   (đèn, light, LED)

Actions:
- bat   (bật, mở, turn on)
- tat   (tắt, turn off)

Return ONLY JSON with exactly these fields:

{
  "device": "quat" | "den" | "unknown",
  "action": "bat" | "tat" | "unknown"
}

If the command is not about the fan (quat) or the light (den), or you cannot tell
whether to turn it on (bat) or off (tat), use "unknown" for that field. Never guess.

Examples:

"bật quạt" -> {"device":"quat","action":"bat"}
"mở quạt lên" -> {"device":"quat","action":"bat"}
"tắt quạt đi" -> {"device":"quat","action":"tat"}
"bật đèn" -> {"device":"den","action":"bat"}
"tắt đèn giúp tôi" -> {"device":"den","action":"tat"}
"turn on the fan" -> {"device":"quat","action":"bat"}
"switch the light off" -> {"device":"den","action":"tat"}
"mở cửa" -> {"device":"unknown","action":"bat"}
"quạt" -> {"device":"quat","action":"unknown"}
"hôm nay trời đẹp quá" -> {"device":"unknown","action":"unknown"}

Do not explain your answer.
Do not use markdown.
Do not add additional fields.
"""

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise MapperError("Chưa cấu hình GEMINI_API_KEY")
        _client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(timeout=settings.gemini_timeout_ms),
        )
    return _client


def classify_command(text: str) -> ParsedCommand:
    try:
        response = _get_client().models.generate_content(
            model=settings.gemini_model,
            contents=text,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0,
                response_mime_type="application/json",
                response_schema=ParsedCommand,
            ),
        )
        return ParsedCommand.model_validate(json.loads(response.text))
    except MapperError:
        raise
    except Exception as e:
        raise MapperError(f"Gemini lỗi: {e}") from e
