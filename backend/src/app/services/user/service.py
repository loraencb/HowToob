from sqlalchemy import func
from sqlalchemy.orm import selectinload
from ...extensions import db
from ...models.playlist import Playlist
from ...models.subscription import Subscription
from ...models.user import User
from ...models.video import Video


class UserService:
    @staticmethod
    def resolve_user(identifier):
        normalized = str(identifier or "").strip()
        if not normalized:
            return None

        if normalized.isdigit():
            user = User.query.filter_by(id=int(normalized)).first()
            if user:
                return user

        return User.query.filter_by(username=normalized).first()

    @staticmethod
    def get_profile(identifier):
        user = UserService.resolve_user(identifier)
        if not user:
            return None, "User not found"

        videos = (
            Video.query.options(
                selectinload(Video.creator),
                selectinload(Video.comments),
                selectinload(Video.likes),
            )
            .filter_by(creator_id=user.id)
            .order_by(Video.created_at.desc())
            .limit(8)
            .all()
        )
        subscriber_count = Subscription.query.filter_by(creator_id=user.id).count()
        subscription_count = Subscription.query.filter_by(subscriber_id=user.id).count()
        playlist_count = Playlist.query.filter_by(user_id=user.id).count()
        video_count = db.session.query(func.count(Video.id)).filter_by(creator_id=user.id).scalar() or 0
        published_video_count = (
            db.session.query(func.count(Video.id))
            .filter_by(creator_id=user.id, is_published=True)
            .scalar()
            or 0
        )
        counts = {
            "video_count": video_count,
            "playlist_count": playlist_count,
            "subscriber_count": subscriber_count,
            "subscription_count": subscription_count,
        }

        headline = (
            f"{user.role_label} profile with {published_video_count} published lessons and "
            f"{subscriber_count} subscriber{'s' if subscriber_count != 1 else ''}."
            if user.role == "creator"
            else f"{user.role_label} profile following {subscription_count} creator"
            f"{'s' if subscription_count != 1 else ''}."
        )

        return {
            "profile": user.to_public_dict(include_counts=True, counts=counts),
            "summary": {
                "subscriber_count": subscriber_count,
                "subscription_count": subscription_count,
                "video_count": video_count,
                "published_video_count": published_video_count,
                "playlist_count": playlist_count,
                "headline": headline,
            },
            "videos": [video.to_dict() for video in videos],
        }, None
