from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from ...services.progress import ProgressService
from ...services.video import VideoService

progress_bp = Blueprint("progress", __name__, url_prefix="/users/me/progress")


@progress_bp.route("", methods=["GET"])
@login_required
def get_progress():
    status = request.args.get("status")
    limit = request.args.get("limit", type=int)

    payload = ProgressService.get_user_progress(
        user_id=current_user.id,
        status=status,
        limit=limit,
    )
    return jsonify(payload), 200


@progress_bp.route("", methods=["POST"])
@login_required
def upsert_progress():
    data = request.get_json() or {}

    video_id = data.get("video_id")
    if video_id is None:
        return jsonify({"error": "video_id is required"}), 400

    video = VideoService.get_video_by_id(video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    access_context = VideoService.get_access_context(video, current_user)
    if not access_context["has_access"]:
        return jsonify(VideoService.build_access_denied_payload(video, access_context)), 403

    progress, error = ProgressService.upsert_progress(
        user_id=current_user.id,
        video_id=video_id,
        watched_seconds=data.get("watched_seconds"),
        duration_seconds=data.get("duration_seconds"),
        percent_complete=data.get("percent_complete"),
        completed=data.get("completed"),
    )

    if error:
        status = 404 if error in {"User not found", "Video not found"} else 400
        return jsonify({"error": error}), status

    return jsonify(progress.to_dict()), 200
