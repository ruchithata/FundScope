"""IQR-based spending outlier analysis for FundScope."""
from collections import defaultdict
from math import isfinite

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BudgetHead, SpendingRecord, State

AGGREGATE_NAMES = {"all states/ut", "all states/uts"}
MINIMUM_GROUP_SIZE = 4
IQR_MULTIPLIER = 1.5


def _quantile(values: list[float], probability: float) -> float:
    """Linearly interpolated quantile; values must be sorted and non-empty."""
    position = (len(values) - 1) * probability
    lower = int(position)
    upper = min(lower + 1, len(values) - 1)
    fraction = position - lower
    return values[lower] + (values[upper] - values[lower]) * fraction


def get_spending_anomalies(
    db: Session,
    *,
    fiscal_year: str | None = None,
    appendix: str | None = None,
    metric: str = "budget",
) -> dict:
    """Find outliers among states within each budget-head/fiscal-year group.

    Duplicate rows for a state within the same budget-head/year are collapsed
    to that state's mean before peer quartiles are calculated. Aggregate rows
    such as "All States/UT" are excluded to avoid double counting.
    """
    columns = {
        "account": SpendingRecord.account,
        "revised": SpendingRecord.revised,
        "budget": SpendingRecord.budget,
    }
    if metric not in columns:
        raise ValueError("metric must be one of: account, revised, budget")

    statement = (
        select(
            State.name.label("state_name"),
            BudgetHead.id.label("budget_head_id"),
            BudgetHead.name.label("budget_head"),
            BudgetHead.appendix.label("appendix"),
            SpendingRecord.fiscal_year.label("fiscal_year"),
            columns[metric].label("value"),
        )
        .select_from(SpendingRecord)
        .join(State, SpendingRecord.state_id == State.id)
        .join(BudgetHead, SpendingRecord.budget_head_id == BudgetHead.id)
        .where(func.lower(func.trim(State.name)).not_in(AGGREGATE_NAMES))
    )
    if fiscal_year:
        statement = statement.where(SpendingRecord.fiscal_year == fiscal_year)
    if appendix:
        statement = statement.where(BudgetHead.appendix == appendix)

    rows = db.execute(statement).mappings().all()
    state_values: dict[tuple[str, int, str], list[float]] = defaultdict(list)
    metadata: dict[tuple[str, int, str], dict] = {}
    checked_records = 0
    skipped_missing_values = 0

    for row in rows:
        if row["value"] is None:
            skipped_missing_values += 1
            continue
        value = float(row["value"])
        if not isfinite(value):
            skipped_missing_values += 1
            continue

        key = (row["fiscal_year"], row["budget_head_id"], row["state_name"])
        state_values[key].append(value)
        metadata[key] = {
            "state_name": row["state_name"],
            "budget_head": row["budget_head"],
            "appendix": row["appendix"],
            "fiscal_year": row["fiscal_year"],
        }
        checked_records += 1

    # One point per state in each comparison group; duplicate source rows
    # do not get extra weight in the quartile calculation.
    peer_groups: dict[tuple[str, int], list[dict]] = defaultdict(list)
    for key, values in state_values.items():
        entry = dict(metadata[key])
        entry["value"] = sum(values) / len(values)
        entry["source_row_count"] = len(values)
        peer_groups[(key[0], key[1])].append(entry)

    anomalies = []
    groups_checked = 0
    groups_skipped_small = 0
    for entries in peer_groups.values():
        if len(entries) < MINIMUM_GROUP_SIZE:
            groups_skipped_small += 1
            continue

        values = sorted(entry["value"] for entry in entries)
        q1 = _quantile(values, 0.25)
        q3 = _quantile(values, 0.75)
        iqr = q3 - q1
        lower_bound = q1 - IQR_MULTIPLIER * iqr
        upper_bound = q3 + IQR_MULTIPLIER * iqr
        groups_checked += 1

        for entry in entries:
            value = entry["value"]
            if value < lower_bound:
                direction = "low"
            elif value > upper_bound:
                direction = "high"
            else:
                continue

            anomalies.append({
                "state_name": entry["state_name"],
                "budget_head": entry["budget_head"],
                "appendix": entry["appendix"],
                "fiscal_year": entry["fiscal_year"],
                "metric": metric,
                "value": value,
                "q1": q1,
                "q3": q3,
                "iqr": iqr,
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
                "sample_size": len(values),
                "direction": direction,
                "source_row_count": entry["source_row_count"],
            })

    anomalies.sort(
        key=lambda item: abs(
            item["value"] - (
                item["lower_bound"] if item["direction"] == "low"
                else item["upper_bound"]
            )
        ),
        reverse=True,
    )
    return {
        "items": anomalies,
        "checked_records": checked_records,
        "groups_checked": groups_checked,
        "groups_skipped_small": groups_skipped_small,
        "skipped_missing_values": skipped_missing_values,
        "states_compared": len({key[2] for key in state_values}),
        "minimum_group_size": MINIMUM_GROUP_SIZE,
        "method": "IQR",
    }
