from datetime import datetime, UTC
from sqlalchemy.orm import selectinload
from ...extensions import db
from ...models.comment import Comment
from ...models.moderation_log import ModerationLog
from ...models.report import Report
from ...models.user import User
from ...models.video import Video


class AdminService:
    ACTIVE_REPORT_STATUSES = {"pending", "reviewing"}
    TERMINAL_REPORT_STATUSES = {"resolved", "dismissed"}

    @staticmethod
    def _get_target(target_type, target_id):
        normalized_type = str(target_type or "").lower()
        try:
            normalized_target_id = int(target_id)
        except (TypeError, ValueError):
            return None, None, "target_id must be an integer"

        if normalized_type == "video":
            target = db.session.get(Video, normalized_target_id)
            if not target:
                return None, None, "Video not found"
            return target, target.id, None

        if normalized_type == "comment":
            target = db.session.get(Comment, normalized_target_id)
            if not target:
                return None, None, "Comment not found"
            return target, target.video_id, None

        return None, None, "Unsupported report target type"

    @staticmethod
    def submit_report(reporter_id, target_type, target_id, reason, details=None, label=None, video_id=None):
        reporter = db.session.get(User, reporter_id)
        if not reporter:
            return None, "Reporter not found"

        target, derived_video_id, error = AdminService._get_target(target_type, target_id)
        if error:
            return None, error

        normalized_target_type = str(target_type).lower().strip()
        normalized_reason = str(reason or "").strip().lower()
        if not normalized_reason:
            return None, "reason is required"

        duplicate_report = (
            Report.query.filter_by(
                reporter_id=reporter_id,
                target_type=normalized_target_type,
                target_id=target.id,
            )
            .filter(Report.status.in_(AdminService.ACTIVE_REPORT_STATUSES))
            .first()
        )
        if duplicate_report:
            return None, "Duplicate report already exists"

        report = Report(
            reporter_id=reporter_id,
            target_type=normalized_target_type,
            target_id=target.id,
            video_id=video_id or derived_video_id,
            label=label or getattr(target, "title", None) or getattr(target, "content", None),
            reason=normalized_reason,
            details=details,
            status="pending",
        )
        db.session.add(report)
        db.session.commit()
        return report, None

    @staticmethod
    def list_reports(status=None, target_type=None, reason=None, reporter_id=None):
        query = Report.query.options(
            selectinload(Report.reporter),
            selectinload(Report.logs).selectinload(ModerationLog.moderator),
        ).order_by(Report.created_at.desc())

        if status and status != "all":
            query = query.filter_by(status=status)
        if target_type:
            query = query.filter_by(target_type=str(target_type).lower().strip())
        if reason:
            query = query.filter_by(reason=str(reason).lower().strip())
        if reporter_id is not None:
            query = query.filter_by(reporter_id=reporter_id)

        reports = query.all()
        return {
            "filters": {
                "status": status or "all",
                "target_type": target_type or "all",
                "reason": reason or "all",
                "reporter_id": reporter_id,
            },
            "total": len(reports),
            "results": [report.to_dict(include_logs=True) for report in reports],
        }

    @staticmethod
    def apply_report_action(report_id, moderator_id, action, notes=None):
        report = db.session.get(Report, report_id)
        if not report:
            return None, "Report not found"

        moderator = db.session.get(User, moderator_id)
        if not moderator:
            return None, "Moderator not found"

        normalized_action = str(action or "").strip().lower()
        now = datetime.now(UTC)
        next_status = report.status

        if normalized_action in {"review", "reviewing"}:
            next_status = "reviewing"
        elif normalized_action in {"resolve", "resolved"}:
            next_status = "resolved"
        elif normalized_action in {"dismiss", "dismissed"}:
            next_status = "dismissed"
        elif normalized_action == "hide_video":
            if report.target_type != "video":
                return None, "hide_video can only be used on video reports"
            video = db.session.get(Video, report.target_id)
            if not video:
                return None, "Reported video not found"
            video.is_published = False
            next_status = "resolved"
        elif normalized_action == "hide_comment":
            if report.target_type != "comment":
                return None, "hide_comment can only be used on comment reports"
            comment = db.session.get(Comment, report.target_id)
            if not comment:
                return None, "Reported comment not found"
            comment.content = "[Removed by moderation]"
            next_status = "resolved"
        else:
            return None, "Unsupported moderation action"

        allowed_transitions = {
            "pending": {"reviewing", "resolved", "dismissed"},
            "reviewing": {"reviewing", "resolved", "dismissed"},
            "resolved": {"resolved"},
            "dismissed": {"dismissed"},
        }
        if next_status not in allowed_transitions.get(report.status, set()):
            return None, f"Cannot transition report from {report.status} to {next_status}"

        report.status = next_status
        if next_status in AdminService.TERMINAL_REPORT_STATUSES:
            report.resolved_at = report.resolved_at or now

        log = ModerationLog(
            report_id=report.id,
            moderator_id=moderator_id,
            action=normalized_action,
            notes=notes,
        )
        db.session.add(log)
        db.session.commit()
        return report, None
