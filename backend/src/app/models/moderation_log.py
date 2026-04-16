from datetime import datetime, UTC
from ..extensions import db


class ModerationLog(db.Model):
    __tablename__ = "moderation_logs"

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("reports.id"), nullable=False)
    moderator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    action = db.Column(db.String(60), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    moderator = db.relationship("User", foreign_keys=[moderator_id])

    def to_dict(self):
        return {
            "id": self.id,
            "report_id": self.report_id,
            "moderator_id": self.moderator_id,
            "moderator_name": self.moderator.username if self.moderator else None,
            "action": self.action,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
        }
