import sqlite3

from sqlalchemy import text
from werkzeug.security import generate_password_hash

from backend.src.app import create_app
from backend.src.app.extensions import db


def test_register_user(client):
    response = client.post("/auth/register", json={
        "username": "newuser",
        "email": "newuser@example.com",
        "password": "securepass123"
    })

    assert response.status_code == 201
    data = response.get_json()
    assert data["message"] == "User registered successfully"
    assert data["user"]["username"] == "newuser"


def test_register_duplicate_email(client):
    response = client.post("/auth/register", json={
        "username": "anotheruser",
        "email": "test1@example.com",
        "password": "securepass123"
    })

    assert response.status_code == 400
    assert response.get_json()["error"] == "Email already exists"


def test_login_user(client):
    response = client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    assert response.status_code == 200
    data = response.get_json()
    assert data["message"] == "Login successful"
    assert data["user"]["email"] == "test1@example.com"


def test_login_invalid_password(client):
    response = client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "wrongpassword"
    })

    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_me_authenticated(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    response = client.get("/auth/me")
    assert response.status_code == 200
    data = response.get_json()
    assert data["authenticated"] is True
    assert data["user"]["email"] == "test1@example.com"


def test_logout_user(client):
    client.post("/auth/login", json={
        "email": "test1@example.com",
        "password": "password123"
    })

    response = client.post("/auth/logout")
    assert response.status_code == 200
    assert response.get_json()["message"] == "Logout successful"


def test_startup_self_heals_legacy_users_table_missing_role():
    try:
        connection = sqlite3.connect(":memory:")
        connection.execute(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(80) UNIQUE NOT NULL,
                email VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (
                "legacyuser",
                "legacy@example.com",
                generate_password_hash("password123"),
            ),
        )
        connection.commit()

        app = create_app({
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "SQLALCHEMY_ENGINE_OPTIONS": {
                "creator": lambda: connection,
            },
            "SQLALCHEMY_TRACK_MODIFICATIONS": False,
            "SECRET_KEY": "legacy-schema-test",
        })

        with app.app_context():
            role_column = db.session.execute(
                text("SELECT role FROM users WHERE email = :email"),
                {"email": "legacy@example.com"},
            ).scalar_one()
            assert role_column == "viewer"

        client = app.test_client()
        response = client.post("/auth/login", json={
            "email": "legacy@example.com",
            "password": "password123",
        })

        assert response.status_code == 200
        data = response.get_json()
        assert data["user"]["role"] == "viewer"
    finally:
        connection.close()


def test_startup_self_heals_legacy_subscriptions_table_missing_tier_level():
    try:
        connection = sqlite3.connect(":memory:")
        connection.execute(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(80) UNIQUE NOT NULL,
                email VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'viewer'
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE subscriptions (
                id INTEGER PRIMARY KEY,
                subscriber_id INTEGER NOT NULL,
                creator_id INTEGER NOT NULL,
                CONSTRAINT unique_subscriber_creator UNIQUE (subscriber_id, creator_id)
            )
            """
        )
        connection.execute(
            "INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
            (
                1,
                "legacyviewer",
                "legacyviewer@example.com",
                generate_password_hash("password123"),
                "viewer",
            ),
        )
        connection.execute(
            "INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
            (
                2,
                "legacycreator",
                "legacycreator@example.com",
                generate_password_hash("password123"),
                "creator",
            ),
        )
        connection.execute(
            "INSERT INTO subscriptions (subscriber_id, creator_id) VALUES (?, ?)",
            (1, 2),
        )
        connection.commit()

        app = create_app({
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "SQLALCHEMY_ENGINE_OPTIONS": {
                "creator": lambda: connection,
            },
            "SQLALCHEMY_TRACK_MODIFICATIONS": False,
            "SECRET_KEY": "legacy-subscriptions-test",
        })

        with app.app_context():
            tier_level = db.session.execute(
                text(
                    "SELECT tier_level FROM subscriptions "
                    "WHERE subscriber_id = :subscriber_id AND creator_id = :creator_id"
                ),
                {"subscriber_id": 1, "creator_id": 2},
            ).scalar_one()
            assert tier_level == 0

        client = app.test_client()
        response = client.get("/users/1/subscriptions")

        assert response.status_code == 200
        data = response.get_json()
        assert len(data) == 1
        assert data[0]["tier_level"] == 0
    finally:
        connection.close()


def test_startup_self_heals_multiple_legacy_schema_gaps():
    try:
        connection = sqlite3.connect(":memory:")
        connection.execute(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR(80) UNIQUE NOT NULL,
                email VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE subscriptions (
                id INTEGER PRIMARY KEY,
                subscriber_id INTEGER NOT NULL,
                creator_id INTEGER NOT NULL,
                CONSTRAINT unique_subscriber_creator UNIQUE (subscriber_id, creator_id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE comments (
                id INTEGER PRIMARY KEY,
                content TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                video_id INTEGER NOT NULL,
                created_at DATETIME NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE videos (
                id INTEGER PRIMARY KEY,
                title VARCHAR(150) NOT NULL,
                description TEXT,
                file_path VARCHAR(255) NOT NULL,
                thumbnail_path VARCHAR(255),
                creator_id INTEGER NOT NULL,
                views INTEGER NOT NULL DEFAULT 0,
                is_published BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
            (
                1,
                "legacyviewer",
                "legacyviewer@example.com",
                generate_password_hash("password123"),
            ),
        )
        connection.execute(
            "INSERT INTO videos (id, title, description, file_path, creator_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (
                1,
                "Legacy lesson",
                "Old schema row",
                "/videos/legacy.mp4",
                1,
                "2026-04-16T00:00:00",
            ),
        )
        connection.execute(
            "INSERT INTO subscriptions (subscriber_id, creator_id) VALUES (?, ?)",
            (1, 1),
        )
        connection.execute(
            "INSERT INTO comments (content, user_id, video_id, created_at) VALUES (?, ?, ?, ?)",
            (
                "Legacy comment",
                1,
                1,
                "2026-04-16T00:00:00",
            ),
        )
        connection.commit()

        app = create_app({
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "SQLALCHEMY_ENGINE_OPTIONS": {
                "creator": lambda: connection,
            },
            "SQLALCHEMY_TRACK_MODIFICATIONS": False,
            "SECRET_KEY": "legacy-multi-gap-test",
        })

        with app.app_context():
            user_role = db.session.execute(
                text("SELECT role FROM users WHERE id = 1")
            ).scalar_one()
            subscription_tier = db.session.execute(
                text("SELECT tier_level FROM subscriptions WHERE id = 1")
            ).scalar_one()
            comment_parent_id = db.session.execute(
                text("SELECT parent_id FROM comments WHERE id = 1")
            ).scalar_one()
            video_row = db.session.execute(
                text(
                    "SELECT category, learning_level, access_tier "
                    "FROM videos WHERE id = 1"
                )
            ).one()

            assert user_role == "viewer"
            assert subscription_tier == 0
            assert comment_parent_id is None
            assert video_row.category is None
            assert video_row.learning_level is None
            assert video_row.access_tier == 0
    finally:
        connection.close()
