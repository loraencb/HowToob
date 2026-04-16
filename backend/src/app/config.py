import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(override=True)


def parse_bool(value, default=False):
    if value is None:
        return default

    if str(value).strip() == "":
        return default

    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def parse_csv(value):
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


def build_cors_allowed_origins():
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    lan_ip = os.getenv("LAN_IP", "").strip()
    if lan_ip:
        origins.append(f"http://{lan_ip}:5173")

    for origin in parse_csv(os.getenv("CORS_ALLOWED_ORIGINS", "")):
        if origin not in origins:
            origins.append(origin)

    return origins


DEFAULT_DEBUG = parse_bool(os.getenv("DEBUG"), True)
ROOT_DIR = Path(__file__).resolve().parents[3]


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///app.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "5000"))
    DEBUG = DEFAULT_DEBUG

    SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "howtoob_session")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = parse_bool(
        os.getenv("SESSION_COOKIE_SECURE"),
        not DEFAULT_DEBUG,
    )
    SESSION_COOKIE_DOMAIN = os.getenv("SESSION_COOKIE_DOMAIN") or None
    SESSION_COOKIE_PATH = "/"

    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = os.getenv(
        "REMEMBER_COOKIE_SAMESITE",
        SESSION_COOKIE_SAMESITE,
    )
    REMEMBER_COOKIE_SECURE = parse_bool(
        os.getenv("REMEMBER_COOKIE_SECURE"),
        SESSION_COOKIE_SECURE,
    )

    CORS_ALLOW_ALL_DEV = parse_bool(os.getenv("CORS_ALLOW_ALL_DEV"), DEFAULT_DEBUG)
    CORS_ALLOWED_ORIGINS = build_cors_allowed_origins()

    SERVE_FRONTEND_BUILD = parse_bool(os.getenv("SERVE_FRONTEND_BUILD"), False)
    FRONTEND_DIST_DIR = os.getenv(
        "FRONTEND_DIST_DIR",
        str(ROOT_DIR / "frontend" / "dist"),
    )

    BASE_DIR = str(ROOT_DIR)

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    VIDEO_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, "videos")
    THUMBNAIL_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, "thumbnails")

    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
