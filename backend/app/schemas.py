from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DataQualityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_id: int
    total_records: int
    missing_account: int
    missing_revised: int
    missing_budget: int
    duplicate_records: int
    quality_score: Decimal


class StateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class FiscalYearResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fiscal_year: str


class BudgetHeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    appendix: str


class SpendingRecordResponse(BaseModel):
    id: int
    state_id: int
    budget_head_id: int
    source_id: int
    fiscal_year: str
    account: Decimal | None
    revised: Decimal | None
    budget: Decimal | None


class SpendingListResponse(BaseModel):
    items: list[SpendingRecordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SpendingSummaryResponse(BaseModel):
    total_records: int
    total_account: Decimal
    total_revised: Decimal
    total_budget: Decimal


class SpendingTrendItem(BaseModel):
    fiscal_year: str
    total_account: Decimal
    total_revised: Decimal
    total_budget: Decimal


class SpendingTrendResponse(BaseModel):
    items: list[SpendingTrendItem]


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=500)
