from datetime import datetime, UTC
from sqlalchemy.orm import selectinload
from ...extensions import db
from ...models.progress import Progress
from ...models.user import User
from ...models.video import Video

COMPLETION_THRESHOLD_PERCENT = 90.0


class ProgressService:
    @staticmethod
    def _with_video_relations(query=None):
        base_query = query if query is not None else Progress.query
        return base_query.options(
            selectinload(Progress.video).selectinload(Video.creator),
            selectinload(Progress.video).selectinload(Video.comments),
            selectinload(Progress.video).selectinload(Video.likes),
        )

    @staticmethod
    def _normalize_progress_input(watched_seconds=None, duration_seconds=None, percent_complete=None):
        def parse_number(value, field_name):
            if value is None:
                return None, None
            try:
                parsed = float(value)
            except (TypeError, ValueError):
                return None, f"{field_name} must be a number"
            if parsed < 0:
                return None, f"{field_name} cannot be negative"
            return parsed, None

        watched_seconds, error = parse_number(watched_seconds, "watched_seconds")
        if error:
            return None, error

        duration_seconds, error = parse_number(duration_seconds, "duration_seconds")
        if error:
            return None, error

        percent_complete, error = parse_number(percent_complete, "percent_complete")
        if error:
            return None, error

        return {
            "watched_seconds": watched_seconds,
            "duration_seconds": duration_seconds,
            "percent_complete": percent_complete,
        }, None

    @staticmethod
    def get_user_progress(user_id, status=None, limit=None):
        query = ProgressService._with_video_relations(
            Progress.query.filter_by(user_id=user_id)
        ).order_by(Progress.last_watched_at.desc())

        if status == "completed":
            query = query.filter_by(completed=True)
        elif status in {"active", "continue"}:
            query = query.filter(Progress.percent_complete > 0, Progress.completed.is_(False))

        if limit is not None:
            query = query.limit(limit)

        items = query.all()
        summary = {
            "total_entries": len(items),
            "completed_count": sum(1 for item in items if item.completed),
            "in_progress_count": sum(1 for item in items if item.percent_complete > 0 and not item.completed),
            "continue_watching_count": sum(
                1 for item in items if item.percent_complete > 0 and item.percent_complete < 100 and not item.completed
            ),
            "total_watch_seconds": round(sum(item.watched_seconds for item in items), 2),
        }

        return {
            "results": [item.to_dict() for item in items],
            "summary": summary,
        }

    @staticmethod
    def upsert_progress(
        user_id,
        video_id,
        watched_seconds=None,
        duration_seconds=None,
        percent_complete=None,
        completed=None,
    ):
        try:
            normalized_video_id = int(video_id)
        except (TypeError, ValueError):
            return None, "video_id must be an integer"

        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        video = db.session.get(Video, normalized_video_id)
        if not video:
            return None, "Video not found"

        normalized, error = ProgressService._normalize_progress_input(
            watched_seconds=watched_seconds,
            duration_seconds=duration_seconds,
            percent_complete=percent_complete,
        )
        if error:
            return None, error

        if all(value is None for value in normalized.values()) and completed is None:
            return None, "Provide watched_seconds, duration_seconds, percent_complete, or completed"

        entry = Progress.query.filter_by(user_id=user_id, video_id=normalized_video_id).first()
        if not entry:
            entry = Progress(user_id=user_id, video_id=normalized_video_id)
            db.session.add(entry)

        next_duration = normalized["duration_seconds"] if normalized["duration_seconds"] is not None else entry.duration_seconds
        next_watched = normalized["watched_seconds"] if normalized["watched_seconds"] is not None else entry.watched_seconds

        if next_duration and next_watched > next_duration:
            next_watched = next_duration

        if normalized["percent_complete"] is not None:
            next_percent = min(normalized["percent_complete"], 100.0)
        elif next_duration:
            next_percent = min((next_watched / next_duration) * 100, 100.0)
        else:
            next_percent = entry.percent_complete or 0.0

        entry.duration_seconds = max(entry.duration_seconds or 0.0, next_duration or 0.0)
        entry.watched_seconds = max(entry.watched_seconds or 0.0, next_watched or 0.0)
        entry.percent_complete = max(entry.percent_complete or 0.0, next_percent)
        entry.last_watched_at = datetime.now(UTC)

        is_completed = bool(completed) if completed is not None else entry.percent_complete >= COMPLETION_THRESHOLD_PERCENT
        entry.completed = entry.completed or is_completed
        if entry.completed and not entry.completed_at:
            entry.completed_at = entry.last_watched_at

        db.session.commit()
        return entry, None

    @staticmethod
    def record_watch_event(user_id, video_id, watched_seconds=None, duration_seconds=None, percent_complete=None):
        return ProgressService.upsert_progress(
            user_id=user_id,
            video_id=video_id,
            watched_seconds=watched_seconds,
            duration_seconds=duration_seconds,
            percent_complete=percent_complete,
        )
