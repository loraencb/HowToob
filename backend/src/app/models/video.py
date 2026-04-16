from datetime import datetime, UTC
import os
from ..extensions import db


class Video(db.Model):
    __tablename__ = "videos"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(80), nullable=True)
    learning_level = db.Column(db.String(30), nullable=True)
    access_tier = db.Column(db.Integer, default=0, nullable=False)
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

    def get_access_metadata(self):
        tier_level = int(self.access_tier or 0)
        return {
            "tier_level": tier_level,
            "label": "Standard access" if tier_level == 0 else f"Tier {tier_level} access",
            "is_premium": tier_level > 0,
            "note": (
                "No premium tier metadata is exposed for this lesson."
                if tier_level == 0
                else "Tier metadata is enforced on lesson watch and quiz endpoints."
            ),
        }

    def to_dict(self, access_context=None):
        filename = os.path.basename(self.file_path) if self.file_path else None
        thumbnail = os.path.basename(self.thumbnail_path) if self.thumbnail_path else None
        creator_data = self.creator.to_public_dict() if self.creator else None
        access_metadata = self.get_access_metadata()

        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "learning_level": self.learning_level,
            "file_path": self.file_path,
            "video_url": f"/videos/files/videos/{filename}" if filename else None,
            "thumbnail_url": f"/videos/files/thumbnails/{thumbnail}" if thumbnail else None,
            "creator_id": self.creator_id,
            "creator_name": creator_data["display_name"] if creator_data else None,
            "author_name": creator_data["username"] if creator_data else None,
            "creator": creator_data,
            "views": self.views,
            "is_published": self.is_published,
            "tier_level": access_metadata["tier_level"],
            "subscription_tier": access_metadata["tier_level"],
            "subscription": access_metadata,
            "created_at": self.created_at.isoformat(),
            "comment_count": len(self.comments),
            "like_count": len(self.likes),
        }

        if access_context is not None:
            data["access_status"] = access_context

        return data
