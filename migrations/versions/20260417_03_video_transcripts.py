"""add video transcript cache table

Revision ID: 20260417_03
Revises: 20260417_02
Create Date: 2026-04-17 02:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260417_03"
down_revision = "20260417_02"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "video_transcripts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("video_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=True),
        sa.Column("model_name", sa.String(length=80), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("transcript_text", sa.Text(), nullable=True),
        sa.Column("transcript_excerpt", sa.Text(), nullable=True),
        sa.Column("source_file_path", sa.String(length=255), nullable=True),
        sa.Column("source_file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("video_id"),
    )


def downgrade():
    op.drop_table("video_transcripts")
