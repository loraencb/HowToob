from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager

try:
    from flask_migrate import Migrate
except ImportError:  # pragma: no cover - exercised only before dependencies are installed
    class Migrate:  # type: ignore[override]
        """Lightweight fallback so the app still boots before Flask-Migrate is installed."""

        def __init__(self, *args, **kwargs):
            pass

        def init_app(self, *args, **kwargs):
            return None

db = SQLAlchemy()
migrate = Migrate(compare_type=True, render_as_batch=True)
login_manager = LoginManager()
login_manager.login_view = "auth.login"
login_manager.login_message_category = "info"
