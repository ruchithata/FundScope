from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DataQualityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_id: int
    total_records: int
    missing_account: int
    missing_revised: int
    missing_budget: int
    duplicate_records: int
    quality_score: Decimal