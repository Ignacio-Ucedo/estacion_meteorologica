"""station user ownership

Revision ID: 202507031300
Revises: 202507031200
Create Date: 2025-07-03 13:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202507031300"
down_revision: str | None = "202507031200"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM stations")
    op.add_column(
        "stations",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_stations_user_id", "stations", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_stations_user_id", table_name="stations")
    op.drop_column("stations", "user_id")
