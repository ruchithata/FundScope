import os
os.environ.setdefault("DATABASE_URL", "sqlite://")

from fastapi.testclient import TestClient
from app.main import app

def test_openapi_metadata():
    response = TestClient(app).get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert data["info"]["title"] == "FundScope API"
    assert data["info"]["version"] == "0.3.0"

def test_health_response_shape():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
