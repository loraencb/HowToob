from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from ...services.social.service import SocialService

social_bp = Blueprint("social", __name__, url_prefix="/social")


@social_bp.route("/comments", methods=["POST"])
@login_required
def add_comment():
    data = request.get_json() or {}
    required_fields = ["content", "video_id"]
    missing = [field for field in required_fields if field not in data]

    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    comment, error = SocialService.add_comment(
        content=data["content"],
        user_id=current_user.id,
        video_id=data["video_id"],
    )

    if error:
        return jsonify({"error": error}), 404

    return jsonify(comment.to_dict()), 201


@social_bp.route("/comments/<int:video_id>", methods=["GET"])
def get_comments(video_id):
    comments, error = SocialService.get_comments_by_video(video_id)

    if error:
        return jsonify({"error": error}), 404

    return jsonify([comment.to_dict() for comment in comments]), 200


@social_bp.route("/likes/toggle", methods=["POST"])
@login_required
def toggle_like():
    data = request.get_json() or {}
    required_fields = ["video_id"]
    missing = [field for field in required_fields if field not in data]

    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    result, error = SocialService.toggle_like(
        user_id=current_user.id,
        video_id=data["video_id"],
    )

    if error:
        return jsonify({"error": error}), 404

    return jsonify(result), 200


@social_bp.route("/subscribe", methods=["POST"])
@login_required
def subscribe():
    data = request.get_json() or {}
    required_fields = ["creator_id"]
    missing = [field for field in required_fields if field not in data]

    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    subscription, error = SocialService.subscribe(
        subscriber_id=current_user.id,
        creator_id=data["creator_id"],
    )

    if error:
        return jsonify({"error": error}), 400

    return jsonify({
        "id": subscription.id,
        "subscriber_id": subscription.subscriber_id,
        "creator_id": subscription.creator_id,
    }), 201