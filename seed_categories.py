import os, shutil, uuid
from werkzeug.security import generate_password_hash
from backend.src.app import create_app
from backend.src.app.extensions import db
from backend.src.app.models.user import User
from backend.src.app.models.video import Video

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
SRC_VIDEO = os.path.join(BASE_DIR, "test.mp4")
SRC_THUMB = os.path.join(BASE_DIR, "thumb.jpg")
NAMED_THUMB = os.path.join(BASE_DIR, "uploads", "thumbnails", "howtoob_thumbnail.png")
VID_DIR   = os.path.join(BASE_DIR, "uploads", "videos")
THB_DIR   = os.path.join(BASE_DIR, "uploads", "thumbnails")
os.makedirs(VID_DIR, exist_ok=True)
os.makedirs(THB_DIR, exist_ok=True)

app = create_app()
with app.app_context():
    db.create_all()
    creator = User.query.filter_by(email="demo@howtoob.com").first()
    if not creator:
        creator = User(username="HowToob Demo", email="demo@howtoob.com", password_hash=generate_password_hash("demopass123"))
        db.session.add(creator)
        db.session.flush()

    categories_data = [
        ("Technology", ["Python Mastery", "React Basics", "TypeScript Pro", "Backend API Design", "Frontend Performance", "JavaScript Deep Dive"]),
        ("Arts & Design", ["UI/UX Principles", "Digital Painting", "3D Modeling", "Color Theory", "Graphic Design 101", "Sketching Basics"]),
        ("Fitness & Wellness", ["Yoga Flow", "HIIT Training", "Nutrition Guide", "Cardio Blast", "Strength Training", "HowToob Video Test"])
    ]

    for cat_name, titles in categories_data:
        for title in titles:
            vid_name = f"{uuid.uuid4().hex}.mp4"
            thb_name = f"{uuid.uuid4().hex}.jpg"
            if os.path.exists(SRC_VIDEO): shutil.copy2(SRC_VIDEO, os.path.join(VID_DIR, vid_name))
            if os.path.exists(SRC_THUMB): shutil.copy2(SRC_THUMB, os.path.join(THB_DIR, thb_name))
            
            full_title = title if title == "HowToob Video Test" else f"{cat_name}: {title}"
            thumbnail_path = os.path.join(THB_DIR, thb_name)
            if title == "HowToob Video Test" and os.path.exists(NAMED_THUMB):
                thumbnail_path = NAMED_THUMB

            description = f"Learn all about {cat_name} in this comprehensive tutorial on {title}."
            if title == "HowToob Video Test":
                description = "The first official HowToob test video"

            video = Video(
                title=full_title,
                description=description,
                file_path=os.path.join(VID_DIR, vid_name),
                thumbnail_path=thumbnail_path,
                creator_id=creator.id,
                views=1000 + len(title) * 10,
                is_published=True,
            )
            db.session.add(video)
    
    db.session.commit()
    print("✓ Successfully seeded 18 videos across 3 categories.")
