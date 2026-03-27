from flask import Flask, jsonify

from .extensions import db, login_manager
from .models.user import User


def create_app():
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SECRET_KEY"] = "test-secret"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({"error": "Authentication required"}), 401

    from .routes.auth.routes import auth_bp
    from .routes.video.routes import video_bp
    from .routes.social.routes import social_bp, users_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(video_bp)
    app.register_blueprint(social_bp)
    app.register_blueprint(users_bp)

    @app.route("/", methods=["GET"])
    def home():
        return jsonify({"message": "HowTube backend is running"}), 200

    with app.app_context():
        db.create_all()

    return app