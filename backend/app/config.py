from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_expire_minutes: int = 1440
    frontend_origin: str = "http://localhost:5173"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
