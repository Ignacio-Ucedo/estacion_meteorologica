"""initial schema

Revision ID: 202606260001
Revises:
Create Date: 2026-06-26 00:01:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202606260001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "stations",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("location", sa.String(length=220), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "readings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "station_id", sa.String(length=80), sa.ForeignKey("stations.id", ondelete="CASCADE")
        ),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("temperature", sa.Float(), nullable=False),
        sa.Column("humidity", sa.Float(), nullable=False),
        sa.Column("wind_speed", sa.Float(), nullable=False),
        sa.Column("wind_direction", sa.String(length=8), nullable=False),
        sa.Column("precipitation", sa.Float(), nullable=False),
    )
    op.create_index("ix_readings_station_id", "readings", ["station_id"])
    op.create_index("ix_readings_timestamp", "readings", ["timestamp"])

    # Optional TimescaleDB setup for PostgreSQL deployments:
    # SELECT create_hypertable('readings', 'timestamp', if_not_exists => TRUE);


def downgrade() -> None:
    op.drop_index("ix_readings_timestamp", table_name="readings")
    op.drop_index("ix_readings_station_id", table_name="readings")
    op.drop_table("readings")
    op.drop_table("stations")
