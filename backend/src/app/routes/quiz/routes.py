from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from ...services.quiz import QuizService
from ...services.video import VideoService

quiz_bp = Blueprint("quiz", __name__, url_prefix="/videos")


@quiz_bp.route("/<int:video_id>/quiz", methods=["GET"])
@login_required
def get_quiz(video_id):
    video = VideoService.get_video_by_id(video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    access_context = VideoService.get_access_context(video, current_user)
    if not access_context["has_access"]:
        return jsonify(VideoService.build_access_denied_payload(video, access_context)), 403

    payload, error = QuizService.get_quiz(current_user.id, video_id, video=video)
    if error:
        status = 404 if error in {"User not found", "Video not found", "Quiz unavailable for this lesson"} else 400
        return jsonify({"error": error}), status

    return jsonify(payload), 200


@quiz_bp.route("/<int:video_id>/quiz", methods=["PUT"])
@login_required
def upsert_quiz(video_id):
    data = request.get_json() or {}

    payload, error = QuizService.upsert_quiz_definition(
        actor_id=current_user.id,
        video_id=video_id,
        title=data.get("title"),
        description=data.get("description"),
        questions=data.get("questions"),
    )
    if error:
        if error in {"User not found", "Video not found"}:
            return jsonify({"error": error}), 404
        if error == "You can only manage quizzes for your own videos":
            return jsonify({"error": error}), 403
        return jsonify({"error": error}), 400

    return jsonify(payload), 200


@quiz_bp.route("/<int:video_id>/quiz/submissions", methods=["POST"])
@login_required
def submit_quiz(video_id):
    data = request.get_json() or {}
    video = VideoService.get_video_by_id(video_id)
    if not video:
        return jsonify({"error": "Video not found"}), 404

    access_context = VideoService.get_access_context(video, current_user)
    if not access_context["has_access"]:
        return jsonify(VideoService.build_access_denied_payload(video, access_context)), 403

    payload, error = QuizService.submit_quiz(
        current_user.id,
        video_id,
        answers=data.get("answers"),
        video=video,
    )
    if error:
        status = 404 if error in {"User not found", "Video not found", "Quiz unavailable for this lesson"} else 400
        return jsonify({"error": error}), status

    return jsonify(payload), 201
