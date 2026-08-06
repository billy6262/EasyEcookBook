from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()

DEMO_EMAIL = "demo@easyecookbook.local"


class Command(BaseCommand):
    help = "Create or refresh the shared read-only demo account."

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email=DEMO_EMAIL,
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
            self.stdout.write(self.style.SUCCESS(f"Created demo user {DEMO_EMAIL}"))
        else:
            changed = []
            if not user.is_demo:
                user.is_demo = True
                changed.append("is_demo")
            if not user.is_active:
                user.is_active = True
                changed.append("is_active")
            if changed:
                user.save(update_fields=changed)
            self.stdout.write(self.style.SUCCESS(f"Demo user already exists: {DEMO_EMAIL}"))
