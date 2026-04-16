from datetime import datetime, UTC
from ..extensions import db


class Progress(db.Model):
    __tablename__ = "progress"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=False)
    watched_seconds = db.Column(db.Float, default=0.0, nullable=False)
    duration_seconds = db.Column(db.Float, default=0.0, nullable=False)
    percent_complete = db.Column(db.Float, default=0.0, nullable=False)
    completed = db.Column(db.Boolean, default=False, nullable=False)
    last_watched_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
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

    user = db.relationship(
        "User",
        backref=db.backref("progress_entries", lazy=True, cascade="all, delete-orphan"),
    )
    video = db.relationship(
        "Video",
        backref=db.backref("progress_entries", lazy=True, cascade="all, delete-orphan"),
    )

    __table_args__ = (
        db.UniqueConstraint("user_id", "video_id", name="unique_user_video_progress"),
    )

    def to_dict(self, include_video=True):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "video_id": self.video_id,
            "watched_seconds": round(float(self.watched_seconds or 0), 2),
            "duration_seconds": round(float(self.duration_seconds or 0), 2),
            "percent_complete": round(float(self.percent_complete or 0), 2),
            "completed": self.completed,
            "last_watched_at": self.last_watched_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

        if include_video and self.video:
            data["video"] = self.video.to_dict()

        return data
