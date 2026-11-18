"""Add ingestion run tracking and stable spending record keys."""

import hashlib
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_add_ingestion_runs"
down_revision: str | Sequence[str] | None = "0001_add_data_provenance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BATCH_SIZE = 5000


def _record_key(row: sa.engine.Row) -> str:
    """Generate a deterministic key from a spending record."""
    values = (
        str(row.appendix),
        str(row.state_name),
        str(row.budget_head),
        str(row.fiscal_year),
        "" if row.account is None else str(row.account),
        "" if row.revised is None else str(row.revised),
        "" if row.budget is None else str(row.budget),
    )

    return hashlib.sha256("\x1f".join(values).encode("utf-8")).hexdigest()


def upgrade() -> None:
    op.add_column(
        "spending_records",
        sa.Column("record_key", sa.String(length=64), nullable=True),
    )

    connection = op.get_bind()

    select_statement = sa.text(
        """
        SELECT
            sr.id,
            sr.fiscal_year,
            sr.account,
            sr.revised,
            sr.budget,
            s.name AS state_name,
            bh.name AS budget_head,
            bh.appendix AS appendix
        FROM spending_records sr
        JOIN states s ON s.id = sr.state_id
        JOIN budget_heads bh ON bh.id = sr.budget_head_id
        ORDER BY sr.id
        """
    )

    update_statement = sa.text(
        """
        UPDATE spending_records
        SET record_key = :record_key
        WHERE id = :id
        """
    )

    # Use a normal client-side result so batch updates can run
    # safely on the same connection.
    result = connection.execute(select_statement)

    while True:
        rows = result.fetchmany(BATCH_SIZE)

        if not rows:
            break

        updates = [
            {
                "id": row.id,
                "record_key": _record_key(row),
            }
            for row in rows
        ]

        connection.execute(update_statement, updates)

    result.close()

    op.create_index(
        "ix_spending_records_record_key",
        "spending_records",
        ["record_key"],
        unique=True,
    )

    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("dataset_name", sa.String(length=300), nullable=False),
        sa.Column("source_file", sa.String(length=500), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "records_processed",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "records_succeeded",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "records_rejected",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "duplicate_records",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("ingestion_runs")

    op.drop_index(
        "ix_spending_records_record_key",
        table_name="spending_records",
    )

    op.drop_column("spending_records", "record_key")
