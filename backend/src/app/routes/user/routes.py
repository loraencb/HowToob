from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from ...services.social import SocialService
from ...services.user import UserService

user_bp = Blueprint("user", __name__, url_prefix="/users")


@user_bp.route("/<int:user_id>/subscriptions", methods=["GET"])
def get_user_subscriptions(user_id):
    subscriptions, error = SocialService.get_creator_subscriptions(user_id)

    if error:
        return jsonify({"error": error}), 404

    return jsonify([
        {
            "id": sub.id,
            "subscriber_id": sub.subscriber_id,
            "creator_id": sub.creator_id,
            "tier_level": sub.tier_level,
            "creator": sub.creator.to_public_dict(include_counts=True) if getattr(sub, "creator", None) else None,
        }
        for sub in subscriptions
    ]), 200


@user_bp.route("/me/ratings", methods=["GET"])
@login_required
def get_my_ratings():
    limit = request.args.get("limit", type=int)
    payload, error = SocialService.get_user_rated_videos(
        user_id=current_user.id,
        limit=limit,
    )

    if error:
        return jsonify({"error": error}), 404

    return jsonify(payload), 200


@user_bp.route("/profile/<identifier>", methods=["GET"])
def get_profile(identifier):
    payload, error = UserService.get_profile(identifier)

    if error:
        return jsonify({"error": error}), 404

    return jsonify(payload), 200
