from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = "Create or refresh the shared read-only demo account."

    def handle(self, *args, **options):
        if settings.DEMO_ACCOUNT_EMAIL.casefold() == settings.DEMO_SHOWCASE_EMAIL.casefold():
            raise CommandError("The demo account and showcase account must be different users.")

        user, created = User.objects.get_or_create(
            email=settings.DEMO_ACCOUNT_EMAIL,
            defaults={
                "username": "demo",
                "first_name": "Demo",
                "last_name": "User",
                "is_demo": True,
                "is_active": True,
            },
        )
        if created:
            user.set_unusable_password()
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created demo user {user.email}"))
        else:
            if not user.is_demo or user.is_staff or user.is_superuser:
                raise CommandError(
                    "Refusing to convert an existing account into the public demo account."
                )
            changed = []
            if not user.is_active:
                user.is_active = True
                changed.append("is_active")
            if user.has_usable_password():
                user.set_unusable_password()
                changed.append("password")
            if changed:
                user.save(update_fields=changed)
            self.stdout.write(self.style.SUCCESS(f"Demo user already exists: {user.email}"))
