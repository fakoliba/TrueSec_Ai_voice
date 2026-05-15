"""Voice appointments: store caller phone for cancel/reschedule when customer_id missing

Revision ID: 005_booking_phone
Revises: 004_ai_intake
Create Date: 2026-02-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_booking_phone"
down_revision: Union[str, None] = "004_ai_intake"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("booking_phone", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "booking_phone")
