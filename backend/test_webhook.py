import asyncio
import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_webhook():
    payload = {
        "message_id": "test_msg_1",
        "from_number": "+919876543210",
        "media_url": "http://localhost:8001/whatsapp-demo-invoice.png",
        "text": "test"
    }

    response = client.post("/api/v1/webhooks/whatsapp", json=payload)
    print(f"Status Code: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    test_webhook()
