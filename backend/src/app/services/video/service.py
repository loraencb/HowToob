from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from ...extensions import db
from ...models.subscription import Subscription
from ...models.video import Video
from ...models.user import User


class VideoService:
    @staticmethod
    def with_relations(query=None):
        base_query = query if query is not None else Video.query
        return base_query.options(
            selectinload(Video.creator),
            selectinload(Video.comments),
            selectinload(Video.likes),
        )

    @staticmethod
    def create_video(
        title,
        description,
        file_path,
        creator_id,
        thumbnail_path=None,
        category=None,
        learning_level=None,
        access_tier=0,
    ):
        user = db.session.get(User, creator_id)
        if not user:
            return None, "Creator not found"

        normalized_access_tier = VideoService.normalize_access_tier(access_tier)
        if normalized_access_tier is None:
            return None, "Access tier must be a non-negative integer"

        video = Video(
            title=title,
            description=description,
            file_path=file_path,
            thumbnail_path=thumbnail_path,
            creator_id=creator_id,
            category=category,
            learning_level=learning_level,
            access_tier=normalized_access_tier,
        )
        db.session.add(video)
        db.session.commit()
        return video, None

    @staticmethod
    def get_all_videos():
        return VideoService.with_relations().order_by(Video.created_at.desc()).all()

    @staticmethod
    def get_video_by_id(video_id):
        try:
            normalized_video_id = int(video_id)
        except (TypeError, ValueError):
            return None

        return VideoService.with_relations().filter(Video.id == normalized_video_id).first()

    @staticmethod
    def get_video_by_filename(filename):
        if not filename:
            return None

        return (
            VideoService.with_relations()
            .filter(Video.file_path.like(f"%{filename}"))
            .order_by(Video.id.desc())
            .first()
        )

    @staticmethod
    def get_videos_by_creator(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        videos = VideoService.with_relations(Video.query.filter_by(
            creator_id=user_id
        )).order_by(Video.created_at.desc()).all()
        return videos, None

    @staticmethod
    def get_feed(page=1, limit=10, search=None):
        query = VideoService.with_relations(Video.query.filter_by(is_published=True))

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Video.title.ilike(search_term),
                    Video.description.ilike(search_term),
                )
            )

        query = query.order_by(Video.created_at.desc())

        pagination = query.paginate(page=page, per_page=limit, error_out=False)

        return {
            "page": page,
            "limit": limit,
            "total": pagination.total,
            "pages": pagination.pages,
            "results": [video.to_dict() for video in pagination.items],
        }

    @staticmethod
    def increment_views(video):
        video.views += 1
        db.session.commit()
        return video

    @staticmethod
    def get_access_context(video, viewer=None):
        required_tier = int(video.access_tier or 0)
        is_authenticated = bool(viewer and getattr(viewer, "is_authenticated", False))
        is_owner = is_authenticated and viewer.id == video.creator_id
        is_admin = is_authenticated and getattr(viewer, "role", None) == "admin"
        subscription = None
        current_tier = 0
        access_source = "public"
        has_access = required_tier == 0

        if required_tier > 0:
            if is_owner:
                has_access = True
                current_tier = required_tier
                access_source = "owner"
            elif is_admin:
                has_access = True
                current_tier = required_tier
                access_source = "admin"
            elif is_authenticated:
                subscription = Subscription.query.filter_by(
                    subscriber_id=viewer.id,
                    creator_id=video.creator_id,
                ).first()
                current_tier = int(subscription.tier_level or 0) if subscription else 0
                has_access = subscription is not None and current_tier >= required_tier
                access_source = "subscription" if has_access else "subscription_required"
            else:
                access_source = "subscription_required"

        return {
            "has_access": has_access,
            "required_tier": required_tier,
            "current_tier": current_tier,
            "is_authenticated": is_authenticated,
            "is_owner": is_owner,
            "is_admin": is_admin,
            "creator_id": video.creator_id,
            "subscription_id": subscription.id if subscription else None,
            "access_source": access_source,
        }

    @staticmethod
    def build_access_denied_payload(video, access_context):
        return {
            "error": "Access denied",
            "code": "ACCESS_DENIED",
            "message": f"This lesson requires Tier {access_context['required_tier']} access.",
            "details": {
                "video_id": video.id,
                "creator_id": video.creator_id,
                "required_tier": access_context["required_tier"],
                "current_tier": access_context["current_tier"],
                "is_authenticated": access_context["is_authenticated"],
            },
        }

    @staticmethod
    def normalize_access_tier(access_tier):
        try:
            normalized = int(access_tier or 0)
        except (TypeError, ValueError):
            return None

        if normalized < 0:
            return None

        return normalized

    @staticmethod
    def update_video(
        video,
        title=None,
        description=None,
        thumbnail_path=None,
        category=None,
        learning_level=None,
        access_tier=None,
        is_published=None,
    ):
        if title is not None:
            video.title = title
        if description is not None:
            video.description = description
        if thumbnail_path is not None:
            video.thumbnail_path = thumbnail_path
        if category is not None:
            video.category = category
        if learning_level is not None:
            video.learning_level = learning_level
        if access_tier is not None:
            normalized_access_tier = VideoService.normalize_access_tier(access_tier)
            if normalized_access_tier is None:
                raise ValueError("Access tier must be a non-negative integer")
            video.access_tier = normalized_access_tier
        if is_published is not None:
            video.is_published = bool(is_published)

        db.session.commit()
        return video

    @staticmethod
    def delete_video(video):
        db.session.delete(video)
        db.session.commit()
