import os
import sys
import tempfile
import uuid

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.app import create_app
from src.app.extensions import db
from src.app.models.user import User
from src.app.models.video import Video


@pytest.fixture
def app():
    db_fd, db_path = tempfile.mkstemp()

    app = create_app()
    app.config.update(
        TESTING=True,
        SECRET_KEY="test-secret-key",
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{db_path}",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        WTF_CSRF_ENABLED=False,
        LOGIN_DISABLED=False,
        VIDEO_UPLOAD_FOLDER=os.path.join(tempfile.gettempdir(), "yt_test_videos"),
        THUMBNAIL_UPLOAD_FOLDER=os.path.join(tempfile.gettempdir(), "yt_test_thumbs"),
    )

    os.makedirs(app.config["VIDEO_UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["THUMBNAIL_UPLOAD_FOLDER"], exist_ok=True)

    with app.app_context():
        db.drop_all()
        db.create_all()

        user1 = User(
            username="test1",
            email="test1@example.com",
            role="viewer",
        )
        user1.set_password("password123")
        db.session.add(user1)

        # Seed fixed second user for tests that log in with hardcoded credentials
        user2 = User(
            username="test2",
            email="test2@example.com",
            role="viewer",
        )
        user2.set_password("password123")
        db.session.add(user2)

        db.session.commit()

        yield app

        db.session.remove()
        db.drop_all()

    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def runner(app):
    return app.test_cli_runner()


@pytest.fixture
def auth_client(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "test1@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 200, response.get_json()
    return client


@pytest.fixture
def sample_user(app):
    with app.app_context():
        return User.query.filter_by(email="test1@example.com").first()


@pytest.fixture
def sample_video(app, sample_user):
    with app.app_context():
        video = Video(
            title="Test Video",
            description="Test Description",
            file_path="uploads/videos/test_video.mp4",
            thumbnail_path="uploads/thumbnails/test_thumb.jpg",
            creator_id=sample_user.id,
        )
        db.session.add(video)
        db.session.commit()
        return video


@pytest.fixture
def create_second_user(app):
    with app.app_context():
        user = User.query.filter_by(email="test2@example.com").first()
        return user.id


@pytest.fixture
def second_user_credentials(app):
    with app.app_context():
        user = User.query.filter_by(email="test2@example.com").first()
        return {
            "id": user.id,
            "email": "test2@example.com",
            "password": "password123",
        }


@pytest.fixture
def create_random_user(app):
    with app.app_context():
        unique = uuid.uuid4().hex[:8]
        email = f"test_random_{unique}@example.com"
        username = f"testuser_random_{unique}"

        user = User(
            username=username,
            email=email,
            role="viewer",
        )
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()

        return {
            "id": user.id,
            "email": email,
            "password": "password123",
        }