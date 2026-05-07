from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    MONGO_URL: str
    MONGO_DB_NAME: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    UPLOAD_DIR: str
    BACKEND_PORT: int = 8000
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    class Config:
        env_file = Path(__file__).parent.parent.parent / ".env"
        env_file_encoding = "utf-8"

settings = Settings()