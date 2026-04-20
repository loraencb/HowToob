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


def parse_int(value, default=0):
    if value is None:
        return default

    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def normalize_origin(origin):
    normalized = str(origin or "").strip()
    if not normalized:
        return ""

    return normalized.rstrip("/")


def build_cors_allowed_origins():
    origins = []

    def add_origin(origin):
        normalized = normalize_origin(origin)
        if normalized and normalized not in origins:
            origins.append(normalized)

    add_origin("http://localhost:5173")
    add_origin("http://127.0.0.1:5173")

    lan_ip = os.getenv("LAN_IP", "").strip()
    if lan_ip:
        add_origin(f"http://{lan_ip}:5173")

    vpn_ip = os.getenv("VPN_IP", "").strip()
    if vpn_ip:
        add_origin(f"http://{vpn_ip}:5173")

    for origin in parse_csv(os.getenv("CORS_ALLOWED_ORIGINS", "")):
        add_origin(origin)

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

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
    OPENAI_API_BASE_URL = os.getenv("OPENAI_API_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    OPENAI_TRANSCRIPTION_MODEL = os.getenv("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe").strip()
    OPENAI_QUIZ_MODEL = os.getenv("OPENAI_QUIZ_MODEL", "gpt-4o-mini").strip()
    QUIZ_AI_DEFAULT_QUESTION_COUNT = parse_int(os.getenv("QUIZ_AI_DEFAULT_QUESTION_COUNT"), 10)
    QUIZ_AI_MIN_TRANSCRIPT_CHARS = parse_int(os.getenv("QUIZ_AI_MIN_TRANSCRIPT_CHARS"), 30)
    QUIZ_AI_MAX_TRANSCRIPT_CHARS = parse_int(os.getenv("QUIZ_AI_MAX_TRANSCRIPT_CHARS"), 12000)
    QUIZ_AI_INCLUDE_VIDEO_FRAMES = parse_bool(os.getenv("QUIZ_AI_INCLUDE_VIDEO_FRAMES"), True)
    QUIZ_AI_FRAME_SAMPLE_COUNT = parse_int(os.getenv("QUIZ_AI_FRAME_SAMPLE_COUNT"), 4)
    QUIZ_AI_FRAME_WIDTH = parse_int(os.getenv("QUIZ_AI_FRAME_WIDTH"), 768)
    QUIZ_AI_AUTO_GENERATE_ON_UPLOAD = parse_bool(os.getenv("QUIZ_AI_AUTO_GENERATE_ON_UPLOAD"), False)
    QUIZ_AI_AUTO_GENERATE_QUESTION_COUNT = parse_int(
        os.getenv("QUIZ_AI_AUTO_GENERATE_QUESTION_COUNT"),
        QUIZ_AI_DEFAULT_QUESTION_COUNT,
    )
    QUIZ_AI_CHUNK_SECONDS = parse_int(os.getenv("QUIZ_AI_CHUNK_SECONDS"), 600)
    QUIZ_AI_AUDIO_BITRATE_KBPS = parse_int(os.getenv("QUIZ_AI_AUDIO_BITRATE_KBPS"), 64)
    QUIZ_AI_FFMPEG_BINARY = os.getenv("QUIZ_AI_FFMPEG_BINARY", "ffmpeg").strip() or "ffmpeg"
