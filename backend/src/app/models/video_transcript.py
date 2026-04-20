from datetime import UTC, datetime

from ..extensions import db


class VideoTranscript(db.Model):
    __tablename__ = "video_transcripts"

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=False, unique=True)
    provider = db.Column(db.String(40), nullable=True)
    model_name = db.Column(db.String(80), nullable=True)
    status = db.Column(db.String(30), nullable=False, default="pending")
    transcript_text = db.Column(db.Text, nullable=True)
    transcript_excerpt = db.Column(db.Text, nullable=True)
    source_file_path = db.Column(db.String(255), nullable=True)
    source_file_size_bytes = db.Column(db.Integer, nullable=True)
    chunk_count = db.Column(db.Integer, nullable=False, default=0)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    video = db.relationship(
        "Video",
        backref=db.backref(
            "transcript_cache",
            uselist=False,
            cascade="all, delete-orphan",
            single_parent=True,
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "video_id": self.video_id,
            "provider": self.provider,
            "model_name": self.model_name,
            "status": self.status,
            "transcript_excerpt": self.transcript_excerpt,
            "source_file_path": self.source_file_path,
            "source_file_size_bytes": self.source_file_size_bytes,
            "chunk_count": self.chunk_count,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
