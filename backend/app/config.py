from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://localhost/tradeos"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # AI
    ai_provider: str = "anthropic"
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Cloudflare R2
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "tradeos-media"
    r2_public_url: str = ""

    # App
    environment: str = "development"
    secret_key: str = "change-me"

    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings():
    return Settings()
