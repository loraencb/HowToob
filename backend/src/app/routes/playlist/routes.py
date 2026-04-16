from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from ...services.playlist import PlaylistService

playlist_bp = Blueprint("playlist", __name__, url_prefix="/users/me/playlists")


@playlist_bp.route("", methods=["GET"])
@login_required
def list_playlists():
    playlists = PlaylistService.list_playlists(current_user.id)
    return jsonify([playlist.to_dict() for playlist in playlists]), 200


@playlist_bp.route("", methods=["POST"])
@login_required
def create_playlist():
    data = request.get_json() or {}

    playlist, error = PlaylistService.create_playlist(
        user_id=current_user.id,
        title=data.get("title"),
        description=data.get("description"),
        is_default=data.get("is_default", False),
    )

    if error:
        status = 404 if error == "User not found" else 400
        return jsonify({"error": error}), status

    return jsonify(playlist.to_dict(include_items=True)), 201


@playlist_bp.route("/<int:playlist_id>", methods=["GET"])
@login_required
def get_playlist_detail(playlist_id):
    playlist, error = PlaylistService.get_playlist_for_user(playlist_id, current_user.id)
    if error:
        return jsonify({"error": error}), 404

    return jsonify(playlist.to_dict(include_items=True)), 200


@playlist_bp.route("/<int:playlist_id>", methods=["PUT"])
@login_required
def update_playlist(playlist_id):
    playlist, error = PlaylistService.get_playlist_for_user(playlist_id, current_user.id)
    if error:
        return jsonify({"error": error}), 404

    data = request.get_json() or {}
    updated, error = PlaylistService.update_playlist(
        playlist,
        title=data.get("title"),
        description=data.get("description"),
    )
    if error:
        return jsonify({"error": error}), 400

    return jsonify(updated.to_dict(include_items=True)), 200


@playlist_bp.route("/<int:playlist_id>/videos", methods=["POST"])
@login_required
def add_video_to_playlist(playlist_id):
    playlist, error = PlaylistService.get_playlist_for_user(playlist_id, current_user.id)
    if error:
        return jsonify({"error": error}), 404

    data = request.get_json() or {}
    video_id = data.get("video_id")
    if video_id is None:
        return jsonify({"error": "video_id is required"}), 400

    updated, error = PlaylistService.add_video_to_playlist(
        playlist,
        video_id=video_id,
        position=data.get("position"),
    )
    if error:
        status = 404 if error == "Video not found" else 400
        return jsonify({"error": error}), status

    return jsonify(updated.to_dict(include_items=True)), 200


@playlist_bp.route("/<int:playlist_id>/videos/<int:video_id>", methods=["DELETE"])
@login_required
def remove_video_from_playlist(playlist_id, video_id):
    playlist, error = PlaylistService.get_playlist_for_user(playlist_id, current_user.id)
    if error:
        return jsonify({"error": error}), 404

    updated, error = PlaylistService.remove_video_from_playlist(playlist, video_id)
    if error:
        return jsonify({"error": error}), 404

    return jsonify(updated.to_dict(include_items=True)), 200


@playlist_bp.route("/<int:playlist_id>/videos/reorder", methods=["PUT"])
@login_required
def reorder_playlist_videos(playlist_id):
    playlist, error = PlaylistService.get_playlist_for_user(playlist_id, current_user.id)
    if error:
        return jsonify({"error": error}), 404

    data = request.get_json() or {}
    updated, error = PlaylistService.reorder_playlist_videos(
        playlist,
        video_ids=data.get("video_ids"),
    )
    if error:
        return jsonify({"error": error}), 400

    return jsonify(updated.to_dict(include_items=True)), 200


@playlist_bp.route("/<int:playlist_id>", methods=["DELETE"])
@login_required
def delete_playlist(playlist_id):
    playlist, error = PlaylistService.get_playlist_for_user(playlist_id, current_user.id)
    if error:
        return jsonify({"error": error}), 404

    error = PlaylistService.delete_playlist(playlist)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Playlist deleted"}), 200
