from ..extensions import db


class Like(db.Model):
    __tablename__ = "likes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "video_id", name="unique_user_video_like"),
    )