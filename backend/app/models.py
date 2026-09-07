from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state_id: Mapped[int] = mapped_column(ForeignKey("states.id"), nullable=False)
    budget_head_id: Mapped[int] = mapped_column(
        ForeignKey("budget_heads.id"), nullable=False
    )
    source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id"), nullable=False
    )
    fiscal_year: Mapped[str] = mapped_column(String(20), nullable=False)
    account: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    revised: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    budget: Mapped[float | None] = mapped_column(Numeric, nullable=True)


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
