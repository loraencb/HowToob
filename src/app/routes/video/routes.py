from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from ...services.video.service import VideoService
from ...services.social.service import SocialService

video_bp = Blueprint("video", __name__, url_prefix="/videos")


@video_bp.route("/", methods=["GET"])
def list_videos():
    videos = VideoService.get_all_videos()
    return jsonify([video.to_dict() for video in videos]), 200


@video_bp.route("/feed", methods=["GET"])
def get_feed():
    videos = VideoService.get_all_videos()
    published_videos = [video.to_dict() for video in videos if video.is_published]
    return jsonify(published_videos), 200


@video_bp.route("/creator/<int:user_id>", methods=["GET"])
def get_creator_videos(user_id):
    videos, error = VideoService.get_videos_by_creator(user_id)

    if error:
        return jsonify({"error": error}), 404

    return jsonify([video.to_dict() for video in videos]), 200


@video_bp.route("/<int:video_id>", methods=["GET"])
def get_video(video_id):
    video = VideoService.get_video_by_id(video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    VideoService.increment_views(video)
    return jsonify(video.to_dict()), 200


@video_bp.route("/<int:video_id>/stats", methods=["GET"])
def get_video_stats(video_id):
    stats, error = SocialService.get_video_stats(video_id)

    if error:
        return jsonify({"error": error}), 404

    return jsonify(stats), 200


@video_bp.route("/", methods=["POST"])
@login_required
def create_video():
    data = request.get_json() or {}

    required_fields = ["title", "file_path"]
    missing = [field for field in required_fields if field not in data]

    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    video, error = VideoService.create_video(
        title=data["title"],
        description=data.get("description"),
        file_path=data["file_path"],
        thumbnail_path=data.get("thumbnail_path"),
        creator_id=current_user.id,
    )

    if error:
        return jsonify({"error": error}), 404

    return jsonify(video.to_dict()), 201


@video_bp.route("/<int:video_id>", methods=["PUT"])
@login_required
def update_video(video_id):
    video = VideoService.get_video_by_id(video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    if video.creator_id != current_user.id:
        return jsonify({"error": "You can only update your own videos"}), 403

    data = request.get_json() or {}
    updated = VideoService.update_video(
        video,
        title=data.get("title"),
        description=data.get("description"),
        thumbnail_path=data.get("thumbnail_path"),
    )

    return jsonify(updated.to_dict()), 200


@video_bp.route("/<int:video_id>", methods=["DELETE"])
@login_required
def delete_video(video_id):
    video = VideoService.get_video_by_id(video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    if video.creator_id != current_user.id:
        return jsonify({"error": "You can only delete your own videos"}), 403

    VideoService.delete_video(video)
    return jsonify({"message": "Video deleted"}), 200