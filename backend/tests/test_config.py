from flask import Flask
import pytest

from backend.src.app import validate_database_config
from backend.src.app.config import describe_database_uri, normalize_database_url


def make_configured_app(database_uri, require_database_url=True, uri_source="env", testing=False):
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=database_uri,
        SQLALCHEMY_DATABASE_URI_SOURCE=uri_source,
        REQUIRE_DATABASE_URL=require_database_url,
        TESTING=testing,
    )
    return app


def test_normalize_database_url_accepts_digitalocean_postgres_scheme():
    assert normalize_database_url("postgres://user:pass@example.com/db") == (
        "postgresql://user:pass@example.com/db"
    )


def test_describe_database_uri_hides_password():
    summary = describe_database_uri("postgresql://db:secret@example.com:25060/db?sslmode=require")

    assert summary == {
        "scheme": "postgresql",
        "host": "example.com",
        "database": "db",
    }


def test_production_database_config_rejects_sqlite_fallback():
    app = make_configured_app("sqlite:///app.db", uri_source="fallback")

    with pytest.raises(RuntimeError, match="DATABASE_URL is required"):
        validate_database_config(app)


def test_production_database_config_requires_postgres():
    app = make_configured_app("sqlite:///app.db", uri_source="env")

    with pytest.raises(RuntimeError, match="must use PostgreSQL"):
        validate_database_config(app)


def test_production_database_config_rejects_unresolved_bindable_variable():
    app = make_configured_app("${howtoob-db.DATABASE_URL}")

    with pytest.raises(RuntimeError, match="unresolved DigitalOcean bindable variable"):
        validate_database_config(app)


def test_production_database_config_allows_postgres_url():
    app = make_configured_app("postgresql://user:pass@example.com/db")

    validate_database_config(app)
