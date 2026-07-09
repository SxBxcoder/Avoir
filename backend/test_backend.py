import requests
import json
import time

def run_tests():
    print("=== BACKEND INTEGRATION TEST ===")
    
    # 1. Test /api/simulate
    print("\n1. Testing /api/simulate endpoint...")
    try:
        res = requests.post("http://localhost:8000/api/simulate", json={
            "budget": 5000,
            "target_roas": 4.5
        }, timeout=10)
        print(f"Status: {res.status_code}")
        print(f"Response: {json.dumps(res.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
        
    # 2. Test /api/generate
    print("\n2. Testing /api/generate endpoint...")
    try:
        res = requests.post("http://localhost:8000/api/generate", json={
            "goal": "Launch a new Gen-Z sneaker line",
            "user_id": "test_user_777"
        }, timeout=10)
        print(f"Status: {res.status_code}")
        print(f"Response: {json.dumps(res.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
        
    # 3. Test /api/engagement/stream (SSE)
    print("\n3. Testing /api/engagement/stream (SSE)...")
    try:
        response = requests.get("http://localhost:8000/api/engagement/stream", stream=True, timeout=10)
        
        event_count = 0
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith('data:'):
                    print(f"SSE Event Received:\n  {decoded_line}")
                    event_count += 1
                    if event_count >= 3:
                        break
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_tests()
