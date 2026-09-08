import pandas as pd

from scripts.load_database import calculate_quality_metrics


def test_quality_metrics_for_complete_unique_data():
    df = pd.DataFrame({
        "Account": [100, 200],
        "Revised": [110, 210],
        "Budget": [120, 220],
    })
    metrics = calculate_quality_metrics(df)
    assert metrics["total_records"] == 2
    assert metrics["quality_score"] == 100.0


def test_quality_metrics_detect_missing_values():
    df = pd.DataFrame({
        "Account": [100, None],
        "Revised": [110, 210],
        "Budget": [120, 220],
    })
    metrics = calculate_quality_metrics(df)
    assert metrics["missing_account"] == 1
    assert metrics["quality_score"] < 100.0


def test_quality_metrics_detect_duplicates():
    df = pd.DataFrame({
        "Account": [100, 100],
        "Revised": [110, 110],
        "Budget": [120, 120],
    })
    metrics = calculate_quality_metrics(df)
    assert metrics["duplicate_records"] == 1
    assert metrics["quality_score"] < 100.0
