from datetime import datetime, UTC
from ..extensions import db


class QuizAttempt(db.Model):
    __tablename__ = "quiz_attempts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=False)
    mode = db.Column(db.String(30), nullable=False, default="prototype")
    score = db.Column(db.Float, nullable=False)
    passed = db.Column(db.Boolean, nullable=False, default=False)
    question_count = db.Column(db.Integer, nullable=False, default=0)
    correct_count = db.Column(db.Integer, nullable=False, default=0)
    answers = db.Column(db.JSON, nullable=True)
    submitted_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    user = db.relationship("User", foreign_keys=[user_id])
    video = db.relationship("Video", foreign_keys=[video_id])

    def to_dict(self, include_answers=False):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "video_id": self.video_id,
            "mode": self.mode,
            "score": round(float(self.score or 0), 2),
            "passed": self.passed,
            "question_count": self.question_count,
            "correct_count": self.correct_count,
            "submitted_at": self.submitted_at.isoformat(),
        }

        if include_answers:
            data["answers"] = self.answers or []

        return data
