ADMIN = "admin"
CREATOR = "creator"
VIEWER = "viewer"

ROLE_HIERARCHY = [VIEWER, CREATOR, ADMIN]


def has_role(user, role):
    """Return True if the user has at least the given role level."""
    if not user or not user.is_authenticated:
        return False
    try:
        return ROLE_HIERARCHY.index(user.role) >= ROLE_HIERARCHY.index(role)
    except ValueError:
        return False


def is_admin(user):
    return has_role(user, ADMIN)


def is_creator(user):
    return has_role(user, CREATOR)
