"""Streaming CSV export endpoint for filtered spending records."""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from decimal import Decimal

from app.dependencies import get_db
from app.services.analytics import get_spending_records

router = APIRouter(prefix="/api", tags=["export"])
EXPORT_PAGE_SIZE = 500
MAX_EXPORT_RECORDS = 100_000

def _csv_value(value):
    """Serialize decimal values without converting them to float."""
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return str(value)
    return value

@router.get("/spending/export.csv")
def export_spending_csv(
    state_id: int | None = Query(default=None, ge=1),
    fiscal_year: str | None = Query(default=None, min_length=9, max_length=20),
    budget_head_id: int | None = Query(default=None, ge=1),
    appendix: str | None = Query(default=None, min_length=1, max_length=50),
    db: Session = Depends(get_db),
):
    """Export all matching records, refusing unexpectedly large exports.

    Data is read from the same SQL-backed service as the spending endpoint.
    The aggregate-row policy therefore remains consistent with the service on
    whichever branch this change is integrated with.
    """
    _, total = get_spending_records(
        db,
        state_id=state_id,
        fiscal_year=fiscal_year,
        budget_head_id=budget_head_id,
        appendix=appendix,
        page=1,
        page_size=1,
    )
    if total > MAX_EXPORT_RECORDS:
        raise HTTPException(
            status_code=413,
            detail=(
                f"This export contains {total:,} records, above the safe limit "
                f"of {MAX_EXPORT_RECORDS:,}. Narrow the filters and try again."
            ),
        )

    # The safe limit bounds memory use. The service applies stable ID ordering
    # and the same filters for each page. Compare totals to detect concurrent
    # insert/delete activity before returning a potentially partial file.
    rows = []
    page = 1
    while len(rows) < total:
        page_records, current_total = get_spending_records(
            db,
            state_id=state_id,
            fiscal_year=fiscal_year,
            budget_head_id=budget_head_id,
            appendix=appendix,
            page=page,
            page_size=EXPORT_PAGE_SIZE,
        )
        if current_total != total or not page_records:
            raise HTTPException(
                status_code=409,
                detail="The matching record set changed during export. Please retry.",
            )
        rows.extend(page_records)
        page += 1

    if len(rows) != total:
        raise HTTPException(
            status_code=409,
            detail="The matching record set changed during export. Please retry.",
        )

    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(
        [
            "record_id",
            "state_id",
            "budget_head_id",
            "source_id",
            "fiscal_year",
            "account",
            "revised",
            "budget",
        ]
    )
    for record in rows:
        values = [
            record.id,
            record.state_id,
            record.budget_head_id,
            record.source_id,
            record.fiscal_year,
            record.account,
            record.revised,
            record.budget,
        ]
        # Quote/escape through csv.writer. Prefix potentially dangerous textual
        # cells to reduce formula execution risk when opened in spreadsheet apps.
        safe_values = []
        for value in values:
            # Sanitize textual cells, but preserve numeric financial values.
            if isinstance(value, str) and value.lstrip().startswith(
                ("=", "+", "-", "@")
            ):
                value = "'" + value

            safe_values.append(_csv_value(value))

        writer.writerow(safe_values)

    content = "\ufeff" + buffer.getvalue()
    filename = "fundscope-spending.csv"
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
