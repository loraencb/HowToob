import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from src.app import create_app
from src.app.extensions import db
from src.app.models import User


@pytest.fixture
def app():
    app = create_app()
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "SECRET_KEY": "test-secret-key",
    })

    with app.app_context():
        db.drop_all()
        db.create_all()

        user1 = User(username="testuser1", email="test1@example.com", password_hash="")
        user1.set_password("password123")

        user2 = User(username="testuser2", email="test2@example.com", password_hash="")
        user2.set_password("password123")

        db.session.add_all([user1, user2])
        db.session.commit()

        yield app

        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()