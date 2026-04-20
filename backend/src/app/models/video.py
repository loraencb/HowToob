from datetime import datetime, UTC
import os
from ..extensions import db
from ..utils.category_taxonomy import get_category_metadata


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

    def get_quiz_metadata(self):
        definition = getattr(self, "quiz_definition", None)
        transcript_cache = getattr(self, "transcript_cache", None)
        has_quiz = bool(definition and definition.questions)
        question_count = len(definition.questions) if has_quiz else 0
        status = "ready" if has_quiz else "unavailable"
        reason = None
        note = (
            f"{question_count} question{'s' if question_count != 1 else ''} ready for this lesson."
            if has_quiz
            else "No lesson quiz is available yet."
        )

        if not has_quiz and transcript_cache:
            normalized_error = str(transcript_cache.error_message or "").strip().lower()
            if normalized_error.startswith("insufficient_transcript:"):
                reason = "insufficient_transcript"
                note = (
                    "This lesson does not have enough clear spoken guidance to support a reliable quiz."
                )
            elif transcript_cache.status == "processing":
                status = "processing"
                reason = "processing"
                note = "A lesson quiz is still being prepared."
            elif transcript_cache.status == "failed":
                reason = "generation_failed"
                note = "A lesson quiz is not available right now."

        return {
            "available": has_quiz,
            "status": status,
            "reason": reason,
            "question_count": question_count,
            "note": note,
        }

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

    def get_rating_summary(self, viewer_id=None):
        ratings = [int(getattr(entry, "rating", 5) or 5) for entry in self.likes]
        rating_count = len(ratings)
        average_rating = round(sum(ratings) / rating_count, 2) if rating_count else 0.0
        viewer_rating = 0

        if viewer_id is not None:
            for entry in self.likes:
                if entry.user_id == viewer_id:
                    viewer_rating = int(getattr(entry, "rating", 5) or 5)
                    break

        return {
            "rating_count": rating_count,
            "average_rating": average_rating,
            "viewer_rating": viewer_rating,
        }

    def to_dict(self, viewer_id=None, access_context=None):
        filename = os.path.basename(self.file_path) if self.file_path else None
        thumbnail = os.path.basename(self.thumbnail_path) if self.thumbnail_path else None
        creator_data = self.creator.to_public_dict() if self.creator else None
        access_metadata = self.get_access_metadata()
        rating_summary = self.get_rating_summary(viewer_id=viewer_id)
        category_metadata = get_category_metadata(self.category)
        quiz_metadata = self.get_quiz_metadata()

        data = {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": category_metadata["value"] or self.category,
            "category_label": category_metadata["label"],
            "category_primary": category_metadata["primary_value"],
            "category_primary_label": category_metadata["primary_label"],
            "category_path": category_metadata["path_label"],
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
            "quiz": quiz_metadata,
            "created_at": self.created_at.isoformat(),
            "comment_count": len(self.comments),
            "rating_count": rating_summary["rating_count"],
            "average_rating": rating_summary["average_rating"],
            "viewer_rating": rating_summary["viewer_rating"],
            "like_count": rating_summary["rating_count"],
        }

        if access_context is not None:
            data["access_status"] = access_context

        return data
