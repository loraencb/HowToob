from datetime import datetime, UTC
from ..extensions import db


class Playlist(db.Model):
    __tablename__ = "playlists"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_default = db.Column(db.Boolean, default=False, nullable=False)
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
        backref=db.backref("playlists", lazy=True, cascade="all, delete-orphan"),
    )
    items = db.relationship(
        "PlaylistVideo",
        backref="playlist",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="PlaylistVideo.position",
    )

    def to_dict(self, include_items=False):
        ordered_items = sorted(self.items, key=lambda item: item.position)
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "description": self.description,
            "source": "backend",
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "item_count": len(ordered_items),
        }

        if include_items:
            data["items"] = [item.to_dict() for item in ordered_items]

        return data
