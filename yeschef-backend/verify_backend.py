import requests
import time
import sys

def check_health():
    url = "http://localhost:8000/health"
    retries = 5
    for i in range(retries):
        try:
            response = requests.get(url)
            if response.status_code == 200:
                print("Health check passed!")
                return True
        except requests.exceptions.ConnectionError:
            print(f"Waiting for server... ({i+1}/{retries})")
            time.sleep(2)
    
    print("Health check failed!")
    return False

if __name__ == "__main__":
    if check_health():
        sys.exit(0)
    else:
        sys.exit(1)
