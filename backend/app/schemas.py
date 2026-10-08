from typing import Any

from pydantic import BaseModel, Field


class Command(BaseModel):
    device: str = Field(examples=["quat"])
    action: str = Field(examples=["bat"])
    raw_text: str | None = Field(default=None, examples=["bật quạt"])


class VoiceText(BaseModel):
    text: str = Field(examples=["bật quạt"])


class CommandResult(BaseModel):
    success: bool
    command: Command | None = None
    device_response: Any = None
