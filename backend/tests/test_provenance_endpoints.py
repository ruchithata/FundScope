from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.dependencies import get_db
from app.main import app
from app.models import DataQuality, DataSource


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.state.test_session_factory = TestingSessionLocal
    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    if hasattr(app.state, "test_session_factory"):
        del app.state.test_session_factory
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_provenance_endpoints_return_empty_lists_when_no_metadata(client):
    sources = client.get("/api/data-sources")
    quality = client.get("/api/data-quality")
    assert sources.status_code == 200
    assert sources.json() == []
    assert quality.status_code == 200
    assert quality.json() == []


def test_provenance_endpoints_return_recorded_metadata(client):
    db = app.state.test_session_factory()
    source = DataSource(
        name="RBI e-STATES",
        publisher="Reserve Bank of India",
        source_url="https://www.rbi.org.in/",
        dataset_name="State Finances: A Study of Budgets",
        retrieved_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
        methodology="Original negative values retained.",
    )
    db.add(source)
    db.flush()
    db.add(DataQuality(
        source_id=source.id,
        total_records=10,
        missing_account=1,
        missing_revised=2,
        missing_budget=0,
        duplicate_records=0,
        quality_score=Decimal("97.00"),
    ))
    db.commit()
    db.close()

    sources = client.get("/api/data-sources")
    quality = client.get("/api/data-quality")
    assert sources.status_code == 200
    assert sources.json()[0]["publisher"] == "Reserve Bank of India"
    assert sources.json()[0]["dataset_name"] == "State Finances: A Study of Budgets"
    assert sources.json()[0]["methodology"] == "Original negative values retained."
    assert quality.status_code == 200
    assert quality.json()[0]["total_records"] == 10
    assert quality.json()[0]["missing_account"] == 1
    assert quality.json()[0]["quality_score"] == "97.00"
