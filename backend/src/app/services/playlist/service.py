from datetime import datetime, UTC
from sqlalchemy.orm import selectinload
from ...extensions import db
from ...models.playlist import Playlist
from ...models.playlist_video import PlaylistVideo
from ...models.user import User
from ...models.video import Video


class PlaylistService:
    @staticmethod
    def _query_with_relations(query=None):
        base_query = query if query is not None else Playlist.query
        return base_query.options(
            selectinload(Playlist.items).selectinload(PlaylistVideo.video).selectinload(Video.creator),
            selectinload(Playlist.items).selectinload(PlaylistVideo.video).selectinload(Video.comments),
            selectinload(Playlist.items).selectinload(PlaylistVideo.video).selectinload(Video.likes),
        )

    @staticmethod
    def _normalize_playlist_positions(playlist):
        ordered_items = sorted(playlist.items, key=lambda item: (item.position, item.added_at, item.id))
        changed = False

        for position, item in enumerate(ordered_items, start=1):
            if item.position != position:
                item.position = position
                changed = True

        if changed:
            playlist.updated_at = datetime.now(UTC)

        return changed

    @staticmethod
    def _parse_position(position, max_allowed):
        try:
            normalized_position = int(position)
        except (TypeError, ValueError):
            return None, "position must be a positive integer"

        if normalized_position < 1:
            return None, "position must be a positive integer"

        return min(normalized_position, max_allowed), None

    @staticmethod
    def list_playlists(user_id):
        playlists = (
            PlaylistService._query_with_relations(Playlist.query.filter_by(user_id=user_id))
            .order_by(Playlist.updated_at.desc())
            .all()
        )

        changed = False
        for playlist in playlists:
            changed = PlaylistService._normalize_playlist_positions(playlist) or changed
        if changed:
            db.session.commit()

        return playlists

    @staticmethod
    def create_playlist(user_id, title, description=None, is_default=False):
        user = db.session.get(User, user_id)
        if not user:
            return None, "User not found"

        normalized_title = (title or "").strip()
        if len(normalized_title) < 3:
            return None, "Playlist title must be at least 3 characters"

        playlist = Playlist(
            user_id=user_id,
            title=normalized_title,
            description=(description or "").strip() or None,
            is_default=bool(is_default),
        )
        db.session.add(playlist)
        db.session.commit()
        return playlist, None

    @staticmethod
    def get_playlist_for_user(playlist_id, user_id):
        playlist = PlaylistService._query_with_relations(
            Playlist.query.filter_by(id=playlist_id, user_id=user_id)
        ).first()
        if not playlist:
            return None, "Playlist not found"

        if PlaylistService._normalize_playlist_positions(playlist):
            db.session.commit()
        return playlist, None

    @staticmethod
    def update_playlist(playlist, title=None, description=None):
        if title is not None:
            normalized_title = title.strip()
            if len(normalized_title) < 3:
                return None, "Playlist title must be at least 3 characters"
            playlist.title = normalized_title

        if description is not None:
            playlist.description = description.strip() or None

        playlist.updated_at = datetime.now(UTC)
        db.session.commit()
        return playlist, None

    @staticmethod
    def _reindex_items(playlist, ordered_video_ids):
        lookup = {item.video_id: item for item in playlist.items}

        for position, video_id in enumerate(ordered_video_ids, start=1):
            lookup[video_id].position = position

        playlist.updated_at = datetime.now(UTC)

    @staticmethod
    def add_video_to_playlist(playlist, video_id, position=None):
        try:
            normalized_video_id = int(video_id)
        except (TypeError, ValueError):
            return None, "video_id must be an integer"

        video = db.session.get(Video, normalized_video_id)
        if not video:
            return None, "Video not found"

        ordered_ids = [item.video_id for item in sorted(playlist.items, key=lambda item: item.position)]
        existing_item = next((item for item in playlist.items if item.video_id == normalized_video_id), None)

        if position is None and existing_item:
            if PlaylistService._normalize_playlist_positions(playlist):
                db.session.commit()
            return playlist, None

        ordered_ids = [current_id for current_id in ordered_ids if current_id != normalized_video_id]

        if position is None:
            insert_index = len(ordered_ids)
        else:
            normalized_position, error = PlaylistService._parse_position(position, len(ordered_ids) + 1)
            if error:
                return None, error
            insert_index = normalized_position - 1

        ordered_ids.insert(insert_index, normalized_video_id)

        if not existing_item:
            existing_item = PlaylistVideo(
                playlist_id=playlist.id,
                video_id=normalized_video_id,
                position=len(ordered_ids),
            )
            db.session.add(existing_item)
            playlist.items.append(existing_item)

        PlaylistService._reindex_items(playlist, ordered_ids)
        db.session.commit()
        return playlist, None

    @staticmethod
    def remove_video_from_playlist(playlist, video_id):
        try:
            normalized_video_id = int(video_id)
        except (TypeError, ValueError):
            return None, "video_id must be an integer"

        item = next((item for item in playlist.items if item.video_id == normalized_video_id), None)
        if not item:
            return None, "Video is not in this playlist"

        db.session.delete(item)
        db.session.flush()

        remaining_ids = [
            entry.video_id
            for entry in sorted(playlist.items, key=lambda current: current.position)
            if entry.video_id != normalized_video_id
        ]
        PlaylistService._reindex_items(playlist, remaining_ids)
        db.session.commit()
        return playlist, None

    @staticmethod
    def reorder_playlist_videos(playlist, video_ids):
        existing_ids = [item.video_id for item in sorted(playlist.items, key=lambda item: item.position)]
        try:
            normalized_ids = [int(video_id) for video_id in (video_ids or [])]
        except (TypeError, ValueError):
            return None, "video_ids must be integers"

        if len(existing_ids) != len(normalized_ids) or set(existing_ids) != set(normalized_ids):
            return None, "video_ids must include every playlist video exactly once"

        PlaylistService._reindex_items(playlist, normalized_ids)
        db.session.commit()
        return playlist, None

    @staticmethod
    def delete_playlist(playlist):
        if playlist.is_default:
            return "Default playlists cannot be deleted"

        db.session.delete(playlist)
        db.session.commit()
        return None
