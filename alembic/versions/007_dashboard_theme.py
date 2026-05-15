"""Add dashboard_theme to business_settings."""

from alembic import op
import sqlalchemy as sa


revision = "007_dashboard_theme"
down_revision = "006_call_log_voice_providers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "business_settings",
        sa.Column(
            "dashboard_theme",
            sa.String(length=32),
            nullable=False,
            server_default="gold",
        ),
    )


def downgrade() -> None:
    op.drop_column("business_settings", "dashboard_theme")
