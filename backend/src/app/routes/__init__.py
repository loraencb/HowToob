from .admin import admin_bp
from .auth import auth_bp
from .playlist import playlist_bp
from .progress import progress_bp
from .quiz import quiz_bp
from .social import social_bp
from .user import user_bp
from .video import video_bp

__all__ = [
    "admin_bp",
    "auth_bp",
    "playlist_bp",
    "progress_bp",
    "quiz_bp",
    "social_bp",
    "user_bp",
    "video_bp",
]
