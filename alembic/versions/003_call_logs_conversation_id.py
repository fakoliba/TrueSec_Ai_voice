"""add call_logs.conversation_id FK to conversations

Revision ID: 003_call_conv
Revises: 002_reset_tokens
Create Date: 2026-02-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_call_conv"
down_revision: Union[str, None] = "002_reset_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "call_logs",
        sa.Column("conversation_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_call_logs_conversation_id_conversations",
        "call_logs",
        "conversations",
        ["conversation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_call_logs_conversation_id"), "call_logs", ["conversation_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_call_logs_conversation_id"), table_name="call_logs")
    op.drop_constraint("fk_call_logs_conversation_id_conversations", "call_logs", type_="foreignkey")
    op.drop_column("call_logs", "conversation_id")
