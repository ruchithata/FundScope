import hashlib
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pandas as pd
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models import BudgetHead, DataSource, IngestionRun, SpendingRecord, State

REQUIRED_COLUMNS = (
    "Appendix",
    "State/UT",
    "Budget Head",
    "Fiscal Year",
    "Account",
    "Revised",
    "Budget",
)
DEFAULT_DATASET_NAME = "RBI e-STATES Database"
BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE_FILE = BACKEND_DIR / "data" / "processed" / "estates_cleaned.csv"
FISCAL_YEAR_PATTERN = re.compile(r"^\d{4}-\d{4}$")


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value).strip())


def normalize_state(value: object) -> str:
    state = normalize_text(value)
    if re.fullmatch(r"all states?\s*/\s*ut(?:s)?", state, re.IGNORECASE):
        return "All States/UT"
    return state


def normalize_fiscal_year(value: object) -> str:
    fiscal_year = normalize_text(value).replace("–", "-").replace("—", "-")
    if not FISCAL_YEAR_PATTERN.fullmatch(fiscal_year):
        raise ValueError(f"invalid fiscal year: {fiscal_year!r}")
    return fiscal_year


def parse_amount(value: object, column: str) -> Decimal | None:
    if pd.isna(value) or normalize_text(value) == "":
        return None
    try:
        amount = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"invalid {column} value: {value!r}") from exc
    if not amount.is_finite():
        raise ValueError(f"invalid {column} value: {value!r}")
    return amount


def make_record_key(
    appendix: str,
    state: str,
    budget_head: str,
    fiscal_year: str,
    account: Decimal | None,
    revised: Decimal | None,
    budget: Decimal | None,
) -> str:
    values = (
        appendix,
        state,
        budget_head,
        fiscal_year,
        "" if account is None else str(account),
        "" if revised is None else str(revised),
        "" if budget is None else str(budget),
    )
    return hashlib.sha256("\x1f".join(values).encode("utf-8")).hexdigest()


def resolve_source_file(source_file: str | None) -> Path:
    if not source_file:
        return DEFAULT_SOURCE_FILE
    requested = Path(source_file)
    if requested.is_absolute():
        resolved = requested.resolve()
    else:
        resolved = (BACKEND_DIR / requested).resolve()
    allowed_root = (BACKEND_DIR / "data").resolve()
    if allowed_root not in resolved.parents:
        raise ValueError("source_file must be inside the backend data directory")
    return resolved


def get_or_create_source(session: Session, dataset_name: str) -> DataSource:
    source = session.scalar(
        select(DataSource).where(DataSource.dataset_name == dataset_name)
    )
    if source:
        return source
    source = DataSource(
        name=dataset_name,
        publisher="Reserve Bank of India",
        source_url="https://rbi.org.in/",
        dataset_name=dataset_name,
        retrieved_at=datetime.now(),
        methodology="Structured ingestion of the cleaned RBI e-STATES dataset.",
    )
    session.add(source)
    session.flush()
    return source


def run_ingestion(
    session: Session,
    source_file: str | None = None,
    dataset_name: str = DEFAULT_DATASET_NAME,
) -> IngestionRun:
    path = resolve_source_file(source_file)
    run = IngestionRun(
        dataset_name=dataset_name,
        source_file=str(path),
        started_at=datetime.now(),
        status="running",
    )
    session.add(run)
    session.flush()

    try:
        if not path.is_file():
            raise ValueError(f"dataset not found: {path}")
        frame = pd.read_csv(path)
        missing = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
        if missing:
            raise ValueError(f"missing required columns: {missing}")
        if frame.empty:
            run.records_processed = 0
            run.records_succeeded = 0
            run.records_rejected = 0
            run.completed_at = datetime.now()
            run.status = "completed"
            return run

        source = get_or_create_source(session, dataset_name)
        state_lookup = {
            item.name: item for item in session.scalars(select(State)).all()
        }
        head_lookup = {
            (item.name, item.appendix): item
            for item in session.scalars(select(BudgetHead)).all()
        }
        seen_keys: set[str] = set()

        for values in frame.to_dict(orient="records"):
            run.records_processed += 1
            try:
                appendix = normalize_text(values["Appendix"])
                state_name = normalize_state(values["State/UT"])
                budget_head_name = normalize_text(values["Budget Head"])
                fiscal_year = normalize_fiscal_year(values["Fiscal Year"])
                if not appendix or not state_name or not budget_head_name:
                    raise ValueError("required text value is empty")
                account = parse_amount(values["Account"], "Account")
                revised = parse_amount(values["Revised"], "Revised")
                budget = parse_amount(values["Budget"], "Budget")
                key = make_record_key(
                    appendix,
                    state_name,
                    budget_head_name,
                    fiscal_year,
                    account,
                    revised,
                    budget,
                )
                if key in seen_keys or session.scalar(
                    select(SpendingRecord.id).where(SpendingRecord.record_key == key)
                ):
                    run.duplicate_records += 1
                    continue
                existing_state = state_lookup.get(state_name)
                existing_head = head_lookup.get((budget_head_name, appendix))
                if existing_state is not None and existing_head is not None:
                    existing_conditions = [
                        SpendingRecord.state_id == existing_state.id,
                        SpendingRecord.budget_head_id == existing_head.id,
                        SpendingRecord.source_id == source.id,
                        SpendingRecord.fiscal_year == fiscal_year,
                    ]
                    if account is None:
                        existing_conditions.append(SpendingRecord.account.is_(None))
                    else:
                        existing_conditions.append(SpendingRecord.account == account)
                    if revised is None:
                        existing_conditions.append(SpendingRecord.revised.is_(None))
                    else:
                        existing_conditions.append(SpendingRecord.revised == revised)
                    if budget is None:
                        existing_conditions.append(SpendingRecord.budget.is_(None))
                    else:
                        existing_conditions.append(SpendingRecord.budget == budget)
                    if session.scalar(
                        select(SpendingRecord.id).where(and_(*existing_conditions))
                    ):
                        run.duplicate_records += 1
                        continue
                seen_keys.add(key)

                state = state_lookup.get(state_name)
                if state is None:
                    state = State(name=state_name)
                    session.add(state)
                    session.flush()
                    state_lookup[state_name] = state
                head_key = (budget_head_name, appendix)
                budget_head = head_lookup.get(head_key)
                if budget_head is None:
                    budget_head = BudgetHead(name=budget_head_name, appendix=appendix)
                    session.add(budget_head)
                    session.flush()
                    head_lookup[head_key] = budget_head
                session.add(
                    SpendingRecord(
                        state_id=state.id,
                        budget_head_id=budget_head.id,
                        source_id=source.id,
                        fiscal_year=fiscal_year,
                        record_key=key,
                        account=account,
                        revised=revised,
                        budget=budget,
                    )
                )
                run.records_succeeded += 1
            except (KeyError, TypeError, ValueError):
                run.records_rejected += 1

        session.flush()
        run.completed_at = datetime.now()
        run.status = "completed"
        return run
    except (OSError, ValueError, pd.errors.ParserError) as exc:
        run.completed_at = datetime.now()
        run.status = "failed"
        run.error_message = str(exc)
        session.flush()
        raise


def latest_ingestion(session: Session) -> IngestionRun | None:
    return session.scalar(
        select(IngestionRun).order_by(IngestionRun.started_at.desc()).limit(1)
    )
