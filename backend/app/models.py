from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class State(Base):
    __tablename__ = "states"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
    )


class BudgetHead(Base):
    __tablename__ = "budget_heads"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    appendix: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )


class SpendingRecord(Base):
    __tablename__ = "spending_records"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    state_id: Mapped[int] = mapped_column(
        ForeignKey("states.id"),
        nullable=False,
    )

    budget_head_id: Mapped[int] = mapped_column(
        ForeignKey("budget_heads.id"),
        nullable=False,
    )

    fiscal_year: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    account: Mapped[float | None] = mapped_column(
        Numeric,
        nullable=True,
    )

    revised: Mapped[float | None] = mapped_column(
        Numeric,
        nullable=True,
    )

    budget: Mapped[float | None] = mapped_column(
        Numeric,
        nullable=True,
    )
    