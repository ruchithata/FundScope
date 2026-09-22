from math import ceil

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas import (
    BudgetHeadResponse,
    FiscalYearResponse,
    SpendingListResponse,
    SpendingSummaryResponse,
    SpendingTrendItem,
    SpendingTrendResponse,
    StateResponse,
)
from app.services.analytics import (
    get_budget_heads,
    get_fiscal_years,
    get_spending_records,
    get_spending_summary,
    get_spending_trend,
    get_states,
)

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/states", response_model=list[StateResponse])
def list_states(db: Session = Depends(get_db)):
    """Return all states and union territories available in the dataset."""
    return get_states(db)


@router.get("/fiscal-years", response_model=list[FiscalYearResponse])
def list_fiscal_years(db: Session = Depends(get_db)):
    """Return all fiscal years available in the dataset."""
    return [{"fiscal_year": year} for year in get_fiscal_years(db)]


@router.get("/budget-heads", response_model=list[BudgetHeadResponse])
def list_budget_heads(
    appendix: str | None = Query(
        default=None,
        description="Optional appendix filter, for example Appendix-1.",
    ),
    db: Session = Depends(get_db),
):
    """Return budget heads, optionally filtered by appendix."""
    budget_heads = get_budget_heads(db)

    if appendix is not None:
        budget_heads = [
            item for item in budget_heads if item.appendix == appendix
        ]

    return budget_heads


@router.get("/spending", response_model=SpendingListResponse)
def list_spending(
    state_id: int | None = Query(default=None, ge=1),
    fiscal_year: str | None = Query(
        default=None,
        min_length=9,
        max_length=20,
    ),
    budget_head_id: int | None = Query(default=None, ge=1),
    appendix: str | None = Query(
        default=None,
        min_length=1,
        max_length=50,
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Return paginated spending records with optional filters."""
    records, total = get_spending_records(
        db,
        state_id=state_id,
        fiscal_year=fiscal_year,
        budget_head_id=budget_head_id,
        appendix=appendix,
        page=page,
        page_size=page_size,
    )

    total_pages = ceil(total / page_size) if total else 0

    return {
        "items": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/summary", response_model=SpendingSummaryResponse)
def spending_summary(
    state_id: int | None = Query(default=None, ge=1),
    fiscal_year: str | None = Query(
        default=None,
        min_length=9,
        max_length=20,
    ),
    budget_head_id: int | None = Query(default=None, ge=1),
    appendix: str | None = Query(
        default=None,
        min_length=1,
        max_length=50,
    ),
    db: Session = Depends(get_db),
):
    """Return aggregate Account, Revised, and Budget values."""
    return get_spending_summary(
        db,
        state_id=state_id,
        fiscal_year=fiscal_year,
        budget_head_id=budget_head_id,
        appendix=appendix,
    )


@router.get("/trends", response_model=SpendingTrendResponse)
def spending_trends(
    state_id: int | None = Query(default=None, ge=1),
    budget_head_id: int | None = Query(default=None, ge=1),
    appendix: str | None = Query(
        default=None,
        min_length=1,
        max_length=50,
    ),
    db: Session = Depends(get_db),
):
    """Return spending aggregates grouped by fiscal year."""
    trend_rows = get_spending_trend(
        db,
        state_id=state_id,
        budget_head_id=budget_head_id,
        appendix=appendix,
    )

    return {
        "items": [
            SpendingTrendItem.model_validate(row)
            for row in trend_rows
        ]
    }
