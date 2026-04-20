from datetime import datetime, UTC
from ..extensions import db


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey("comments.id"), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False
    )

    user = db.relationship("User", backref="comments", lazy=True)
    likes = db.relationship(
        "CommentLike",
        backref="comment",
        lazy=True,
        cascade="all, delete-orphan",
    )
    replies = db.relationship(
        "Comment",
        backref=db.backref("parent", remote_side=[id]),
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_dict(self, viewer_id=None):
        like_count = len(self.likes)
        viewer_liked = (
            any(like.user_id == viewer_id for like in self.likes)
            if viewer_id is not None
            else False
        )

        return {
            "id": self.id,
            "content": self.content,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "video_id": self.video_id,
            "parent_id": self.parent_id,
            "like_count": like_count,
            "viewer_liked": viewer_liked,
            "created_at": self.created_at.isoformat(),
        }
