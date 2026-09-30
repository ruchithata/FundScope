from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "FundScope API"
    app_version: str = "0.3.0"
    database_url: str = Field(..., alias="DATABASE_URL")
    api_prefix: str = "/api"
    cors_origins: str = Field(default="", alias="CORS_ORIGINS")
    db_pool_size: int = Field(default=5, alias="DB_POOL_SIZE", ge=1, le=50)
    db_max_overflow: int = Field(default=10, alias="DB_MAX_OVERFLOW", ge=0, le=100)


@lru_cache
def get_settings() -> Settings:
    return Settings()
