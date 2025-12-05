from supabase import create_client, Client
from config import get_settings

settings = get_settings()

# Use service role key to bypass RLS (Row Level Security) for backend operations
supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)


def get_supabase() -> Client:
    """Get Supabase client instance."""
    return supabase
