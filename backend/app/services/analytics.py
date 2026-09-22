from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BudgetHead, SpendingRecord, State


def get_states(db: Session) -> Sequence[State]:
    """Return all states and union territories in alphabetical order."""
    statement = select(State).order_by(State.name.asc())
    return db.scalars(statement).all()


def get_fiscal_years(db: Session) -> list[str]:
    """Return all available fiscal years in descending order."""
    statement = (
        select(SpendingRecord.fiscal_year)
        .distinct()
        .order_by(SpendingRecord.fiscal_year.desc())
    )
    return list(db.scalars(statement).all())


def get_budget_heads(db: Session) -> Sequence[BudgetHead]:
    """Return all budget heads ordered by appendix and name."""
    statement = select(BudgetHead).order_by(
        BudgetHead.appendix.asc(),
        BudgetHead.name.asc(),
    )
    return db.scalars(statement).all()


def build_spending_filters(
    state_id: int | None = None,
    fiscal_year: str | None = None,
    budget_head_id: int | None = None,
    appendix: str | None = None,
):
    """Build reusable SQLAlchemy filter expressions."""
    filters = []

    if state_id is not None:
        filters.append(SpendingRecord.state_id == state_id)

    if fiscal_year is not None:
        filters.append(SpendingRecord.fiscal_year == fiscal_year)

    if budget_head_id is not None:
        filters.append(SpendingRecord.budget_head_id == budget_head_id)

    if appendix is not None:
        filters.append(BudgetHead.appendix == appendix)

    return filters


def get_spending_records(
    db: Session,
    *,
    state_id: int | None = None,
    fiscal_year: str | None = None,
    budget_head_id: int | None = None,
    appendix: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[SpendingRecord], int]:
    """Return paginated spending records and the total matching count."""
    filters = build_spending_filters(
        state_id=state_id,
        fiscal_year=fiscal_year,
        budget_head_id=budget_head_id,
        appendix=appendix,
    )

    base_query = (
        select(SpendingRecord)
        .join(BudgetHead, SpendingRecord.budget_head_id == BudgetHead.id)
        .where(*filters)
    )

    count_query = (
        select(func.count())
        .select_from(SpendingRecord)
        .join(BudgetHead, SpendingRecord.budget_head_id == BudgetHead.id)
        .where(*filters)
    )

    total = db.scalar(count_query) or 0
    offset = (page - 1) * page_size

    records = list(
        db.scalars(
            base_query
            .order_by(SpendingRecord.id.asc())
            .offset(offset)
            .limit(page_size)
        ).all()
    )

    return records, total


def get_spending_summary(
    db: Session,
    *,
    state_id: int | None = None,
    fiscal_year: str | None = None,
    budget_head_id: int | None = None,
    appendix: str | None = None,
):
    """Calculate aggregate spending values directly in PostgreSQL."""
    filters = build_spending_filters(
        state_id=state_id,
        fiscal_year=fiscal_year,
        budget_head_id=budget_head_id,
        appendix=appendix,
    )

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


def get_spending_trend(
    db: Session,
    *,
    state_id: int | None = None,
    budget_head_id: int | None = None,
    appendix: str | None = None,
):
    """Aggregate spending by fiscal year."""
    filters = build_spending_filters(
        state_id=state_id,
        budget_head_id=budget_head_id,
        appendix=appendix,
    )

    statement = (
        select(
            SpendingRecord.fiscal_year,
            func.coalesce(func.sum(SpendingRecord.account), 0).label(
                "total_account"
            ),
            func.coalesce(func.sum(SpendingRecord.revised), 0).label(
                "total_revised"
            ),
            func.coalesce(func.sum(SpendingRecord.budget), 0).label(
                "total_budget"
            ),
        )
        .select_from(SpendingRecord)
        .join(BudgetHead, SpendingRecord.budget_head_id == BudgetHead.id)
        .where(*filters)
        .group_by(SpendingRecord.fiscal_year)
        .order_by(SpendingRecord.fiscal_year.desc())
    )

    return list(db.execute(statement).mappings().all())
