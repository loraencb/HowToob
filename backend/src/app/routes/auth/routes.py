from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from src.app.services.auth.service import AuthService

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    return AuthService.register_user(
        data.get("username"),
        data.get("email"),
        data.get("password"),
    )


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    return AuthService.login_user(
        data.get("email"),
        data.get("password"),
    )


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    return AuthService.logout_user()


@auth_bp.route("/me", methods=["GET"])
def me():
    if not current_user.is_authenticated:
        return jsonify({"authenticated": False}), 401

    return jsonify({
        "authenticated": True,
        "user": current_user.to_dict(),
    }), 200

