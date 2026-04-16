from datetime import datetime, UTC
from ..extensions import db


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey("videos.id"), nullable=True)
    label = db.Column(db.String(160), nullable=True)
    reason = db.Column(db.String(60), nullable=False)
    details = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), nullable=False, default="pending")
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
    resolved_at = db.Column(db.DateTime(timezone=True), nullable=True)

    reporter = db.relationship("User", foreign_keys=[reporter_id])
    video = db.relationship("Video", foreign_keys=[video_id])
    logs = db.relationship(
        "ModerationLog",
        backref="report",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="ModerationLog.created_at",
    )

    def to_dict(self, include_logs=False):
        last_log = self.logs[-1] if self.logs else None
        data = {
            "id": self.id,
            "reporter_id": self.reporter_id,
            "reporter_name": self.reporter.username if self.reporter else None,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "video_id": self.video_id,
            "label": self.label,
            "reason": self.reason,
            "details": self.details,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "log_count": len(self.logs),
            "latest_action": last_log.action if last_log else None,
        }

        if include_logs:
            data["logs"] = [log.to_dict() for log in self.logs]

        return data
