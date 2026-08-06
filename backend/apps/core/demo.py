"""
Helpers for the read-only demo experience.

The shared demo account browses the app as if it were a designated "showcase"
user (configured via DEMO_SHOWCASE_EMAIL), so recruiters see a populated app.
All writes are still blocked by DemoReadOnlyMiddleware.
"""

from django.conf import settings
from django.contrib.auth import get_user_model


def get_showcase_user():
    """Return the configured showcase user, or None if unset/missing."""
    email = getattr(settings, "DEMO_SHOWCASE_EMAIL", "") or ""
    if not email:
        return None
    User = get_user_model()
    return User.objects.filter(email__iexact=email).first()


def _is_demo(request) -> bool:
    user = getattr(request, "user", None)
    return bool(user is not None and getattr(user, "is_demo", False))


def effective_user(request):
    """
    The user whose content should be shown. For the demo account this is the
    showcase user (so ownership-scoped querysets return the showcase content);
    for everyone else it's the request user unchanged.
    """
    if _is_demo(request):
        showcase = get_showcase_user()
        if showcase is not None:
            return showcase
    return getattr(request, "user", None)


def demo_can_read_owner(request, owner_id) -> bool:
    """
    True when the demo account is reading content owned by the showcase user.
    Used by object-level permissions to allow SAFE reads of the showcase user's
    otherwise-private recipes / collections / events.
    """
    if not _is_demo(request):
        return False
    showcase = get_showcase_user()
    return showcase is not None and owner_id == showcase.id
