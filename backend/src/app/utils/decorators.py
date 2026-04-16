from functools import wraps
from flask import jsonify
from flask_login import current_user
from .rbac import has_role


def roles_required(*roles):
    """Decorator that requires the current user to have one of the given roles."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return jsonify({"error": "Authentication required"}), 401
            if not any(has_role(current_user, role) for role in roles):
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator
