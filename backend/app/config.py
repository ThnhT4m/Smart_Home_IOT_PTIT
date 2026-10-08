from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    tb_url: str = "http://localhost:8080"
    tb_user: str
    tb_pass: str
    cors_origins: str = "http://localhost:5500,http://127.0.0.1:5500"
    devices_file: str = "devices.json"
    rpc_timeout_ms: int = 5000
    port: int = 5000
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_timeout_ms: int = 15000

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
