from sqlalchemy import or_
from ...extensions import db
from ...models.video import Video
from ...models.user import User


class VideoService:
    @staticmethod
    def create_video(title, description, file_path, creator_id, thumbnail_path=None):
        user = db.session.get(User, creator_id)
        if not user:
            return None, "Creator not found"

        video = Video(
            title=title,
            description=description,
            file_path=file_path,
            thumbnail_path=thumbnail_path,
            creator_id=creator_id,
        )
        db.session.add(video)
        db.session.commit()
        return video, None

    @staticmethod
    def get_all_videos():
        return Video.query.order_by(Video.created_at.desc()).all()

    @staticmethod
    def get_video_by_id(video_id):
        return db.session.get(Video, video_id)

    @staticmethod
    def get_videos_by_creator(user_id):
        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        videos = Video.query.filter_by(
            creator_id=user_id
        ).order_by(Video.created_at.desc()).all()
        return videos, None

    @staticmethod
    def get_feed(page=1, limit=10, search=None):
        query = Video.query.filter_by(is_published=True)

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
    def update_video(video, title=None, description=None, thumbnail_path=None):
        if title is not None:
            video.title = title
        if description is not None:
            video.description = description
        if thumbnail_path is not None:
            video.thumbnail_path = thumbnail_path

        db.session.commit()
        return video

    @staticmethod
    def delete_video(video):
        db.session.delete(video)
        db.session.commit()