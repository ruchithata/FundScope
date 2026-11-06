from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BudgetHead, SpendingRecord, State

AGGREGATE_STATE_NAME = "All States/UT"


def get_states(db: Session) -> Sequence[State]:
    return db.scalars(select(State).order_by(State.name.asc())).all()


def get_fiscal_years(db: Session) -> list[str]:
    statement = select(SpendingRecord.fiscal_year).distinct().order_by(
        SpendingRecord.fiscal_year.desc()
    )
    return list(db.scalars(statement).all())


def get_budget_heads(db: Session, appendix: str | None = None) -> Sequence[BudgetHead]:
    statement = select(BudgetHead)
    if appendix is not None:
        statement = statement.where(BudgetHead.appendix == appendix)
    return db.scalars(
        statement.order_by(BudgetHead.appendix.asc(), BudgetHead.name.asc())
    ).all()


def build_spending_filters(
    state_id: int | None = None,
    fiscal_year: str | None = None,
    budget_head_id: int | None = None,
    appendix: str | None = None,
):
    """Exclude the publisher's aggregate row unless a state is explicitly selected."""
    filters = []
    if state_id is not None:
        filters.append(SpendingRecord.state_id == state_id)
    else:
        aggregate_state_ids = select(State.id).where(
            func.lower(func.trim(State.name)) == AGGREGATE_STATE_NAME.lower()
        )
        filters.append(SpendingRecord.state_id.not_in(aggregate_state_ids))
    if fiscal_year is not None:
        filters.append(SpendingRecord.fiscal_year == fiscal_year)
    if budget_head_id is not None:
        filters.append(SpendingRecord.budget_head_id == budget_head_id)
    if appendix is not None:
        filters.append(BudgetHead.appendix == appendix)
    return filters


def get_spending_records(
    db: Session, *, state_id=None, fiscal_year=None, budget_head_id=None,
    appendix=None, page=1, page_size=50,
):
    filters = build_spending_filters(state_id, fiscal_year, budget_head_id, appendix)
    base = (
        select(SpendingRecord)
        .join(BudgetHead, SpendingRecord.budget_head_id == BudgetHead.id)
        .where(*filters)
    )
    count = (
        select(func.count())
        .select_from(SpendingRecord)
        .join(BudgetHead, SpendingRecord.budget_head_id == BudgetHead.id)
        .where(*filters)
    )
    total = db.scalar(count) or 0
    records = list(
        db.scalars(
            base.order_by(SpendingRecord.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return records, total


def get_spending_summary(
    db: Session, *, state_id=None, fiscal_year=None, budget_head_id=None, appendix=None
):
    filters = build_spending_filters(state_id, fiscal_year, budget_head_id, appendix)
    statement = (
        select(
            func.count(SpendingRecord.id),
            func.coalesce(func.sum(SpendingRecord.account), 0),
            func.coalesce(func.sum(SpendingRecord.revised), 0),
            func.coalesce(func.sum(SpendingRecord.budget), 0),
        )
        .select_from(SpendingRecord)
        .join(BudgetHead, SpendingRecord.budget_head_id == BudgetHead.id)
        .where(*filters)
    )
    total_records, total_account, total_revised, total_budget = db.execute(
        statement
    ).one()
    return {
        "total_records": total_records,
        "total_account": total_account,
        "total_revised": total_revised,
        "total_budget": total_budget,
    }


def get_spending_trend(db: Session, *, state_id=None, budget_head_id=None, appendix=None):
    filters = build_spending_filters(
        state_id=state_id, budget_head_id=budget_head_id, appendix=appendix
    )
    statement = (
        select(
            SpendingRecord.fiscal_year,
            func.coalesce(func.sum(SpendingRecord.account), 0).label("total_account"),
            func.coalesce(func.sum(SpendingRecord.revised), 0).label("total_revised"),
            func.coalesce(func.sum(SpendingRecord.budget), 0).label("total_budget"),
        )
        .select_from(SpendingRecord)
        .join(BudgetHead, SpendingRecord.budget_head_id == BudgetHead.id)
        .where(*filters)
        .group_by(SpendingRecord.fiscal_year)
        .order_by(SpendingRecord.fiscal_year.desc())
    )
    return list(db.execute(statement).mappings().all())


def get_budget_breakdown(
    db: Session, *, fiscal_year: str, state_id: int | None = None,
    appendix: str | None = None,
):
    """Aggregate one fiscal year's financial values by budget head."""
    filters = build_spending_filters(
        state_id=state_id, fiscal_year=fiscal_year, appendix=appendix
    )
    statement = (
        select(
            BudgetHead.id.label("budget_head_id"),
            BudgetHead.name.label("budget_head"),
            BudgetHead.appendix.label("appendix"),
            func.count(SpendingRecord.id).label("record_count"),
            func.coalesce(func.sum(SpendingRecord.account), 0).label("total_account"),
            func.coalesce(func.sum(SpendingRecord.revised), 0).label("total_revised"),
            func.coalesce(func.sum(SpendingRecord.budget), 0).label("total_budget"),
        )
        .select_from(SpendingRecord)
        .join(BudgetHead, SpendingRecord.budget_head_id == BudgetHead.id)
        .where(*filters)
        .group_by(BudgetHead.id, BudgetHead.name, BudgetHead.appendix)
        .order_by(func.sum(SpendingRecord.budget).desc(), BudgetHead.name.asc())
    )
    rows = db.execute(statement).mappings().all()
    return [
        {
            **dict(row),
            "utilization_percent": (
                round(float(row["total_account"]) / float(row["total_budget"]) * 100, 2)
                if row["total_budget"] is not None and float(row["total_budget"]) > 0
                else None
            ),
        }
        for row in rows
    ]
