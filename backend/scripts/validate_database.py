import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import engine
from app.models import DataQuality, DataSource, SpendingRecord

INPUT_PATH = BACKEND_DIR / "data" / "processed" / "estates_cleaned.csv"


def calculate_quality_score(df: pd.DataFrame) -> float:
    total = len(df)
    if total == 0:
        return 0.0

    missing_total = sum(
        int(df[column].isna().sum())
        for column in ["Account", "Revised", "Budget"]
    )
    duplicate_count = int(df.duplicated().sum())

    possible_checks = total * 4
    score = 100 * (1 - (missing_total + duplicate_count) / possible_checks)

    return round(max(0.0, min(100.0, score)), 2)


def validate_database():
    print("Loading processed source dataset...")
    df = pd.read_csv(INPUT_PATH)

    expected_total = len(df)
    expected_account_missing = int(df["Account"].isna().sum())
    expected_revised_missing = int(df["Revised"].isna().sum())
    expected_budget_missing = int(df["Budget"].isna().sum())
    expected_duplicates = int(df.duplicated().sum())
    expected_score = calculate_quality_score(df)

    with Session(engine) as session:
        source = session.scalar(
            select(DataSource).order_by(DataSource.id)
        )
        if source is None:
            raise ValueError("No data source found.")

        db_total = session.scalar(
            select(func.count(SpendingRecord.id)).where(
                SpendingRecord.source_id == source.id
            )
        )

        quality = session.scalar(
            select(DataQuality).where(
                DataQuality.source_id == source.id
            )
        )
        if quality is None:
            raise ValueError("No data quality record found.")

        checks = {
            "total_records": (db_total, expected_total),
            "missing_account": (
                quality.missing_account,
                expected_account_missing,
            ),
            "missing_revised": (
                quality.missing_revised,
                expected_revised_missing,
            ),
            "missing_budget": (
                quality.missing_budget,
                expected_budget_missing,
            ),
            "duplicate_records": (
                quality.duplicate_records,
                expected_duplicates,
            ),
        }

        failed = False
        for name, (actual, expected) in checks.items():
            if actual != expected:
                print(f"FAIL: {name}: database={actual}, expected={expected}")
                failed = True
            else:
                print(f"PASS: {name}: {actual}")

        if float(quality.quality_score) != expected_score:
            print(
                f"FAIL: quality_score: database={quality.quality_score}, "
                f"expected={expected_score}"
            )
            failed = True
        else:
            print(f"PASS: quality_score: {quality.quality_score}")

        if failed:
            raise AssertionError("Database validation failed.")

    print("Database validation completed successfully.")


if __name__ == "__main__":
    validate_database()
