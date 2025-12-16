from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str  # This is the service role key

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
