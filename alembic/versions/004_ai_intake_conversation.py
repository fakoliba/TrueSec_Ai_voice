"""AI intake: default form on settings; conversation links to intake submission

Revision ID: 004_ai_intake
Revises: 003_call_conv
Create Date: 2026-02-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_ai_intake"
down_revision: Union[str, None] = "003_call_conv"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "business_settings",
        sa.Column("default_intake_form_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "business_settings",
        sa.Column("ai_intake_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_foreign_key(
        "fk_business_settings_default_intake_form_id",
        "business_settings",
        "intake_forms",
        ["default_intake_form_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_business_settings_default_intake_form_id"),
        "business_settings",
        ["default_intake_form_id"],
        unique=False,
    )

    op.add_column(
        "conversations",
        sa.Column("intake_submission_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_conversations_intake_submission_id",
        "conversations",
        "intake_submissions",
        ["intake_submission_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_conversations_intake_submission_id"),
        "conversations",
        ["intake_submission_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_conversations_intake_submission_id"), table_name="conversations")
    op.drop_constraint("fk_conversations_intake_submission_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "intake_submission_id")

    op.drop_index(op.f("ix_business_settings_default_intake_form_id"), table_name="business_settings")
    op.drop_constraint("fk_business_settings_default_intake_form_id", "business_settings", type_="foreignkey")
    op.drop_column("business_settings", "ai_intake_enabled")
    op.drop_column("business_settings", "default_intake_form_id")
