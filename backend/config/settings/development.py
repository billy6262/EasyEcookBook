import os

# Provide safe defaults so `manage.py` works without a .env file in development.
# These values are NEVER appropriate for production.
os.environ.setdefault("SECRET_KEY", "dev-insecure-key-not-for-production-easyecookbook-1234")
os.environ.setdefault("DATABASE_URL", "postgresql://easyecookbook:dev_password@localhost:5432/easyecookbook")
os.environ.setdefault("MINIO_ENDPOINT", "localhost:9000")
os.environ.setdefault("MINIO_ACCESS_KEY", "minioadmin")
os.environ.setdefault("MINIO_SECRET_KEY", "dev_minio_password")

from .base import *  # noqa: F401, E402

DEBUG = True

# Print emails to console instead of sending them
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Skip email verification so developers can log in immediately
ACCOUNT_EMAIL_VERIFICATION = "none"

# Accept requests from any origin in development
CORS_ALLOW_ALL_ORIGINS = True

# Show full error details
INTERNAL_IPS = ["127.0.0.1"]
