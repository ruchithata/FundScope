import pandas as pd

from scripts.validate_database import calculate_quality_score


def test_quality_score_is_100_for_complete_unique_data():
    df = pd.DataFrame({
        "Account": [100, 200],
        "Revised": [110, 210],
        "Budget": [120, 220],
    })

    assert calculate_quality_score(df) == 100.0


def test_quality_score_decreases_for_missing_values():
    df = pd.DataFrame({
        "Account": [100, None],
        "Revised": [110, 210],
        "Budget": [120, 220],
    })

    assert calculate_quality_score(df) < 100.0


def test_quality_score_handles_empty_data():
    df = pd.DataFrame({
        "Account": [],
        "Revised": [],
        "Budget": [],
    })

    assert calculate_quality_score(df) == 0.0
