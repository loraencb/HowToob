from ...extensions import db
from ...models.comment import Comment
from ...models.comment_like import CommentLike
from ...models.like import Like
from ...models.subscription import Subscription
from ...models.user import User
from ...models.video import Video
from sqlalchemy.orm import selectinload


class SocialService:
    @staticmethod
    def _with_video_relations(query):
        return query.options(
            selectinload(Like.video).selectinload(Video.creator),
            selectinload(Like.video).selectinload(Video.comments),
            selectinload(Like.video).selectinload(Video.likes),
        )

    @staticmethod
    def normalize_entity_id(value, field_name):
        try:
            return int(value), None
        except (TypeError, ValueError):
            return None, f"{field_name} must be a valid integer"

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
    def normalize_rating(rating):
        try:
            normalized = int(rating)
        except (TypeError, ValueError):
            return None

        if normalized < 1 or normalized > 5:
            return None

        return normalized

    @staticmethod
    def add_comment(content, user_id, video_id, parent_id=None):
        normalized_content = str(content or "").strip()
        if not normalized_content:
            return None, "Comment content is required"

        normalized_user_id, user_id_error = SocialService.normalize_entity_id(user_id, "user_id")
        if user_id_error:
            return None, user_id_error

        normalized_video_id, video_id_error = SocialService.normalize_entity_id(video_id, "video_id")
        if video_id_error:
            return None, video_id_error

        normalized_parent_id = None
        if parent_id is not None:
            normalized_parent_id, parent_id_error = SocialService.normalize_entity_id(parent_id, "parent_id")
            if parent_id_error:
                return None, parent_id_error

        user = db.session.get(User, normalized_user_id)
        if not user:
            return None, "User not found"

        video = db.session.get(Video, normalized_video_id)
        if not video:
            return None, "Video not found"

        if normalized_parent_id is not None:
            parent_comment = db.session.get(Comment, normalized_parent_id)
            if not parent_comment:
                return None, "Parent comment not found"
            if parent_comment.video_id != normalized_video_id:
                return None, "Reply must belong to the same video"

        comment = Comment(
            content=normalized_content,
            user_id=normalized_user_id,
            video_id=normalized_video_id,
            parent_id=normalized_parent_id,
        )
        db.session.add(comment)
        db.session.commit()
        return comment, None

    @staticmethod
    def get_comments_by_video(video_id):
        video = db.session.get(Video, video_id)
        if not video:
            return None, "Video not found"

        comments = (
            Comment.query.options(
                selectinload(Comment.user),
                selectinload(Comment.likes),
            )
            .filter_by(video_id=video_id)
            .order_by(Comment.created_at.asc(), Comment.id.asc())
            .all()
        )
        return comments, None

    @staticmethod
    def toggle_comment_like(user_id, comment_id):
        normalized_user_id, user_id_error = SocialService.normalize_entity_id(user_id, "user_id")
        if user_id_error:
            return None, user_id_error

        normalized_comment_id, comment_id_error = SocialService.normalize_entity_id(comment_id, "comment_id")
        if comment_id_error:
            return None, comment_id_error

        user = db.session.get(User, normalized_user_id)
        if not user:
            return None, "User not found"

        comment = db.session.get(Comment, normalized_comment_id)
        if not comment:
            return None, "Comment not found"

        existing_like = CommentLike.query.filter_by(
            user_id=normalized_user_id,
            comment_id=normalized_comment_id,
        ).first()

        if existing_like:
            db.session.delete(existing_like)
            db.session.commit()
            remaining_likes = CommentLike.query.filter_by(comment_id=normalized_comment_id).count()
            return {
                "comment_id": normalized_comment_id,
                "liked": False,
                "like_count": remaining_likes,
            }, None

        comment_like = CommentLike(
            user_id=normalized_user_id,
            comment_id=normalized_comment_id,
        )
        db.session.add(comment_like)
        db.session.commit()

        total_likes = CommentLike.query.filter_by(comment_id=normalized_comment_id).count()
        return {
            "comment_id": normalized_comment_id,
            "liked": True,
            "like_count": total_likes,
        }, None

    @staticmethod
    def toggle_like(user_id, video_id):
        normalized_user_id, user_id_error = SocialService.normalize_entity_id(user_id, "user_id")
        if user_id_error:
            return None, user_id_error

        normalized_video_id, video_id_error = SocialService.normalize_entity_id(video_id, "video_id")
        if video_id_error:
            return None, video_id_error

        user = db.session.get(User, normalized_user_id)
        if not user:
            return None, "User not found"

        video = db.session.get(Video, normalized_video_id)
        if not video:
            return None, "Video not found"

        existing_like = Like.query.filter_by(
            user_id=normalized_user_id,
            video_id=normalized_video_id,
        ).first()

        if existing_like:
            if int(getattr(existing_like, "rating", 5) or 5) != 5:
                existing_like.rating = 5
                db.session.commit()
                refreshed_video = db.session.get(Video, normalized_video_id)
                rating_summary = refreshed_video.get_rating_summary(viewer_id=normalized_user_id)
                return {
                    "liked": True,
                    "rating": 5,
                    "video_id": normalized_video_id,
                    **rating_summary,
                }, None

            db.session.delete(existing_like)
            db.session.commit()
            refreshed_video = db.session.get(Video, normalized_video_id)
            rating_summary = refreshed_video.get_rating_summary(viewer_id=normalized_user_id)
            return {
                "liked": False,
                "rating": 0,
                "video_id": normalized_video_id,
                **rating_summary,
            }, None

        like = Like(user_id=normalized_user_id, video_id=normalized_video_id, rating=5)
        db.session.add(like)
        db.session.commit()
        refreshed_video = db.session.get(Video, normalized_video_id)
        rating_summary = refreshed_video.get_rating_summary(viewer_id=normalized_user_id)
        return {
            "liked": True,
            "rating": 5,
            "video_id": normalized_video_id,
            **rating_summary,
        }, None

    @staticmethod
    def set_video_rating(user_id, video_id, rating):
        normalized_user_id, user_id_error = SocialService.normalize_entity_id(user_id, "user_id")
        if user_id_error:
            return None, user_id_error

        normalized_video_id, video_id_error = SocialService.normalize_entity_id(video_id, "video_id")
        if video_id_error:
            return None, video_id_error

        normalized_rating = SocialService.normalize_rating(rating)
        if normalized_rating is None:
            return None, "rating must be an integer between 1 and 5"

        user = db.session.get(User, normalized_user_id)
        if not user:
            return None, "User not found"

        video = db.session.get(Video, normalized_video_id)
        if not video:
            return None, "Video not found"

        existing_rating = Like.query.filter_by(
            user_id=normalized_user_id,
            video_id=normalized_video_id,
        ).first()

        if existing_rating:
            existing_rating.rating = normalized_rating
        else:
            db.session.add(
                Like(
                    user_id=normalized_user_id,
                    video_id=normalized_video_id,
                    rating=normalized_rating,
                )
            )

        db.session.commit()

        refreshed_video = db.session.get(Video, normalized_video_id)
        rating_summary = refreshed_video.get_rating_summary(viewer_id=normalized_user_id)
        return {
            "video_id": normalized_video_id,
            **rating_summary,
        }, None

    @staticmethod
    def get_user_rated_videos(user_id, limit=None):
        normalized_user_id, user_id_error = SocialService.normalize_entity_id(user_id, "user_id")
        if user_id_error:
            return None, user_id_error

        user = db.session.get(User, normalized_user_id)
        if not user:
            return None, "User not found"

        query = SocialService._with_video_relations(
            Like.query.filter_by(user_id=normalized_user_id)
        ).order_by(Like.id.desc())

        if limit is not None and int(limit) > 0:
            query = query.limit(int(limit))

        ratings = query.all()
        total_ratings = len(ratings)
        average_given_rating = (
            round(sum(int(rating.rating or 0) for rating in ratings) / total_ratings, 2)
            if total_ratings
            else 0.0
        )

        return {
            "results": [
                {
                    "id": rating.id,
                    "video_id": rating.video_id,
                    "rating": int(rating.rating or 0),
                    "video": rating.video.to_dict(viewer_id=normalized_user_id)
                    if getattr(rating, "video", None)
                    else None,
                }
                for rating in ratings
            ],
            "summary": {
                "total_ratings": total_ratings,
                "average_rating_given": average_given_rating,
            },
        }, None

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

        rating_summary = video.get_rating_summary()
        stats = {
            "video_id": video.id,
            "title": video.title,
            "views": video.views,
            "ratings": rating_summary["rating_count"],
            "rating_count": rating_summary["rating_count"],
            "average_rating": rating_summary["average_rating"],
            "likes": rating_summary["rating_count"],
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
