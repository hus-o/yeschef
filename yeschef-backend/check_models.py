import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

def list_models():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("GOOGLE_API_KEY not found in .env")
        return

    client = genai.Client(api_key=api_key)
    try:
        print("Listing available models...")
        # v1beta is often needed for newer/experimental models, though SDK usually handles it.
        # client.models.list() returns an iterator
        for m in client.models.list():
            # Check if it supports generateContent or similar
            print(f"- {m.name} (DisplayName: {m.display_name})")
            
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    list_models()
