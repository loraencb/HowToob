from flask import Blueprint, current_app, jsonify, redirect, request, send_from_directory
from flask_login import current_user, login_required
from ...extensions import db
from ...models.user import User
from ...services.social import SocialService
from ...services.user import UserService
from ...utils.file_handler import (
    ALLOWED_IMAGE_EXTENSIONS,
    StorageError,
    allowed_file,
    build_storage_access_url,
    delete_stored_file,
    is_remote_storage_path,
    save_file,
)

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


@user_bp.route("/me/profile-picture", methods=["PUT"])
@login_required
def update_my_profile_picture():
    profile_file = request.files.get("profile_picture") or request.files.get("avatar")

    if not profile_file or not profile_file.filename:
        return jsonify({"error": "Profile picture file is required"}), 400

    if not allowed_file(profile_file.filename, ALLOWED_IMAGE_EXTENSIONS):
        return jsonify({"error": "Profile picture must be a PNG or JPG image"}), 400

    saved_path, error = save_file(
        profile_file,
        current_app.config["PROFILE_IMAGE_UPLOAD_FOLDER"],
    )
    if error:
        return jsonify({"error": error}), 500

    old_profile_image_path = current_user.profile_image_path
    current_user.profile_image_path = saved_path
    db.session.commit()

    if old_profile_image_path and old_profile_image_path != saved_path:
        try:
            delete_stored_file(old_profile_image_path)
        except StorageError:
            current_app.logger.warning(
                "Could not delete old profile picture for user %s",
                current_user.id,
                exc_info=True,
            )

    return jsonify({
        "message": "Profile picture updated",
        "user": current_user.to_dict(),
    }), 200


@user_bp.route("/me/profile-picture", methods=["DELETE"])
@login_required
def delete_my_profile_picture():
    old_profile_image_path = current_user.profile_image_path

    if not old_profile_image_path:
        return jsonify({
            "message": "No profile picture to remove",
            "user": current_user.to_dict(),
        }), 200

    current_user.profile_image_path = None
    db.session.commit()

    try:
        delete_stored_file(old_profile_image_path)
    except StorageError:
        current_app.logger.warning(
            "Could not delete profile picture for user %s",
            current_user.id,
            exc_info=True,
        )

    return jsonify({
        "message": "Profile picture removed",
        "user": current_user.to_dict(),
    }), 200


@user_bp.route("/profile/<identifier>", methods=["GET"])
def get_profile(identifier):
    payload, error = UserService.get_profile(identifier)

    if error:
        return jsonify({"error": error}), 404

    return jsonify(payload), 200


@user_bp.route("/files/profile-pictures/<filename>")
def serve_profile_picture(filename):
    profile_owner = (
        User.query
        .filter(User.profile_image_path.like(f"%{filename}"))
        .order_by(User.id.desc())
        .first()
    )

    if profile_owner and is_remote_storage_path(profile_owner.profile_image_path):
        try:
            return redirect(build_storage_access_url(profile_owner.profile_image_path), code=302)
        except StorageError as exc:
            return jsonify({"error": str(exc)}), 502

    return send_from_directory(
        current_app.config["PROFILE_IMAGE_UPLOAD_FOLDER"],
        filename,
    )
