from datetime import datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.dependencies import get_db
from app.main import app
from app.models import BudgetHead, DataSource, SpendingRecord, State


TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session: Session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def sample_data(db_session: Session):
    source = DataSource(
        name="RBI e-STATES Database",
        publisher="Reserve Bank of India",
        source_url="https://rbi.org.in/",
        dataset_name="RBI e-STATES Database",
        retrieved_at=datetime.now(),
        methodology="Test data source.",
    )

    karnataka = State(name="Karnataka")
    kerala = State(name="Kerala")
    aggregate = State(name="All States/UT")

    revenue_head = BudgetHead(
        name="Tax Revenue",
        appendix="Appendix-1",
    )

    expenditure_head = BudgetHead(
        name="Education",
        appendix="Appendix-2",
    )

    db_session.add_all(
        [source, karnataka, kerala, aggregate, revenue_head, expenditure_head]
    )
    db_session.flush()

    records = [
        SpendingRecord(
            state_id=karnataka.id,
            budget_head_id=revenue_head.id,
            source_id=source.id,
            fiscal_year="2025-2026",
            account=Decimal("100"),
            revised=Decimal("110"),
            budget=Decimal("120"),
        ),
        SpendingRecord(
            state_id=karnataka.id,
            budget_head_id=revenue_head.id,
            source_id=source.id,
            fiscal_year="2024-2025",
            account=Decimal("80"),
            revised=Decimal("90"),
            budget=Decimal("100"),
        ),
        SpendingRecord(
            state_id=kerala.id,
            budget_head_id=expenditure_head.id,
            source_id=source.id,
            fiscal_year="2025-2026",
            account=Decimal("200"),
            revised=Decimal("220"),
            budget=Decimal("250"),
        ),
        # Deliberately large aggregate values make accidental double-counting
        # visible in the tests. This row should be included only when selected.
        SpendingRecord(
            state_id=aggregate.id,
            budget_head_id=revenue_head.id,
            source_id=source.id,
            fiscal_year="2025-2026",
            account=Decimal("999"),
            revised=Decimal("1099"),
            budget=Decimal("1199"),
        ),
    ]

    db_session.add_all(records)
    db_session.commit()

    return {
        "source": source,
        "karnataka": karnataka,
        "kerala": kerala,
        "aggregate": aggregate,
        "revenue_head": revenue_head,
        "expenditure_head": expenditure_head,
    }


def test_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_states(client: TestClient, sample_data):
    response = client.get("/api/states")

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 3
    assert [item["name"] for item in data] == [
        "All States/UT",
        "Karnataka",
        "Kerala",
    ]


def test_list_fiscal_years(client: TestClient, sample_data):
    response = client.get("/api/fiscal-years")

    assert response.status_code == 200
    assert response.json() == [
        {"fiscal_year": "2025-2026"},
        {"fiscal_year": "2024-2025"},
    ]


def test_list_budget_heads(client: TestClient, sample_data):
    response = client.get("/api/budget-heads")

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 2
    assert data[0]["appendix"] == "Appendix-1"
    assert data[1]["appendix"] == "Appendix-2"


def test_filter_budget_heads_by_appendix(
    client: TestClient,
    sample_data,
):
    response = client.get(
        "/api/budget-heads",
        params={"appendix": "Appendix-1"},
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 1
    assert data[0]["name"] == "Tax Revenue"


def test_list_spending_with_pagination(
    client: TestClient,
    sample_data,
):
    # The aggregate row is excluded from unfiltered results.
    response = client.get(
        "/api/spending",
        params={"page": 1, "page_size": 2},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 3
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert data["total_pages"] == 2
    assert len(data["items"]) == 2
    assert all(
        item["state_id"] != sample_data["aggregate"].id
        for item in data["items"]
    )


def test_filter_spending_by_state(
    client: TestClient,
    sample_data,
):
    state_id = sample_data["karnataka"].id

    response = client.get(
        "/api/spending",
        params={"state_id": state_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 2

    for item in data["items"]:
        assert item["state_id"] == state_id


def test_spending_summary(
    client: TestClient,
    sample_data,
):
    response = client.get(
        "/api/summary",
        params={"state_id": sample_data["karnataka"].id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["total_records"] == 2
    assert Decimal(data["total_account"]) == Decimal("180")
    assert Decimal(data["total_revised"]) == Decimal("200")
    assert Decimal(data["total_budget"]) == Decimal("220")


def test_unfiltered_summary_excludes_aggregate_row(
    client: TestClient,
    sample_data,
):
    response = client.get("/api/summary")

    assert response.status_code == 200
    data = response.json()
    assert data["total_records"] == 3
    assert Decimal(data["total_account"]) == Decimal("380")
    assert Decimal(data["total_revised"]) == Decimal("420")
    assert Decimal(data["total_budget"]) == Decimal("470")


def test_selected_aggregate_state_is_still_available(
    client: TestClient,
    sample_data,
):
    response = client.get(
        "/api/summary",
        params={"state_id": sample_data["aggregate"].id},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_records"] == 1
    assert Decimal(data["total_account"]) == Decimal("999")
    assert Decimal(data["total_revised"]) == Decimal("1099")
    assert Decimal(data["total_budget"]) == Decimal("1199")


def test_spending_trends(
    client: TestClient,
    sample_data,
):
    response = client.get(
        "/api/trends",
        params={"state_id": sample_data["karnataka"].id},
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["items"]) == 2

    assert data["items"][0]["fiscal_year"] == "2025-2026"
    assert Decimal(data["items"][0]["total_account"]) == Decimal("100")

    assert data["items"][1]["fiscal_year"] == "2024-2025"
    assert Decimal(data["items"][1]["total_account"]) == Decimal("80")


def test_unfiltered_trends_exclude_aggregate_row(
    client: TestClient,
    sample_data,
):
    response = client.get("/api/trends")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert Decimal(data["items"][0]["total_account"]) == Decimal("300")
    assert Decimal(data["items"][0]["total_revised"]) == Decimal("330")
    assert Decimal(data["items"][0]["total_budget"]) == Decimal("370")


def test_invalid_pagination_is_rejected(client: TestClient):
    response = client.get(
        "/api/spending",
        params={"page": 0},
    )
    assert response.status_code == 422


def test_page_size_limit_is_enforced(client: TestClient):
    response = client.get(
        "/api/spending",
        params={"page_size": 501},
    )
    assert response.status_code == 422
