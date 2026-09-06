import sys
import datetime from datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, engine
from app.models import BudgetHead, SpendingRecord, State, DataSource, DataQuality


INPUT_PATH = BACKEND_DIR / "data" / "processed" / "estates_cleaned.csv"


SOURCE_DATASET_NAME = "RBI e-STATES Database"


def calculate_quality_score(df: pd.DataFrame) -> float:
    """
    Calculate a simple data quality score based on
    missing financial values and duplicate records.

    The score is a completeness indicator, not an
    accuracy guarantee.
    """

    total_records = len(df)

    if total_records == 0:
        return 0.0

    missing_account = int(
        df["Account"].isna().sum()
    )

    missing_revised = int(
        df["Revised"].isna().sum()
    )

    missing_budget = int(
        df["Budget"].isna().sum()
    )

    duplicate_records = int(
        df.duplicated().sum()
    )

    missing_values = (
        missing_account
        + missing_revised
        + missing_budget
    )

    total_quality_checks = total_records * 4

    deductions = (
        missing_values
        + duplicate_records
    )

    score = 100 * (
        1 - deductions / total_quality_checks
    )

    return round(
        max(0.0, min(100.0, score)),
        2,
    )


def get_or_create_data_source(
    session: Session,
) -> DataSource:

    source = session.scalar(
        select(DataSource).where(
            DataSource.dataset_name
            == SOURCE_DATASET_NAME
        )
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
            "State and UT government finance data "
            "from the Reserve Bank of India's "
            "e-STATES Database."
        ),
    )

    session.add(source)
    session.flush()

    return source


def load_states(
    session: Session,
    df: pd.DataFrame,
) -> dict[str, int]:

    print("\nLoading states...")

    state_names = (
        df["State/UT"]
        .dropna()
        .unique()
        .tolist()
    )

    existing_states = session.scalars(
        select(State)
    ).all()

    state_lookup = {
        state.name: state.id
        for state in existing_states
    }

    new_states = []

    for name in state_names:

        if name not in state_lookup:
            state = State(name=name)

            session.add(state)
            session.flush()

            state_lookup[name] = state.id
            new_states.append(state)

    print(
        f"States available: {len(state_lookup)}"
    )

    return state_lookup


def load_budget_heads(
    session: Session,
    df: pd.DataFrame,
) -> dict[tuple[str, str], int]:

    print("\nLoading budget heads...")

    budget_head_data = (
        df[
            [
                "Budget Head",
                "Appendix",
            ]
        ]
        .drop_duplicates()
    )

    existing_heads = session.scalars(
        select(BudgetHead)
    ).all()

    budget_head_lookup = {
        (head.name, head.appendix): head.id
        for head in existing_heads
    }

    for row in budget_head_data.itertuples(
        index=False
    ):

        name = row[0]
        appendix = row[1]

        key = (
            name,
            appendix,
        )

        if key not in budget_head_lookup:

            budget_head = BudgetHead(
                name=name,
                appendix=appendix,
            )

            session.add(budget_head)
            session.flush()

            budget_head_lookup[key] = (
                budget_head.id
            )

    print(
        "Budget heads available:",
        len(budget_head_lookup),
    )

    return budget_head_lookup


def load_spending_records(
    session: Session,
    df: pd.DataFrame,
    state_lookup: dict[str, int],
    budget_head_lookup: dict[tuple[str, str], int],
    source_id: int,
) -> int:

    print("\nLoading spending records...")

    batch_size = 5000
    total_loaded = 0

    for start in range(
        0,
        len(df),
        batch_size,
    ):

        batch = df.iloc[
            start:start + batch_size
        ]

        records = []

        for row in batch.itertuples(
            index=False
        ):

            appendix = row[0]
            state_name = row[1]
            budget_head_name = row[2]
            fiscal_year = row[3]
            account = row[4]
            revised = row[5]
            budget = row[6]

            state_id = state_lookup[
                state_name
            ]

            budget_head_id = budget_head_lookup[
                (
                    budget_head_name,
                    appendix,
                )
            ]

            record = SpendingRecord(
                state_id=state_id,
                budget_head_id=budget_head_id,
                source_id=source_id,
                fiscal_year=fiscal_year,
                account=(
                    None
                    if pd.isna(account)
                    else account
                ),
                revised=(
                    None
                    if pd.isna(revised)
                    else revised
                ),
                budget=(
                    None
                    if pd.isna(budget)
                    else budget
                ),
            )

            records.append(record)

        session.add_all(records)
        session.flush()

        total_loaded += len(records)

        print(
            f"Loaded "
            f"{total_loaded:,} / "
            f"{len(df):,} records"
        )

    return total_loaded


def save_quality_metadata(
    session: Session,
    df: pd.DataFrame,
    source_id: int,
) -> DataQuality:

    print("\nCalculating data quality...")

    total_records = len(df)

    missing_account = int(
        df["Account"].isna().sum()
    )

    missing_revised = int(
        df["Revised"].isna().sum()
    )

    missing_budget = int(
        df["Budget"].isna().sum()
    )

    duplicate_records = int(
        df.duplicated().sum()
    )

    quality_score = calculate_quality_score(
        df
    )

    existing_quality = session.scalar(
        select(DataQuality).where(
            DataQuality.source_id
            == source_id
        )
    )

    if existing_quality is None:

        quality = DataQuality(
            source_id=source_id,
            total_records=total_records,
            missing_account=missing_account,
            missing_revised=missing_revised,
            missing_budget=missing_budget,
            duplicate_records=duplicate_records,
            quality_score=quality_score,
        )

        session.add(quality)

    else:

        existing_quality.total_records = (
            total_records
        )

        existing_quality.missing_account = (
            missing_account
        )

        existing_quality.missing_revised = (
            missing_revised
        )

        existing_quality.missing_budget = (
            missing_budget
        )

        existing_quality.duplicate_records = (
            duplicate_records
        )

        existing_quality.quality_score = (
            quality_score
        )

        quality = existing_quality

    session.flush()

    print(
        f"Total records: {total_records:,}"
    )

    print(
        f"Missing Account: {missing_account:,}"
    )

    print(
        f"Missing Revised: {missing_revised:,}"
    )

    print(
        f"Missing Budget: {missing_budget:,}"
    )

    print(
        f"Duplicate records: {duplicate_records:,}"
    )

    print(
        f"Quality score: {quality_score}"
    )

    return quality


def load_data():
    print("Loading cleaned dataset...")

    if not INPUT_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {INPUT_PATH}"
        )
    
    df = pd.read_csv(INPUT_PATH)

    print(f"Loaded {len(df):,} rows.")

    required_columns = [
        "Appendix",
        "State/UT",
        "Budget Head",
        "Fiscal Year",
        "Account",
        "Revised",
        "Budget",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing required columns: {missing_columns}"
        )

    print("Column validation passed.")

    Base.metadata.create_all(bind=engine)

    with Session(engine) as session:

        try:

            source = get_or_create_data_source(
                session
            )

            print(
                f"\nData source ID: {source.id}"
            )

            state_lookup = load_states(
                session,
                df,
            )

            budget_head_lookup = (
                load_budget_heads(
                    session,
                    df,
                )
            )

            total_loaded = load_spending_records(
                session,
                df,
                state_lookup,
                budget_head_lookup,
                source.id,
            )

            save_quality_metadata(
                session,
                df,
                source.id,
            )

            session.commit()

            print(
                "\nDatabase loading completed "
                "successfully."
            )

            print(
                f"Spending records loaded: "
                f"{total_loaded:,}"
            )

        except Exception:
            session.rollback()
            raise

if __name__ == "__main__":
    load_data()