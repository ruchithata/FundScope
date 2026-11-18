from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas import IngestionRunRequest, IngestionRunResponse
from app.services.ingestion_service import latest_ingestion, run_ingestion

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])


@router.post(
    "/run", response_model=IngestionRunResponse, status_code=status.HTTP_201_CREATED
)
def trigger_ingestion(
    request: IngestionRunRequest | None = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> IngestionRunResponse:
    request = request or IngestionRunRequest()
    try:
        run = run_ingestion(db, request.source_file, request.dataset_name)
        db.commit()
        db.refresh(run)
        return run
    except ValueError as exc:
        failed_run = latest_ingestion(db)
        if failed_run is not None and failed_run.status == "failed":
            db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/status", response_model=IngestionRunResponse | None)
def ingestion_status(db: Session = Depends(get_db)) -> IngestionRunResponse | None:  # noqa: B008
    return latest_ingestion(db)
