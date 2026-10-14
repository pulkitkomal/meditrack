from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    MONGO_URL: str
    MONGO_DB_NAME: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    UPLOAD_DIR: str
    BACKEND_PORT: int = 8000
    FRONTEND_PORT: int = 6363
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_SECRET: str = ""
    USE_OPENAI_VISION: bool = True
    CORS_ORIGINS: str = "http://localhost:6363"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = Path(__file__).parent.parent.parent / ".env"
        env_file_encoding = "utf-8"

settings = Settings()