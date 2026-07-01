"""add battery_level to readings

Revision ID: 202607010001
Revises: 202606260001
Create Date: 2026-07-01 00:01:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202607010001"
down_revision: str | None = "202606260001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("readings", sa.Column("battery_level", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("readings", "battery_level")
