from datetime import datetime, UTC
from ..extensions import db


class QuizDefinition(db.Model):
    __tablename__ = "quiz_definitions"

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=False, unique=True)
    title = db.Column(db.String(180), nullable=True)
    description = db.Column(db.Text, nullable=True)
    questions = db.Column(db.JSON, nullable=False, default=list)
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

    video = db.relationship(
        "Video",
        backref=db.backref(
            "quiz_definition",
            uselist=False,
            cascade="all, delete-orphan",
            single_parent=True,
        ),
    )

    def to_dict(self, include_answers=False):
        questions = []
        for question in self.questions or []:
            item = {
                "id": question.get("id"),
                "question": question.get("question"),
                "options": question.get("options", []),
                "explanation": question.get("explanation"),
            }
            if include_answers:
                item["correct_index"] = question.get("correct_index")
            questions.append(item)

        return {
            "id": self.id,
            "video_id": self.video_id,
            "title": self.title,
            "description": self.description,
            "question_count": len(questions),
            "questions": questions,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
