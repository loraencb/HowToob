"""add user profile pictures

Revision ID: 20260421_01
Revises: 20260417_03
Create Date: 2026-04-21 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260421_01"
down_revision = "20260417_03"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}

    if "profile_image_path" not in columns:
        op.add_column(
            "users",
            sa.Column("profile_image_path", sa.String(length=255), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}

    if "profile_image_path" in columns:
        op.drop_column("users", "profile_image_path")
