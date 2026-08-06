import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom manager that uses email as the unique identifier instead of username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email address is required.")
        email = self.normalize_email(email)
        # Auto-generate a username from the email if not supplied
        extra_fields.setdefault("username", email.split("@")[0])
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom user model using email as the primary identifier.
    Username is retained for Django/allauth compatibility but auto-generated.
    """

    objects = UserManager()

    email = models.EmailField(unique=True)
    # Marks the shared read-only demo account (writes blocked by middleware).
    is_demo = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # removes email from createsuperuser prompts

    def __str__(self) -> str:
        return self.email


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    bio = models.TextField(blank=True)
    # Days before a 'shopped' meal is flagged as stale in the Ready-to-Cook queue
    shopping_staleness_days = models.PositiveIntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Profile({self.user.email})"


class InviteToken(models.Model):
    """
    Single-use (or limited-use) invite tokens for controlled registration.
    Admins generate these and share them with prospective users.
    """

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="created_invites"
    )
    used_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="used_invite",
    )
    max_uses = models.PositiveIntegerField(default=1)
    uses_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_valid(self) -> bool:
        if self.expires_at and self.expires_at < timezone.now():
            return False
        if self.uses_count >= self.max_uses:
            return False
        return True

    def __str__(self) -> str:
        return f"InviteToken({str(self.token)[:8]}…)"
