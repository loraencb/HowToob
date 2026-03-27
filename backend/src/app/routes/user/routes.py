from flask import Blueprint, jsonify
from ...services.social.service import SocialService

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
        }
        for sub in subscriptions
    ]), 200