from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import IngestionRun, SpendingRecord
from app.services import ingestion_service
from app.services.ingestion_service import REQUIRED_COLUMNS, run_ingestion


@pytest.fixture
def ingestion_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session
    Base.metadata.drop_all(bind=engine)


def write_dataset(path: Path, rows: list[dict]) -> None:
    pd.DataFrame(rows, columns=REQUIRED_COLUMNS).to_csv(path, index=False)


def valid_row(**overrides) -> dict:
    row = {
        "Appendix": "Appendix-1",
        "State/UT": "  All States / UT  ",
        "Budget Head": "  Tax   Revenue ",
        "Fiscal Year": "2025–2026",
        "Account": "100",
        "Revised": "110",
        "Budget": "120",
    }
    row.update(overrides)
    return row


def test_ingestion_normalizes_and_tracks_success(
    tmp_path, ingestion_session, monkeypatch
):
    path = tmp_path / "records.csv"
    write_dataset(path, [valid_row()])
    monkeypatch.setattr(ingestion_service, "DEFAULT_SOURCE_FILE", path)

    run = run_ingestion(ingestion_session, dataset_name="Test dataset")
    ingestion_session.commit()

    assert run.status == "completed"
    assert run.records_processed == 1
    assert run.records_succeeded == 1
    assert run.records_rejected == 0
    record = ingestion_session.scalar(select(SpendingRecord))
    assert record.fiscal_year == "2025-2026"


def test_invalid_rows_are_rejected_without_aborting_valid_rows(
    tmp_path, ingestion_session, monkeypatch
):
    path = tmp_path / "records.csv"
    write_dataset(path, [valid_row(), valid_row(**{"Fiscal Year": "not-a-year"})])
    monkeypatch.setattr(ingestion_service, "DEFAULT_SOURCE_FILE", path)

    run = run_ingestion(ingestion_session, dataset_name="Test dataset")

    assert run.records_succeeded == 1
    assert run.records_rejected == 1


def test_missing_columns_fail_and_status_is_recorded(
    tmp_path, ingestion_session, monkeypatch
):
    path = tmp_path / "records.csv"
    pd.DataFrame([{"State/UT": "Karnataka"}]).to_csv(path, index=False)
    monkeypatch.setattr(ingestion_service, "DEFAULT_SOURCE_FILE", path)

    with pytest.raises(ValueError, match="missing required columns"):
        run_ingestion(ingestion_session, dataset_name="Test dataset")

    run = ingestion_session.scalar(select(IngestionRun))
    assert run.status == "failed"
    assert run.completed_at is not None


def test_empty_dataset_completes_with_zero_records(
    tmp_path, ingestion_session, monkeypatch
):
    path = tmp_path / "records.csv"
    write_dataset(path, [])
    monkeypatch.setattr(ingestion_service, "DEFAULT_SOURCE_FILE", path)

    run = run_ingestion(ingestion_session, dataset_name="Test dataset")

    assert run.status == "completed"
    assert run.records_processed == 0


def test_repeated_ingestion_skips_duplicate_records(
    tmp_path, ingestion_session, monkeypatch
):
    path = tmp_path / "records.csv"
    write_dataset(path, [valid_row()])
    monkeypatch.setattr(ingestion_service, "DEFAULT_SOURCE_FILE", path)

    first = run_ingestion(ingestion_session, dataset_name="Test dataset")
    ingestion_session.commit()
    second = run_ingestion(ingestion_session, dataset_name="Test dataset")

    assert first.records_succeeded == 1
    assert second.records_succeeded == 0
    assert second.duplicate_records == 1
    assert ingestion_session.scalar(select(SpendingRecord.id)) is not None
