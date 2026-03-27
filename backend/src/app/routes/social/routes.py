from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ...services.social.service import SocialService

social_bp = Blueprint("social", __name__, url_prefix="/social")
users_bp = Blueprint("users_social", __name__, url_prefix="/users")


@social_bp.route("/comments", methods=["POST"])
@login_required
def add_comment():
    data = request.get_json() or {}

    content = (data.get("content") or "").strip()
    video_id = data.get("video_id")

    if not content:
        return jsonify({"error": "Comment content is required"}), 400
    if video_id is None:
        return jsonify({"error": "video_id is required"}), 400

    comment, error = SocialService.add_comment(
        content=content,
        user_id=current_user.id,
        video_id=video_id,
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
    video_id = data.get("video_id")

    if video_id is None:
        return jsonify({"error": "video_id is required"}), 400

    result, error = SocialService.toggle_like(
        user_id=current_user.id,
        video_id=video_id,
    )
    if error:
        return jsonify({"error": error}), 404

    return jsonify(result), 200


@social_bp.route("/likes/<int:video_id>", methods=["GET"])
def get_like_status(video_id):
    result, error = SocialService.get_video_like_summary(
        video_id=video_id,
        user_id=current_user.id if current_user.is_authenticated else None,
    )
    if error:
        return jsonify({"error": error}), 404

    return jsonify(result), 200


@social_bp.route("/subscribe", methods=["POST"])
@login_required
def subscribe():
    data = request.get_json() or {}
    creator_id = data.get("creator_id")

    if creator_id is None:
        return jsonify({"error": "creator_id is required"}), 400

    subscription, error = SocialService.subscribe(
        subscriber_id=current_user.id,
        creator_id=creator_id,
    )
    if error:
        return jsonify({"error": error}), 400

    return jsonify(
        {
            "id": subscription.id,
            "subscriber_id": subscription.subscriber_id,
            "creator_id": subscription.creator_id,
        }
    ), 201


@users_bp.route("/<int:user_id>/subscriptions", methods=["GET"])
def get_user_subscriptions(user_id):
    subscriptions, error = SocialService.get_creator_subscriptions(user_id)
    if error:
        return jsonify({"error": error}), 404

    return jsonify(
        [
            {
                "id": sub.id,
                "subscriber_id": sub.subscriber_id,
                "creator_id": sub.creator_id,
            }
            for sub in subscriptions
        ]
    ), 200