import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import engine
from app.models import BudgetHead, DataQuality, DataSource, SpendingRecord, State

INPUT_PATH = BACKEND_DIR / "data" / "processed" / "estates_cleaned.csv"
SOURCE_DATASET_NAME = "RBI e-STATES Database"
BATCH_SIZE = 5000
REQUIRED_COLUMNS = [
    "Appendix",
    "State/UT",
    "Budget Head",
    "Fiscal Year",
    "Account",
    "Revised",
    "Budget",
]


def calculate_quality_metrics(df: pd.DataFrame) -> dict[str, int | float]:
    total_records = len(df)
    if total_records == 0:
        return {
            "total_records": 0,
            "missing_account": 0,
            "missing_revised": 0,
            "missing_budget": 0,
            "duplicate_records": 0,
            "quality_score": 0.0,
        }

    missing_account = int(df["Account"].isna().sum())
    missing_revised = int(df["Revised"].isna().sum())
    missing_budget = int(df["Budget"].isna().sum())
    duplicate_records = int(df.duplicated().sum())
    deductions = missing_account + missing_revised + missing_budget + duplicate_records
    quality_score = round(
        max(0.0, min(100.0, 100 * (1 - deductions / (total_records * 4)))),
        2,
    )

    return {
        "total_records": total_records,
        "missing_account": missing_account,
        "missing_revised": missing_revised,
        "missing_budget": missing_budget,
        "duplicate_records": duplicate_records,
        "quality_score": quality_score,
    }


def validate_dataset(df: pd.DataFrame) -> None:
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    if df["State/UT"].isna().any():
        raise ValueError("State/UT contains missing values.")
    if df["Budget Head"].isna().any():
        raise ValueError("Budget Head contains missing values.")
    if df["Appendix"].isna().any():
        raise ValueError("Appendix contains missing values.")
    if df["Fiscal Year"].isna().any():
        raise ValueError("Fiscal Year contains missing values.")


def get_or_create_data_source(session: Session) -> DataSource:
    source = session.scalar(
        select(DataSource).where(DataSource.dataset_name == SOURCE_DATASET_NAME)
    )
    if source is not None:
        return source

    source = DataSource(
        name="RBI e-STATES Database",
        publisher="Reserve Bank of India",
        source_url="https://rbi.org.in/",
        dataset_name=SOURCE_DATASET_NAME,
        retrieved_at=datetime.now(),
        methodology=(
            "State and UT government finance data from the Reserve Bank of India's "
            "e-STATES Database."
        ),
    )
    session.add(source)
    session.flush()
    return source


def load_states(session: Session, df: pd.DataFrame) -> dict[str, int]:
    existing = session.scalars(select(State)).all()
    lookup = {state.name: state.id for state in existing}

    for name in df["State/UT"].dropna().unique().tolist():
        if name not in lookup:
            state = State(name=name)
            session.add(state)
            session.flush()
            lookup[name] = state.id
    return lookup


def load_budget_heads(session: Session, df: pd.DataFrame) -> dict[tuple[str, str], int]:
    existing = session.scalars(select(BudgetHead)).all()
    lookup = {(head.name, head.appendix): head.id for head in existing}

    for row in df[["Budget Head", "Appendix"]].drop_duplicates().itertuples(index=False):
        key = (row[0], row[1])
        if key not in lookup:
            budget_head = BudgetHead(name=row[0], appendix=row[1])
            session.add(budget_head)
            session.flush()
            lookup[key] = budget_head.id
    return lookup


def load_spending_records(
    session: Session,
    df: pd.DataFrame,
    state_lookup: dict[str, int],
    budget_head_lookup: dict[tuple[str, str], int],
    source_id: int,
) -> int:
    # Replace the existing dataset for this source inside the same transaction.
    # This makes reruns idempotent without relying on an unverified row-grain
    # uniqueness constraint.
    session.execute(
        delete(SpendingRecord).where(SpendingRecord.source_id == source_id)
    )

    total_loaded = 0
    for start in range(0, len(df), BATCH_SIZE):
        batch = df.iloc[start : start + BATCH_SIZE]
        records = []

        for row in batch.itertuples(index=False):
            appendix, state_name, budget_head_name, fiscal_year, account, revised, budget = row
            records.append(
                SpendingRecord(
                    state_id=state_lookup[state_name],
                    budget_head_id=budget_head_lookup[(budget_head_name, appendix)],
                    source_id=source_id,
                    fiscal_year=fiscal_year,
                    account=None if pd.isna(account) else account,
                    revised=None if pd.isna(revised) else revised,
                    budget=None if pd.isna(budget) else budget,
                )
            )

        session.add_all(records)
        session.flush()
        total_loaded += len(records)
        print(f"Loaded {total_loaded:,} / {len(df):,} records")

    return total_loaded


def save_quality_metadata(
    session: Session,
    metrics: dict[str, int | float],
    source_id: int,
) -> None:
    quality = session.scalar(
        select(DataQuality).where(DataQuality.source_id == source_id)
    )

    values = {
        "total_records": metrics["total_records"],
        "missing_account": metrics["missing_account"],
        "missing_revised": metrics["missing_revised"],
        "missing_budget": metrics["missing_budget"],
        "duplicate_records": metrics["duplicate_records"],
        "quality_score": metrics["quality_score"],
    }

    if quality is None:
        session.add(DataQuality(source_id=source_id, **values))
    else:
        for key, value in values.items():
            setattr(quality, key, value)


def load_data() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {INPUT_PATH}")

    print("Loading processed source dataset...")
    df = pd.read_csv(INPUT_PATH)
    validate_dataset(df)
    metrics = calculate_quality_metrics(df)

    # Kept as a local-development convenience. Production deployments should
    # run `python -m alembic upgrade head` before this loader.
    with Session(engine) as session:
        try:
            source = get_or_create_data_source(session)
            state_lookup = load_states(session, df)
            budget_head_lookup = load_budget_heads(session, df)
            total_loaded = load_spending_records(
                session,
                df,
                state_lookup,
                budget_head_lookup,
                source.id,
            )
            save_quality_metadata(session, metrics, source.id)
            session.commit()
        except Exception:
            session.rollback()
            raise

    print("Database loading completed successfully.")
    print(f"Spending records loaded: {total_loaded:,}")
    print(f"Quality score: {metrics['quality_score']:.2f}")


if __name__ == "__main__":
    load_data()
