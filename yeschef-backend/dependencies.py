import os
from dotenv import load_dotenv
from google import genai
from postgrest import SyncPostgrestClient

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL/SUPABASE_KEY must be set in environment variables")

if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY must be set in environment variables")

class CustomSupabaseClient:
    def __init__(self, url: str, key: str):
        self.rest_url = f"{url}/rest/v1"
        self.auth_url = f"{url}/auth/v1"
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        self.postgrest = SyncPostgrestClient(self.rest_url, headers=self.headers)
        # Initialize Auth if needed, though most DB ops here are admin/anon
        # self.auth = SyncGoTrueClient(url=self.auth_url, headers=headers)
    
    def table(self, table_name: str):
        return self.postgrest.from_(table_name)

_supabase_client = CustomSupabaseClient(SUPABASE_URL, SUPABASE_KEY)
_gemini_client = genai.Client(api_key=GOOGLE_API_KEY)

def get_supabase_client() -> CustomSupabaseClient:
    return _supabase_client

def get_gemini_client() -> genai.Client:
    return _gemini_client
