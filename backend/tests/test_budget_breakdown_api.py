from datetime import datetime
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.dependencies import get_db
from app.main import app
from app.models import BudgetHead, DataSource, SpendingRecord, State


def test_budget_breakdown_aggregates_one_year_without_aggregate_state():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = testing_session()
    source = DataSource(
        name="RBI e-STATES", publisher="Reserve Bank of India",
        source_url="https://rbi.org.in/", dataset_name="Test dataset",
        retrieved_at=datetime.now(), methodology="Test fixture",
    )
    state = State(name="Karnataka")
    aggregate = State(name="All States/UT")
    head = BudgetHead(name="Education", appendix="Appendix-2")
    db.add_all([source, state, aggregate, head])
    db.flush()
    db.add_all([
        SpendingRecord(
            state_id=state.id, budget_head_id=head.id, source_id=source.id,
            fiscal_year="2025-2026", account=Decimal("80"),
            revised=Decimal("90"), budget=Decimal("100"),
        ),
        SpendingRecord(
            state_id=aggregate.id, budget_head_id=head.id, source_id=source.id,
            fiscal_year="2025-2026", account=Decimal("800"),
            revised=Decimal("900"), budget=Decimal("1000"),
        ),
        SpendingRecord(
            state_id=state.id, budget_head_id=head.id, source_id=source.id,
            fiscal_year="2024-2025", account=Decimal("70"),
            revised=Decimal("80"), budget=Decimal("90"),
        ),
    ])
    db.commit()

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get(
                "/api/budget-breakdown",
                params={"fiscal_year": "2025-2026"},
            )
            assert response.status_code == 200
            payload = response.json()
            assert payload["fiscal_year"] == "2025-2026"
            assert len(payload["items"]) == 1
            item = payload["items"][0]
            assert Decimal(item["total_account"]) == Decimal("80")
            assert Decimal(item["total_revised"]) == Decimal("90")
            assert Decimal(item["total_budget"]) == Decimal("100")
            assert item["utilization_percent"] == 80.0
            assert client.get("/api/budget-breakdown").status_code == 422
    finally:
        app.dependency_overrides.clear()
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
