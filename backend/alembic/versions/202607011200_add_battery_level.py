"""add battery_level to readings

Revision ID: 202607011200
Revises: 202606260001
Create Date: 2026-07-01 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202607011200"
down_revision: str | None = "202606260001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "readings",
        sa.Column("battery_level", sa.Float(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("readings", "battery_level")
