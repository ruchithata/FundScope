from math import ceil
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import get_settings
from app.dependencies import get_db
from app.models import DataQuality, DataSource
from app.schemas import (
    BudgetHeadResponse, DataQualityResponse, DataSourceResponse, FiscalYearResponse,
    SpendingListResponse, SpendingSummaryResponse, SpendingTrendItem,
    SpendingTrendResponse, StateResponse,
)
from app.services.analytics import (
    get_budget_heads, get_fiscal_years, get_spending_records, get_spending_summary,
    get_spending_trend, get_states,
)

router = APIRouter(prefix=get_settings().api_prefix, tags=["analytics"])

@router.get("/states", response_model=list[StateResponse])
def list_states(db: Session = Depends(get_db)):
    return get_states(db)

@router.get("/fiscal-years", response_model=list[FiscalYearResponse])
def list_fiscal_years(db: Session = Depends(get_db)):
    return [{"fiscal_year": year} for year in get_fiscal_years(db)]

@router.get("/budget-heads", response_model=list[BudgetHeadResponse])
def list_budget_heads(appendix: str | None = Query(default=None, min_length=1, max_length=50), db: Session = Depends(get_db)):
    return get_budget_heads(db, appendix=appendix)

@router.get("/spending", response_model=SpendingListResponse)
def list_spending(
    state_id: int | None = Query(default=None, ge=1),
    fiscal_year: str | None = Query(default=None, min_length=9, max_length=20),
    budget_head_id: int | None = Query(default=None, ge=1),
    appendix: str | None = Query(default=None, min_length=1, max_length=50),
    page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    records, total = get_spending_records(db, state_id=state_id, fiscal_year=fiscal_year, budget_head_id=budget_head_id, appendix=appendix, page=page, page_size=page_size)
    return {"items": records, "total": total, "page": page, "page_size": page_size, "total_pages": ceil(total / page_size) if total else 0}

@router.get("/summary", response_model=SpendingSummaryResponse)
def spending_summary(
    state_id: int | None = Query(default=None, ge=1),
    fiscal_year: str | None = Query(default=None, min_length=9, max_length=20),
    budget_head_id: int | None = Query(default=None, ge=1),
    appendix: str | None = Query(default=None, min_length=1, max_length=50),
    db: Session = Depends(get_db),
):
    return get_spending_summary(db, state_id=state_id, fiscal_year=fiscal_year, budget_head_id=budget_head_id, appendix=appendix)

@router.get("/trends", response_model=SpendingTrendResponse)
def spending_trends(
    state_id: int | None = Query(default=None, ge=1),
    budget_head_id: int | None = Query(default=None, ge=1),
    appendix: str | None = Query(default=None, min_length=1, max_length=50),
    db: Session = Depends(get_db),
):
    rows = get_spending_trend(db, state_id=state_id, budget_head_id=budget_head_id, appendix=appendix)
    return {"items": [SpendingTrendItem.model_validate(row) for row in rows]}

@router.get("/data-sources", response_model=list[DataSourceResponse])
def list_data_sources(db: Session = Depends(get_db)):
    """Return source metadata recorded during data ingestion."""
    return db.scalars(select(DataSource).order_by(DataSource.id.asc())).all()

@router.get("/data-quality", response_model=list[DataQualityResponse])
def list_data_quality(db: Session = Depends(get_db)):
    """Return stored quality metrics without recalculating their score."""
    return db.scalars(select(DataQuality).order_by(DataQuality.source_id.asc())).all()
