from datetime import datetime, UTC
import os
from ..extensions import db


class Video(db.Model):
    __tablename__ = "videos"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(255), nullable=False)
    thumbnail_path = db.Column(db.String(255), nullable=True)
    creator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    views = db.Column(db.Integer, default=0, nullable=False)
    is_published = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False
    )

    comments = db.relationship(
        "Comment",
        backref="video",
        lazy=True,
        cascade="all, delete-orphan",
    )
    likes = db.relationship(
        "Like",
        backref="video",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        filename = os.path.basename(self.file_path) if self.file_path else None
        thumbnail = os.path.basename(self.thumbnail_path) if self.thumbnail_path else None

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "file_path": self.file_path,
            "video_url": f"/videos/files/videos/{filename}" if filename else None,
            "thumbnail_url": f"/videos/files/thumbnails/{thumbnail}" if thumbnail else None,
            "creator_id": self.creator_id,
            "views": self.views,
            "is_published": self.is_published,
            "created_at": self.created_at.isoformat(),
            "comment_count": len(self.comments),
            "like_count": len(self.likes),
        }