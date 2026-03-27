from src.app.models.user import User
from src.app.extensions import db
from flask_login import login_user, logout_user


class AuthService:

    @staticmethod
    def register_user(username, email, password):
        if not username or not email or not password:
            return {"error": "Missing required fields"}, 400

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return {"error": "Email already exists"}, 400

        existing_username = User.query.filter_by(username=username).first()
        if existing_username:
            return {"error": "Username already exists"}, 400

        user = User(
            username=username,
            email=email,
            role="viewer",
        )
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        return {
            "message": "User registered successfully",
            "user": user.to_dict(),
        }, 201

    @staticmethod
    def login_user(email, password):
        if not email or not password:
            return {"error": "Missing required fields"}, 400

        user = User.query.filter_by(email=email).first()

        if not user or not user.check_password(password):
            return {"error": "Invalid email or password"}, 401

        login_user(user)

        return {
            "message": "Login successful",
            "user": user.to_dict(),
        }, 200

    @staticmethod
    def logout_user():
        logout_user()
        return {"message": "Logout successful"}, 200