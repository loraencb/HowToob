import os

class Config:
    SECRET_KEY = "your-secret-key"

    SQLALCHEMY_DATABASE_URI = "sqlite:///app.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    BASE_DIR = os.getcwd()

    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    VIDEO_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, "videos")
    THUMBNAIL_UPLOAD_FOLDER = os.path.join(UPLOAD_FOLDER, "thumbnails")

    MAX_CONTENT_LENGTH = 100 * 1024 * 1024