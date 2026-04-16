from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_login import login_required, current_user
import os
from ...utils.file_handler import save_file, allowed_file, ALLOWED_VIDEO_EXTENSIONS, ALLOWED_IMAGE_EXTENSIONS
from ...services.progress import ProgressService
from ...services.social import SocialService
from ...services.video import VideoService

video_bp = Blueprint("video", __name__, url_prefix="/videos")


@video_bp.route("/", methods=["GET"])
def list_videos():
    videos = VideoService.get_all_videos()
    return jsonify([video.to_dict() for video in videos]), 200

@video_bp.route("/", methods=["POST"])
@login_required
def create_video():
    data = request.get_json() or {}

    title = data.get("title")
    description = data.get("description")
    file_path = data.get("file_path")

    if not title or not file_path:
        return jsonify({"error": "Title and file_path required"}), 400

    video, error = VideoService.create_video(
        title=title,
        description=description,
        file_path=file_path,
        creator_id=current_user.id,
        category=data.get("category"),
        learning_level=data.get("learning_level"),
        access_tier=data.get("access_tier", 0),
    )

    if error:
        status = 404 if error == "Creator not found" else 400
        return jsonify({"error": error}), status

    return jsonify(video.to_dict()), 201


@video_bp.route("/feed", methods=["GET"])
def get_feed():
    page = request.args.get("page", default=1, type=int)
    limit = request.args.get("limit", default=10, type=int)
    search = request.args.get("search", default=None, type=str)

    if page < 1:
        return jsonify({"error": "Page must be at least 1"}), 400

    if limit < 1 or limit > 100:
        return jsonify({"error": "Limit must be between 1 and 100"}), 400

    feed_data = VideoService.get_feed(page=page, limit=limit, search=search)
    return jsonify(feed_data), 200


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

    viewer = current_user if current_user.is_authenticated else None
    access_context = VideoService.get_access_context(video, viewer)
    if not access_context["has_access"]:
        return jsonify(VideoService.build_access_denied_payload(video, access_context)), 403

    VideoService.increment_views(video)
    return jsonify(video.to_dict(access_context=access_context)), 200


@video_bp.route("/<int:video_id>/stats", methods=["GET"])
def get_video_stats(video_id):
    stats, error = SocialService.get_video_stats(video_id)

    if error:
        return jsonify({"error": error}), 404

    return jsonify(stats), 200


@video_bp.route("/upload", methods=["POST"])
@login_required
def upload_video():
    if "video" not in request.files:
        return jsonify({"error": "Video file is required"}), 400

    video_file = request.files["video"]
    thumbnail_file = request.files.get("thumbnail")

    title = request.form.get("title")
    description = request.form.get("description")
    category = request.form.get("category")
    learning_level = request.form.get("learning_level")
    access_tier = request.form.get("access_tier", 0)

    if not title:
        return jsonify({"error": "Title is required"}), 400

    # Validate video
    if not allowed_file(video_file.filename, ALLOWED_VIDEO_EXTENSIONS):
        return jsonify({"error": "Invalid video format"}), 400

    video_path, err = save_file(
        video_file,
        current_app.config["VIDEO_UPLOAD_FOLDER"]
    )
    if err:
        return jsonify({"error": err}), 400

    thumbnail_path = None
    if thumbnail_file:
        if not allowed_file(thumbnail_file.filename, ALLOWED_IMAGE_EXTENSIONS):
            return jsonify({"error": "Invalid thumbnail format"}), 400

        thumbnail_path, err = save_file(
            thumbnail_file,
            current_app.config["THUMBNAIL_UPLOAD_FOLDER"]
        )
        if err:
            return jsonify({"error": err}), 400

    video, error = VideoService.create_video(
        title=title,
        description=description,
        file_path=video_path,
        thumbnail_path=thumbnail_path,
        creator_id=current_user.id,
        category=category,
        learning_level=learning_level,
        access_tier=access_tier,
    )

    if error:
        status = 404 if error == "Creator not found" else 400
        return jsonify({"error": error}), status

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
    try:
        updated = VideoService.update_video(
            video,
            title=data.get("title"),
            description=data.get("description"),
            thumbnail_path=data.get("thumbnail_path"),
            category=data.get("category"),
            learning_level=data.get("learning_level"),
            access_tier=data.get("access_tier"),
            is_published=data.get("is_published"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

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


@video_bp.route("/<int:video_id>/watch-events", methods=["POST"])
@login_required
def record_watch_event(video_id):
    video = VideoService.get_video_by_id(video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    access_context = VideoService.get_access_context(video, current_user)
    if not access_context["has_access"]:
        return jsonify(VideoService.build_access_denied_payload(video, access_context)), 403

    data = request.get_json() or {}
    progress, error = ProgressService.record_watch_event(
        user_id=current_user.id,
        video_id=video_id,
        watched_seconds=data.get("watched_seconds"),
        duration_seconds=data.get("duration_seconds"),
        percent_complete=data.get("percent_complete"),
    )

    if error:
        status = 404 if error in {"User not found", "Video not found"} else 400
        return jsonify({"error": error}), status

    return jsonify({
        "event": "watch_progress_updated",
        "progress": progress.to_dict(include_video=False),
    }), 200

@video_bp.route("/files/videos/<filename>")
def serve_video(filename):
    video = VideoService.get_video_by_filename(filename)
    if video:
        viewer = current_user if current_user.is_authenticated else None
        access_context = VideoService.get_access_context(video, viewer)
        if not access_context["has_access"]:
            return jsonify(VideoService.build_access_denied_payload(video, access_context)), 403

    return send_from_directory(
        current_app.config["VIDEO_UPLOAD_FOLDER"],
        filename
    )


@video_bp.route("/files/thumbnails/<filename>")
def serve_thumbnail(filename):
    return send_from_directory(
        current_app.config["THUMBNAIL_UPLOAD_FOLDER"],
        filename
    )
