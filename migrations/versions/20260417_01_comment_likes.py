"""add comment likes

Revision ID: 20260417_01
Revises: 20260416_01
Create Date: 2026-04-17 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260417_01"
down_revision = "20260416_01"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "comment_likes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("comment_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "comment_id", name="unique_user_comment_like"),
    )


def downgrade():
    op.drop_table("comment_likes")
