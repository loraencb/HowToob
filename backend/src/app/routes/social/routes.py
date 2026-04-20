from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from ...services.admin import AdminService
from ...services.social import SocialService

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
        parent_id=data.get("parent_id"),
    )

    if error:
        status = 404 if error in {"User not found", "Video not found", "Parent comment not found"} else 400
        return jsonify({"error": error}), status

    return jsonify(comment.to_dict()), 201


@social_bp.route("/comments/<int:video_id>", methods=["GET"])
def get_comments(video_id):
    comments, error = SocialService.get_comments_by_video(video_id)

    if error:
        return jsonify({"error": error}), 404

    viewer_id = current_user.id if current_user.is_authenticated else None
    return jsonify([comment.to_dict(viewer_id=viewer_id) for comment in comments]), 200


@social_bp.route("/comments/<int:comment_id>/likes/toggle", methods=["POST"])
@login_required
def toggle_comment_like(comment_id):
    result, error = SocialService.toggle_comment_like(
        user_id=current_user.id,
        comment_id=comment_id,
    )

    if error:
        status = 404 if error in {"User not found", "Comment not found"} else 400
        return jsonify({"error": error}), status

    return jsonify(result), 200


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


@social_bp.route("/ratings", methods=["POST"])
@login_required
def set_video_rating():
    data = request.get_json() or {}
    required_fields = ["video_id", "rating"]
    missing = [field for field in required_fields if field not in data]

    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    result, error = SocialService.set_video_rating(
        user_id=current_user.id,
        video_id=data["video_id"],
        rating=data["rating"],
    )

    if error:
        status = 404 if error in {"User not found", "Video not found"} else 400
        return jsonify({"error": error}), status

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
        tier_level=data.get("tier_level", 0),
    )

    if error:
        return jsonify({"error": error}), 400

    return jsonify({
        "id": subscription.id,
        "subscriber_id": subscription.subscriber_id,
        "creator_id": subscription.creator_id,
        "tier_level": subscription.tier_level,
    }), 201


@social_bp.route("/reports", methods=["POST"])
@login_required
def submit_report():
    data = request.get_json() or {}
    required_fields = ["target_type", "target_id", "reason"]
    missing = [field for field in required_fields if field not in data]

    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    report, error = AdminService.submit_report(
        reporter_id=current_user.id,
        target_type=data["target_type"],
        target_id=data["target_id"],
        reason=data["reason"],
        details=data.get("details"),
        label=data.get("label"),
        video_id=data.get("video_id"),
    )

    if error:
        if error == "Duplicate report already exists":
            return jsonify({"error": error, "code": "DUPLICATE_REPORT"}), 409
        status = 404 if error in {"Video not found", "Comment not found", "Reporter not found"} else 400
        return jsonify({"error": error}), status

    return jsonify(report.to_dict()), 201
