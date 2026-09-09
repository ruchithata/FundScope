from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_add_data_provenance"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SOURCE_DATASET_NAME = "RBI e-STATES Database"


def upgrade() -> None:
    connection = op.get_bind()

    op.create_table(
        "data_sources",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("publisher", sa.String(length=200), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("dataset_name", sa.String(length=300), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(), nullable=False),
        sa.Column("methodology", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "data_quality",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("total_records", sa.Integer(), nullable=False),
        sa.Column("missing_account", sa.Integer(), nullable=False),
        sa.Column("missing_revised", sa.Integer(), nullable=False),
        sa.Column("missing_budget", sa.Integer(), nullable=False),
        sa.Column("duplicate_records", sa.Integer(), nullable=False),
        sa.Column("quality_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["source_id"], ["data_sources.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_id"),
    )

    op.add_column(
        "spending_records",
        sa.Column("source_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_spending_records_source_id",
        "spending_records",
        "data_sources",
        ["source_id"],
        ["id"],
    )

    connection.execute(
        sa.text(
            """
            INSERT INTO data_sources
                (name, publisher, source_url, dataset_name, retrieved_at, methodology)
            SELECT
                :name, :publisher, :source_url, :dataset_name,
                CURRENT_TIMESTAMP, :methodology
            WHERE NOT EXISTS (
                SELECT 1 FROM data_sources
                WHERE dataset_name = :dataset_name
            )
            """
        ),
        {
            "name": "RBI e-STATES Database",
            "publisher": "Reserve Bank of India",
            "source_url": "https://rbi.org.in/",
            "dataset_name": SOURCE_DATASET_NAME,
            "methodology": (
                "State and UT government finance data from the Reserve Bank "
                "of India's e-STATES Database."
            ),
        },
    )

    connection.execute(
        sa.text(
            """
            UPDATE spending_records
            SET source_id = (
                SELECT id FROM data_sources
                WHERE dataset_name = :dataset_name
                ORDER BY id LIMIT 1
            )
            WHERE source_id IS NULL
            """
        ),
        {"dataset_name": SOURCE_DATASET_NAME},
    )

    missing_count = connection.execute(
        sa.text(
            "SELECT COUNT(*) FROM spending_records WHERE source_id IS NULL"
        )
    ).scalar_one()

    if missing_count:
        raise RuntimeError(
            f"Migration could not assign provenance to {missing_count} spending records."
        )

    op.alter_column(
        "spending_records",
        "source_id",
        existing_type=sa.Integer(),
        nullable=False,
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_spending_records_source_id",
        "spending_records",
        type_="foreignkey",
    )
    op.drop_column("spending_records", "source_id")
    op.drop_table("data_quality")
    op.drop_table("data_sources")
