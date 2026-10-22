from datetime import datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import TypeDecorator, Text

from app.database import Base
from app.dependencies import get_db
from app.main import app
from app.models import BudgetHead, DataSource, SpendingRecord, State


class ExactDecimal(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return None if value is None else str(value)

    def process_result_value(self, value, dialect):
        return None if value is None else Decimal(value)

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


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
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def sample_data(db_session: Session):
    source = DataSource(
        name="RBI e-STATES Database",
        publisher="Reserve Bank of India",
        source_url="https://rbi.org.in/",
        dataset_name="RBI e-STATES Database",
        retrieved_at=datetime(2026, 1, 23),
        methodology="Fixture used only in tests.",
    )
    karnataka = State(name="Karnataka")
    kerala = State(name="Kerala")
    head1 = BudgetHead(name="Tax Revenue", appendix="Appendix-1")
    head2 = BudgetHead(name="Education", appendix="Appendix-2")
    db_session.add_all([source, karnataka, kerala, head1, head2])
    db_session.flush()
    db_session.add_all([
        SpendingRecord(state_id=karnataka.id, budget_head_id=head1.id, source_id=source.id,
                       fiscal_year="2025-2026", account=Decimal("1234567890.125"),
                       revised=Decimal("110.20"), budget=Decimal("120.30")),
        SpendingRecord(state_id=kerala.id, budget_head_id=head2.id, source_id=source.id,
                       fiscal_year="2024-2025", account=Decimal("200"),
                       revised=Decimal("220"), budget=Decimal("250")),
    ])
    db_session.commit()
    return {"karnataka": karnataka, "kerala": kerala, "head1": head1, "head2": head2}


def test_csv_export_returns_attachment_and_exact_columns(client: TestClient, sample_data):
    response = client.get("/api/spending/export.csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment;" in response.headers["content-disposition"]
    lines = response.content.decode("utf-8-sig").splitlines()
    assert lines[0] == "record_id,state_id,budget_head_id,source_id,fiscal_year,account,revised,budget"
    assert len(lines) == 3
    assert "1234567890.125" in response.text


def test_csv_export_applies_filters(client: TestClient, sample_data):
    response = client.get("/api/spending/export.csv", params={"state_id": sample_data["karnataka"].id, "appendix": "Appendix-1"})
    assert response.status_code == 200
    lines = response.content.decode("utf-8-sig").splitlines()
    assert len(lines) == 2
    assert "2025-2026" in lines[1]
    assert "2024-2025" not in response.text


def test_csv_export_rejects_invalid_filters(client: TestClient):
    response = client.get("/api/spending/export.csv", params={"state_id": 0})
    assert response.status_code == 422
