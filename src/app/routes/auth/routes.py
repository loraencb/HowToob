from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from src.app.services.auth.service import AuthService

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    return AuthService.register_user(
        data.get("username"),
        data.get("email"),
        data.get("password")
    )


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    return AuthService.login_user(
        data.get("email"),
        data.get("password")
    )


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    return AuthService.logout_user()


@auth_bp.route("/me", methods=["GET"])
def me():
    if not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username
    }), 200