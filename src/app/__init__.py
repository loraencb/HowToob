from flask import Flask
from .extensions import db, login_manager


def create_app():
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SECRET_KEY"] = "test-secret"

    db.init_app(app)
    login_manager.init_app(app)

    from .routes.auth.routes import auth_bp
    from .routes.video.routes import video_bp
    from .routes.social.routes import social_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(video_bp)
    app.register_blueprint(social_bp)

    with app.app_context():
        db.create_all()

    return app