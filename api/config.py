from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str  # This is the service role key
    jwt_secret_key: str = "local-dev-secret-key"
    jwt_algorithm: str = "HS256"
    optimizer_api_url: str = "http://localhost:9001"
    cors_origins: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "allow"  # Allow extra fields for flexibility


@lru_cache()
def get_settings():
    return Settings()
