from ...extensions import db
from ...models.comment import Comment
from ...models.like import Like
from ...models.subscription import Subscription
from ...models.user import User
from ...models.video import Video


class SocialService:
    @staticmethod
    def normalize_tier_level(tier_level):
        try:
            normalized = int(tier_level or 0)
        except (TypeError, ValueError):
            return None

        if normalized < 0:
            return None

        return normalized

    @staticmethod
    def add_comment(content, user_id, video_id, parent_id=None):
        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        video = db.session.get(Video, video_id)
        if not video:
            return None, "Video not found"

        if parent_id is not None:
            parent_comment = db.session.get(Comment, parent_id)
            if not parent_comment:
                return None, "Parent comment not found"
            if parent_comment.video_id != video_id:
                return None, "Reply must belong to the same video"

        comment = Comment(
            content=content,
            user_id=user_id,
            video_id=video_id,
            parent_id=parent_id,
        )
        db.session.add(comment)
        db.session.commit()
        return comment, None

    @staticmethod
    def get_comments_by_video(video_id):
        video = db.session.get(Video, video_id)
        if not video:
            return None, "Video not found"

        comments = Comment.query.filter_by(video_id=video_id).order_by(Comment.created_at.asc()).all()
        return comments, None

    @staticmethod
    def toggle_like(user_id, video_id):
        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        video = db.session.get(Video, video_id)
        if not video:
            return None, "Video not found"

        existing_like = Like.query.filter_by(user_id=user_id, video_id=video_id).first()

        if existing_like:
            db.session.delete(existing_like)
            db.session.commit()
            return {"liked": False}, None

        like = Like(user_id=user_id, video_id=video_id)
        db.session.add(like)
        db.session.commit()
        return {"liked": True}, None

    @staticmethod
    def subscribe(subscriber_id, creator_id, tier_level=0):
        subscriber = db.session.get(User, subscriber_id)
        if not subscriber:
            return None, "Subscriber not found"

        creator = db.session.get(User, creator_id)
        if not creator:
            return None, "Creator not found"

        if subscriber_id == creator_id:
            return None, "Users cannot subscribe to themselves"

        normalized_tier_level = SocialService.normalize_tier_level(tier_level)
        if normalized_tier_level is None:
            return None, "tier_level must be a non-negative integer"

        existing = Subscription.query.filter_by(
            subscriber_id=subscriber_id,
            creator_id=creator_id,
        ).first()

        if existing:
            if normalized_tier_level > existing.tier_level:
                existing.tier_level = normalized_tier_level
                db.session.commit()
            return existing, None

        subscription = Subscription(
            subscriber_id=subscriber_id,
            creator_id=creator_id,
            tier_level=normalized_tier_level,
        )
        db.session.add(subscription)
        db.session.commit()
        return subscription, None

    @staticmethod
    def get_video_stats(video_id):
        video = db.session.get(Video, video_id)
        if not video:
            return None, "Video not found"

        stats = {
            "video_id": video.id,
            "title": video.title,
            "views": video.views,
            "likes": len(video.likes),
            "comments": len(video.comments),
        }
        return stats, None

    @staticmethod
    def get_creator_subscriptions(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        subscriptions = Subscription.query.filter_by(subscriber_id=user_id).order_by(Subscription.id.desc()).all()
        return subscriptions, None
