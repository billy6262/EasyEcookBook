from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.core.models import SiteSettings


class Command(BaseCommand):
    help = "Fail when production settings contain unsafe defaults or invalid demo setup."

    def handle(self, *args, **options):
        errors = []
        if settings.DEBUG:
            errors.append("DEBUG must be False.")
        if not settings.SECURE_SSL_REDIRECT:
            errors.append("SECURE_SSL_REDIRECT must be enabled.")
        if not settings.SESSION_COOKIE_SECURE or not settings.CSRF_COOKIE_SECURE:
            errors.append("Session and CSRF cookies must require HTTPS.")
        if not settings.SECURE_PROXY_SSL_HEADER:
            errors.append("SECURE_PROXY_SSL_HEADER must be configured behind the TLS proxy.")

        local_hosts = {"localhost", "127.0.0.1", "[::1]"}
        if not settings.ALLOWED_HOSTS or any(host.casefold() in local_hosts for host in settings.ALLOWED_HOSTS):
            errors.append("ALLOWED_HOSTS must contain only production hostnames.")

        origins = [*settings.CORS_ALLOWED_ORIGINS, *settings.CSRF_TRUSTED_ORIGINS]
        if not origins or any(not origin.startswith("https://") for origin in origins):
            errors.append("CORS and CSRF trusted origins must use HTTPS.")
        if not settings.MINIO_PUBLIC_URL_BASE.startswith("https://"):
            errors.append("The public media URL must use HTTPS.")
        if any(marker in settings.SECRET_KEY.casefold() for marker in ("change-me", "dev-insecure")):
            errors.append("SECRET_KEY contains a placeholder value.")

        site_settings = SiteSettings.objects.filter(pk=1).first()
        if site_settings is not None and site_settings.demo_enabled:
            if settings.DEMO_ACCOUNT_EMAIL.casefold() == settings.DEMO_SHOWCASE_EMAIL.casefold():
                errors.append("Demo and showcase accounts must be different users.")
            else:
                User = get_user_model()
                demo = User.objects.filter(email__iexact=settings.DEMO_ACCOUNT_EMAIL).first()
                if (
                    demo is None
                    or not demo.is_demo
                    or not demo.is_active
                    or demo.is_staff
                    or demo.is_superuser
                    or demo.has_usable_password()
                ):
                    errors.append("The enabled demo account is missing or does not meet security requirements.")

        if errors:
            raise CommandError("\n".join(errors))
        self.stdout.write(self.style.SUCCESS("Production security configuration is valid."))