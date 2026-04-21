from pathlib import Path
import time

from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from .config import Config, describe_database_uri, normalize_origin
from .extensions import db, login_manager, migrate

SCHEMA_PATCHES = {
    "users": {
        "role": {
            "alter_sql": "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'viewer'",
            "backfill_sql": "UPDATE users SET role = 'viewer' WHERE role IS NULL OR TRIM(role) = ''",
        },
        "profile_image_path": {
            "alter_sql": "ALTER TABLE users ADD COLUMN profile_image_path VARCHAR(255)",
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
    "likes": {
        "rating": {
            "alter_sql": "ALTER TABLE likes ADD COLUMN rating INTEGER NOT NULL DEFAULT 5",
            "backfill_sql": "UPDATE likes SET rating = 5 WHERE rating IS NULL OR rating < 1 OR rating > 5",
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


def validate_database_config(app):
    database_uri = str(app.config.get("SQLALCHEMY_DATABASE_URI") or "").strip()
    if not database_uri:
        raise RuntimeError("DATABASE_URL is empty. Configure a database connection before starting HowToob.")

    if "${" in database_uri or "}" in database_uri:
        raise RuntimeError(
            "DATABASE_URL still contains an unresolved DigitalOcean bindable variable. "
            "Bind a PostgreSQL database to the web service or set DATABASE_URL to the "
            "database component value, for example ${howtoob-db.DATABASE_URL} in the App Platform UI."
        )

    require_database_url = bool(app.config.get("REQUIRE_DATABASE_URL"))
    is_testing = bool(app.config.get("TESTING"))
    uri_source = app.config.get("SQLALCHEMY_DATABASE_URI_SOURCE")
    uses_postgres = database_uri.startswith("postgresql://") or database_uri.startswith("postgresql+")

    if require_database_url and not is_testing and uri_source != "env":
        raise RuntimeError(
            "DATABASE_URL is required outside local development. "
            "The app would otherwise fall back to SQLite, which is not persistent on DigitalOcean App Platform."
        )

    if require_database_url and not is_testing and not uses_postgres:
        raise RuntimeError(
            "Production database configuration must use PostgreSQL. "
            "Set DATABASE_URL to the DigitalOcean PostgreSQL bindable variable."
        )


def log_database_config(app):
    database_uri = str(app.config.get("SQLALCHEMY_DATABASE_URI") or "").strip()
    summary = describe_database_uri(database_uri)
    message = (
        "HowToob database config: "
        f"source={app.config.get('SQLALCHEMY_DATABASE_URI_SOURCE')} "
        f"require_database_url={bool(app.config.get('REQUIRE_DATABASE_URL'))} "
        f"scheme={summary['scheme']} "
        f"host={summary['host']} "
        f"database={summary['database']}"
    )
    print(message, flush=True)
    app.logger.warning(
        "%s",
        message,
    )


def log_database_connection_ready(app):
    summary = describe_database_uri(str(app.config.get("SQLALCHEMY_DATABASE_URI") or ""))
    print(
        "HowToob database connected: "
        f"scheme={summary['scheme']} host={summary['host']} database={summary['database']}",
        flush=True,
    )
    app.logger.warning(
        "HowToob database connected: scheme=%s host=%s database=%s",
        summary["scheme"],
        summary["host"],
        summary["database"],
    )


def log_database_initialization_attempt(app, attempt, attempts):
    summary = describe_database_uri(str(app.config.get("SQLALCHEMY_DATABASE_URI") or ""))
    print(
        "HowToob database initialization: "
        f"attempt={attempt}/{attempts} scheme={summary['scheme']} host={summary['host']} database={summary['database']}",
        flush=True,
    )
    app.logger.warning(
        "HowToob database initialization: attempt=%s/%s scheme=%s host=%s database=%s",
        attempt,
        attempts,
        summary["scheme"],
        summary["host"],
        summary["database"],
    )


def initialize_database(app):
    attempts = max(1, int(app.config.get("DB_STARTUP_RETRIES", 5) or 5))
    retry_seconds = max(1, int(app.config.get("DB_STARTUP_RETRY_SECONDS", 2) or 2))

    for attempt in range(1, attempts + 1):
        try:
            log_database_initialization_attempt(app, attempt, attempts)
            db.create_all()
            ensure_schema_updates()
            log_database_connection_ready(app)
            return
        except SQLAlchemyError:
            db.session.rollback()
            if attempt >= attempts:
                app.logger.exception("Database initialization failed after %s attempt(s).", attempts)
                raise

            app.logger.warning(
                "Database initialization failed on attempt %s/%s. Retrying in %s second(s).",
                attempt,
                attempts,
                retry_seconds,
                exc_info=True,
            )
            time.sleep(retry_seconds)


def create_app(config_overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    validate_database_config(app)
    log_database_config(app)
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

        normalized_origin = normalize_origin(origin)
        allowed_origins = {
            normalize_origin(allowed_origin)
            for allowed_origin in app.config.get("CORS_ALLOWED_ORIGINS", [])
            if normalize_origin(allowed_origin)
        }
        allow_all_dev = app.config.get("CORS_ALLOW_ALL_DEV", False)
        debug_mode = app.config.get("DEBUG", False)

        if allow_all_dev or normalized_origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = normalized_origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Max-Age"] = "86400"

            vary = response.headers.get("Vary", "")
            if "Origin" not in vary:
                response.headers["Vary"] = f"{vary}, Origin".strip(", ")
        elif debug_mode:
            app.logger.warning(
                "Rejected CORS origin '%s'. Allowed origins: %s",
                normalized_origin,
                sorted(allowed_origins),
            )

        return response
    
    from .models import (
        Comment,
        CommentLike,
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
        VideoTranscript,
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
        initialize_database(app)

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
