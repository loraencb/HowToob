from ..extensions import db


class CommentLike(db.Model):
    __tablename__ = "comment_likes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id"), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "comment_id", name="unique_user_comment_like"),
    )
