from ...extensions import db
from ...models.user import User


class AuthService:
    @staticmethod
    def register(username, email, password, role="viewer"):
        if User.query.filter_by(username=username).first():
            return None, "Username already exists"

        if User.query.filter_by(email=email).first():
            return None, "Email already exists"

        user = User(username=username, email=email, password_hash="", role=role)
        user.set_password(password)

        db.session.add(user)
        db.session.commit()
        return user, None

    @staticmethod
    def login(email, password):
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return None, "Invalid email or password"
        return user, None
