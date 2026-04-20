"""add video rating column

Revision ID: 20260417_02
Revises: 20260417_01
Create Date: 2026-04-17 00:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260417_02"
down_revision = "20260417_01"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("likes", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("rating", sa.Integer(), nullable=False, server_default="5")
        )


def downgrade():
    with op.batch_alter_table("likes", schema=None) as batch_op:
        batch_op.drop_column("rating")
