import logging

from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger(__name__)

# Methods that never mutate data are always allowed.
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})

# Unsafe requests the demo user is still allowed to make (so they can log out).
DEMO_WRITE_ALLOWLIST = frozenset({"/api/auth/logout/"})


class DemoReadOnlyMiddleware:
    """
    Blocks all mutating requests (POST/PUT/PATCH/DELETE) for the shared demo
    account so recruiters can browse the app read-only. Enforced centrally here
    rather than per-view so no endpoint can accidentally bypass it.

    Because authentication is JWT-cookie based (handled by DRF at the view
    layer, after middleware runs), request.user is not yet populated here for
    cookie-authenticated users. We therefore decode the JWT access cookie
    ourselves to determine whether the caller is the demo account.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._should_block(request):
            return JsonResponse(
                {
                    "detail": (
                        "This is a read-only demo account. "
                        "Sign up for a free account to make changes."
                    )
                },
                status=403,
            )
        return self.get_response(request)

    def _should_block(self, request) -> bool:
        if request.method in SAFE_METHODS:
            return False
        if not request.path.startswith("/api/"):
            return False
        if request.path in DEMO_WRITE_ALLOWLIST:
            return False

        # Fast path: a session-authenticated demo user (belt and suspenders).
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            return bool(getattr(user, "is_demo", False))

        # JWT-cookie path: decode the access token to find the user.
        return self._is_demo_from_cookie(request)

    @staticmethod
    def _is_demo_from_cookie(request) -> bool:
        cookie_name = settings.REST_AUTH.get("JWT_AUTH_COOKIE", "auth-token")
        raw = request.COOKIES.get(cookie_name)
        if not raw:
            return False
        try:
            from rest_framework_simplejwt.tokens import AccessToken

            from apps.users.models import User

            token = AccessToken(raw)
            user_id = token.get("user_id")
            if user_id is None:
                return False
            return User.objects.filter(pk=user_id, is_demo=True).exists()
        except Exception:
            # Invalid/expired token — let DRF handle auth; don't block here.
            return False
