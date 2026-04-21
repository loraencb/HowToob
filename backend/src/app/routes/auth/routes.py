from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, current_user
from ...services.auth import AuthService

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    required_fields = ["username", "email", "password"]
    missing = [field for field in required_fields if field not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    user, error = AuthService.register(
        username=data["username"],
        email=data["email"],
        password=data["password"],
        role=data.get("role", "viewer"),
    )
    if error:
        return jsonify({"error": error}), 400

    return jsonify({
        "message": "User registered successfully",
        "user": user.to_dict()
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    if current_user.is_authenticated:
        logout_user()

    required_fields = ["email", "password"]
    missing = [field for field in required_fields if field not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    user, error = AuthService.login(data["email"], data["password"])
    if error:
        return jsonify({"error": error}), 401

    login_user(user)
    return jsonify({
        "message": "Login successful",
        "user": user.to_dict()
    }), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    if not current_user.is_authenticated:
        return jsonify({"error": "No user is currently logged in"}), 401

    logout_user()
    return jsonify({"message": "Logout successful"}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    if not current_user.is_authenticated:
        return jsonify({"authenticated": False}), 401

    return jsonify({
        "authenticated": True,
        "user": current_user.to_dict()
    }), 200
