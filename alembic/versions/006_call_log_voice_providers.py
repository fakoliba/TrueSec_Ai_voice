"""Add voice_providers JSON to call_logs for STT/TTS audit."""

from alembic import op
import sqlalchemy as sa


revision = "006_call_log_voice_providers"
down_revision = "005_booking_phone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("call_logs", sa.Column("voice_providers", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("call_logs", "voice_providers")
