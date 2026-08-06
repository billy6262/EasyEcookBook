from .base import *  # noqa: F401

# In production, SECRET_KEY must be explicitly set — no fallback.
# The base settings already enforce this via env('SECRET_KEY').

# Enforce HTTPS cookie flags in production
REST_AUTH = {
    **REST_AUTH,  # type: ignore[name-defined]
    "JWT_AUTH_SECURE": True,      # cookies only sent over HTTPS
    "JWT_AUTH_SAMESITE": "Lax",
}

# Hardened security middleware settings
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "SAMEORIGIN"

# HTTP Strict Transport Security (assumes TLS is terminated in front of the app).
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
