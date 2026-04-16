from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy import inspect, text
from .config import Config
from .extensions import db, login_manager, migrate

SCHEMA_PATCHES = {
    "users": {
        "role": {
            "alter_sql": "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'viewer'",
            "backfill_sql": "UPDATE users SET role = 'viewer' WHERE role IS NULL OR TRIM(role) = ''",
        },
    },
    "subscriptions": {
        "tier_level": {
            "alter_sql": "ALTER TABLE subscriptions ADD COLUMN tier_level INTEGER NOT NULL DEFAULT 0",
            "backfill_sql": "UPDATE subscriptions SET tier_level = 0 WHERE tier_level IS NULL",
        },
    },
    "comments": {
        "parent_id": {
            "alter_sql": "ALTER TABLE comments ADD COLUMN parent_id INTEGER",
        },
    },
    "videos": {
        "category": {
            "alter_sql": "ALTER TABLE videos ADD COLUMN category VARCHAR(80)",
        },
        "learning_level": {
            "alter_sql": "ALTER TABLE videos ADD COLUMN learning_level VARCHAR(30)",
        },
        "access_tier": {
            "alter_sql": "ALTER TABLE videos ADD COLUMN access_tier INTEGER NOT NULL DEFAULT 0",
            "backfill_sql": "UPDATE videos SET access_tier = 0 WHERE access_tier IS NULL",
        },
    },
}


def ensure_schema_updates():
    # Deprecated safety net for older local SQLite databases.
    # Prefer Flask-Migrate/Alembic revisions going forward.
    inspector = inspect(db.engine)
    table_names = set(inspector.get_table_names())

    for table_name, column_patches in SCHEMA_PATCHES.items():
        if table_name not in table_names:
            continue

        existing_columns = {
            column["name"] for column in inspector.get_columns(table_name)
        }
        changed = False

        for column_name, patch in column_patches.items():
            if column_name not in existing_columns:
                db.session.execute(text(patch["alter_sql"]))
                existing_columns.add(column_name)
                changed = True

            backfill_sql = patch.get("backfill_sql")
            if backfill_sql:
                db.session.execute(text(backfill_sql))
                changed = True

        if changed:
            db.session.commit()


def create_app(config_overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({"error": "Authentication required"}), 401

    @app.after_request
    def apply_cors_headers(response):
        origin = request.headers.get("Origin")
        if not origin:
            return response

        allowed_origins = set(app.config.get("CORS_ALLOWED_ORIGINS", []))
        allow_all_dev = app.config.get("CORS_ALLOW_ALL_DEV", False)

        if allow_all_dev or origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Max-Age"] = "86400"

            vary = response.headers.get("Vary", "")
            if "Origin" not in vary:
                response.headers["Vary"] = f"{vary}, Origin".strip(", ")

        return response
    
    from .models import (
        Comment,
        Like,
        ModerationLog,
        Playlist,
        PlaylistVideo,
        Progress,
        QuizAttempt,
        QuizDefinition,
        Report,
        Subscription,
        User,
        Video,
    )
    from .routes import admin_bp, auth_bp, playlist_bp, progress_bp, quiz_bp, social_bp, user_bp, video_bp

    app.register_blueprint(video_bp)
    app.register_blueprint(social_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(progress_bp)
    app.register_blueprint(playlist_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp)

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    with app.app_context():
        db.create_all()
        ensure_schema_updates()

    frontend_dist_dir = Path(app.config.get("FRONTEND_DIST_DIR", ""))
    serve_frontend_build = (
        app.config.get("SERVE_FRONTEND_BUILD", False)
        and frontend_dist_dir.exists()
        and frontend_dist_dir.is_dir()
    )

    if serve_frontend_build:
        api_prefixes = ("auth", "videos", "social", "users", "admin")

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path):
            normalized_path = path.strip("/")

            if normalized_path and any(
                normalized_path == prefix or normalized_path.startswith(f"{prefix}/")
                for prefix in api_prefixes
            ):
                return jsonify({"error": "Not found"}), 404

            requested_file = frontend_dist_dir / normalized_path if normalized_path else frontend_dist_dir / "index.html"
            if normalized_path and requested_file.exists() and requested_file.is_file():
                return send_from_directory(frontend_dist_dir, normalized_path)

            index_file = frontend_dist_dir / "index.html"
            if index_file.exists():
                return send_from_directory(frontend_dist_dir, "index.html")

            return {"message": "HowTube backend is running"}
    else:
        @app.route("/")
        def home():
            return {"message": "HowTube backend is running"}

    return app
