import os

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from ..extensions import db


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="viewer")
    profile_image_path = db.Column(db.String(255), nullable=True)

    videos = db.relationship("Video", backref="creator", lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def role_label(self):
        labels = {
            "viewer": "Explorer",
            "creator": "Creator",
            "admin": "Admin",
        }
        return labels.get(self.role, self.role.title())

    @property
    def profile_image_url(self):
        if not self.profile_image_path:
            return None

        filename = os.path.basename(str(self.profile_image_path))
        if not filename:
            return None

        return f"/users/files/profile-pictures/{filename}"

    def to_dict(self):
        profile_image_url = self.profile_image_url
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "display_name": self.username,
            "role_label": self.role_label,
            "profile_image_url": profile_image_url,
            "avatar_url": profile_image_url,
        }

    def to_public_dict(self, include_counts=False, counts=None):
        profile_image_url = self.profile_image_url
        data = {
            "id": self.id,
            "username": self.username,
            "display_name": self.username,
            "role": self.role,
            "role_label": self.role_label,
            "profile_image_url": profile_image_url,
            "avatar_url": profile_image_url,
        }

        if include_counts:
            resolved_counts = counts or {}
            if not counts:
                from .playlist import Playlist
                from .subscription import Subscription

                resolved_counts = {
                    "video_count": len(self.videos),
                    "playlist_count": Playlist.query.filter_by(user_id=self.id).count(),
                    "subscriber_count": Subscription.query.filter_by(creator_id=self.id).count(),
                    "subscription_count": Subscription.query.filter_by(subscriber_id=self.id).count(),
                }

            data.update(resolved_counts)

        return data
