from datetime import datetime, UTC
from ..extensions import db


class PlaylistVideo(db.Model):
    __tablename__ = "playlist_videos"

    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id"), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=1)
    added_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    video = db.relationship(
        "Video",
        backref=db.backref("playlist_entries", lazy=True, cascade="all, delete-orphan"),
    )

    __table_args__ = (
        db.UniqueConstraint("playlist_id", "video_id", name="unique_playlist_video"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "playlist_id": self.playlist_id,
            "video_id": self.video_id,
            "position": self.position,
            "added_at": self.added_at.isoformat(),
            "video": self.video.to_dict() if self.video else None,
        }
