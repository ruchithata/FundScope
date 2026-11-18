from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class State(Base):
    __tablename__ = "states"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class BudgetHead(Base):
    __tablename__ = "budget_heads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    appendix: Mapped[str] = mapped_column(String(50), nullable=False)


class DataSource(Base):
    __tablename__ = "data_sources"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    publisher: Mapped[str] = mapped_column(String(200), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    dataset_name: Mapped[str] = mapped_column(String(300), nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    methodology: Mapped[str | None] = mapped_column(Text, nullable=True)


class SpendingRecord(Base):
    __tablename__ = "spending_records"
    __table_args__ = (
        Index("ix_spending_records_record_key", "record_key", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state_id: Mapped[int] = mapped_column(ForeignKey("states.id"), nullable=False)
    budget_head_id: Mapped[int] = mapped_column(
        ForeignKey("budget_heads.id"), nullable=False
    )
    source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id"), nullable=False
    )
    fiscal_year: Mapped[str] = mapped_column(String(20), nullable=False)
    record_key: Mapped[str | None] = mapped_column(String(64), nullable=True)

    account: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    revised: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    budget: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_name: Mapped[str] = mapped_column(String(300), nullable=False)
    source_file: Mapped[str] = mapped_column(String(500), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    records_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_succeeded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_rejected: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicate_records: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class DataQuality(Base):
    __tablename__ = "data_quality"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id"), nullable=False, unique=True
    )
    total_records: Mapped[int] = mapped_column(Integer, nullable=False)
    missing_account: Mapped[int] = mapped_column(Integer, nullable=False)
    missing_revised: Mapped[int] = mapped_column(Integer, nullable=False)
    missing_budget: Mapped[int] = mapped_column(Integer, nullable=False)
    duplicate_records: Mapped[int] = mapped_column(Integer, nullable=False)
    quality_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
