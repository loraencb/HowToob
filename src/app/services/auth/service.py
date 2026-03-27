from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, current_user
from src.app.models.user import User
from src.app.extensions import db

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

class AuthService:

    @staticmethod
    def register_user(username, email, password):
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return {"error": "Email already exists"}, 400

        hashed_password = generate_password_hash(password)

        user = User(
            username=username,
            email=email,
            password=hashed_password
        )

        db.session.add(user)
        db.session.commit()

        return {"message": "User registered successfully"}, 201

    @staticmethod
    def login_user(email, password):
        user = User.query.filter_by(email=email).first()

        if not user or not check_password_hash(user.password, password):
            return {"error": "Invalid credentials"}, 401

        login_user(user)
        return {"message": "Login successful"}, 200

    @staticmethod
    def logout_user():
        logout_user()
        return {"message": "Logged out successfully"}, 200
    

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    required_fields = ["username", "email", "password"]
    missing = [field for field in required_fields if not data.get(field)]
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

    return jsonify(
        {
            "message": "User registered successfully",
            "user": user.to_dict(),
        }
    ), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    required_fields = ["email", "password"]
    missing = [field for field in required_fields if not data.get(field)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    user, error = AuthService.login(data["email"], data["password"])
    if error:
        return jsonify({"error": error}), 401

    login_user(user)
    return jsonify(
        {
            "message": "Login successful",
            "user": user.to_dict(),
        }
    ), 200


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

    return jsonify(
        {
            "authenticated": True,
            "user": current_user.to_dict(),
        }
    ), 200