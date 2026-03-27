from ...extensions import db
from ...models.comment import Comment
from ...models.like import Like
from ...models.subscription import Subscription
from ...models.user import User
from ...models.video import Video


class SocialService:
    @staticmethod
    def add_comment(content, user_id, video_id):
        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        video = db.session.get(Video, video_id)
        if not video:
            return None, "Video not found"

        comment = Comment(content=content, user_id=user_id, video_id=video_id)
        db.session.add(comment)
        db.session.commit()
        return comment, None

    @staticmethod
    def get_comments_by_video(video_id):
        video = db.session.get(Video, video_id)
        if not video:
            return None, "Video not found"

        comments = (
            Comment.query.filter_by(video_id=video_id)
            .order_by(Comment.created_at.desc())
            .all()
        )
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
            return {
                "liked": False,
                "video_id": video_id,
                "like_count": Like.query.filter_by(video_id=video_id).count(),
            }, None

        like = Like(user_id=user_id, video_id=video_id)
        db.session.add(like)
        db.session.commit()
        return {
            "liked": True,
            "video_id": video_id,
            "like_count": Like.query.filter_by(video_id=video_id).count(),
        }, None

    @staticmethod
    def get_video_like_summary(video_id, user_id=None):
        video = db.session.get(Video, video_id)
        if not video:
            return None, "Video not found"

        like_count = Like.query.filter_by(video_id=video_id).count()
        liked_by_current_user = False

        if user_id is not None:
            liked_by_current_user = (
                Like.query.filter_by(video_id=video_id, user_id=user_id).first()
                is not None
            )

        return {
            "video_id": video_id,
            "like_count": like_count,
            "liked_by_current_user": liked_by_current_user,
        }, None

    @staticmethod
    def subscribe(subscriber_id, creator_id):
        subscriber = db.session.get(User, subscriber_id)
        if not subscriber:
            return None, "Subscriber not found"

        creator = db.session.get(User, creator_id)
        if not creator:
            return None, "Creator not found"

        if subscriber_id == creator_id:
            return None, "Users cannot subscribe to themselves"

        existing = Subscription.query.filter_by(
            subscriber_id=subscriber_id,
            creator_id=creator_id,
        ).first()

        if existing:
            return existing, None

        subscription = Subscription(
            subscriber_id=subscriber_id,
            creator_id=creator_id,
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

        subscriptions = Subscription.query.filter_by(subscriber_id=user_id).all()
        return subscriptions, None