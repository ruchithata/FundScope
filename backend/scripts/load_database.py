import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, engine
from app.models import BudgetHead, SpendingRecord, State


INPUT_PATH = BACKEND_DIR / "data" / "processed" / "estates_cleaned.csv"


def load_data():
    print("Loading cleaned dataset...")

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

        # Load states
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

        existing_state_names = {
            state.name
            for state in existing_states
        }

        states_to_add = [
            State(name=name)
            for name in state_names
            if name not in existing_state_names
        ]

        session.add_all(states_to_add)
        session.flush()

        states = session.scalars(
            select(State)
        ).all()

        state_lookup = {
            state.name: state.id
            for state in states
        }

        print(f"States loaded: {len(states)}")

        # Load budget heads
        print("\nLoading budget heads...")

        budget_head_data = (
            df[["Budget Head", "Appendix"]]
            .drop_duplicates()
        )

        existing_budget_heads = session.scalars(
            select(BudgetHead)
        ).all()

        existing_budget_head_keys = {
            (head.name, head.appendix)
            for head in existing_budget_heads
        }

        budget_heads_to_add = []

        for row in budget_head_data.itertuples(index=False):

            key = (row[0], row[1])

            if key not in existing_budget_head_keys:
                budget_heads_to_add.append(
                    BudgetHead(
                        name=row[0],
                        appendix=row[1],
                    )
                )

        session.add_all(budget_heads_to_add)
        session.flush()

        budget_heads = session.scalars(
            select(BudgetHead)
        ).all()

        budget_head_lookup = {
            (head.name, head.appendix): head.id
            for head in budget_heads
        }

        print(f"Budget heads loaded: {len(budget_heads)}")

        # Load spending records in batches
        print("\nLoading spending records...")

        batch_size = 5000
        total_loaded = 0

        for start in range(0, len(df), batch_size):

            batch = df.iloc[start:start + batch_size]

            records = []

            for row in batch.itertuples(index=False):

                state_id = state_lookup[row[1]]

                budget_head_id = budget_head_lookup[
                    (row[2], row[0])
                ]

                records.append(
                    SpendingRecord(
                        state_id=state_id,
                        budget_head_id=budget_head_id,
                        fiscal_year=row[3],
                        account=None if pd.isna(row[4]) else row[4],
                        revised=None if pd.isna(row[5]) else row[5],
                        budget=None if pd.isna(row[6]) else row[6],
                    )
                )

            session.add_all(records)
            session.flush()

            total_loaded += len(records)

            print(
                f"Loaded {total_loaded:,} / {len(df):,} records"
            )

        session.commit()

        print(
            f"Spending records loaded: {total_loaded:,}"
        )

    print("\nDatabase loading completed successfully.")


if __name__ == "__main__":
    load_data()