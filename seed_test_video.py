"""
Seed script: copies test assets into uploads folders
and inserts or refreshes the demo "HowToob Video Test" video.
Run once: python seed_test_video.py
"""
import os
import shutil
import uuid
from werkzeug.security import generate_password_hash

from backend.src.app import create_app
from backend.src.app.extensions import db
from backend.src.app.models.user import User
from backend.src.app.models.video import Video


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_VIDEO = os.path.join(BASE_DIR, "test.mp4")
SRC_THUMB = os.path.join(BASE_DIR, "thumb.jpg")
NAMED_THUMB = os.path.join(BASE_DIR, "uploads", "thumbnails", "howtoob_thumbnail.png")
VID_DIR = os.path.join(BASE_DIR, "uploads", "videos")
THB_DIR = os.path.join(BASE_DIR, "uploads", "thumbnails")
VIDEO_TITLE = "HowToob Video Test"
VIDEO_DESCRIPTION = "The first official HowToob test video"

os.makedirs(VID_DIR, exist_ok=True)
os.makedirs(THB_DIR, exist_ok=True)


def copy_asset(source_path, destination_dir, extension):
    if not os.path.exists(source_path):
        return None

    filename = f"{uuid.uuid4().hex}.{extension}"
    destination = os.path.join(destination_dir, filename)
    shutil.copy2(source_path, destination)
    return destination


app = create_app()
with app.app_context():
    db.create_all()

    creator = User.query.filter_by(email="demo@howtoob.com").first()
    if not creator:
        creator = User(
            username="HowToob Demo",
            email="demo@howtoob.com",
            password_hash=generate_password_hash("demopass123"),
        )
        db.session.add(creator)
        db.session.flush()
        print(f"Created demo user (id={creator.id})")
    else:
        print(f"Demo user already exists (id={creator.id})")

    video_path = copy_asset(SRC_VIDEO, VID_DIR, "mp4")
    thumbnail_path = NAMED_THUMB if os.path.exists(NAMED_THUMB) else copy_asset(SRC_THUMB, THB_DIR, "jpg")

    if not video_path:
        db.session.commit()
        print("No test.mp4 found at project root; skipped video record")
    else:
        video = Video.query.filter_by(title=VIDEO_TITLE, creator_id=creator.id).first()

        if video:
            video.file_path = video_path
            video.description = VIDEO_DESCRIPTION
            video.is_published = True
            if thumbnail_path:
                video.thumbnail_path = thumbnail_path
            db.session.commit()
            print(f"Updated existing video (id={video.id}) - '{video.title}'")
        else:
            video = Video(
                title=VIDEO_TITLE,
                description=VIDEO_DESCRIPTION,
                file_path=video_path,
                thumbnail_path=thumbnail_path,
                creator_id=creator.id,
                views=1234,
                is_published=True,
            )
            db.session.add(video)
            db.session.commit()
            print(f"Inserted video (id={video.id}) - '{video.title}'")

print("Done! Restart Flask if needed, then refresh the browser.")
