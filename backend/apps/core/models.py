from django.conf import settings
from django.db import models


class SiteSettings(models.Model):
    """
    Singleton row holding runtime-configurable site settings, editable from the
    admin dashboard. Always accessed via SiteSettings.load().
    """

    REGISTRATION_OPEN = "open"
    REGISTRATION_INVITE_ONLY = "invite_only"
    REGISTRATION_CHOICES = [
        (REGISTRATION_OPEN, "Open — anyone can register"),
        (REGISTRATION_INVITE_ONLY, "Invite only — a valid invite token is required"),
    ]

    registration_mode = models.CharField(
        max_length=20,
        choices=REGISTRATION_CHOICES,
        default=REGISTRATION_OPEN,
    )
    demo_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        verbose_name = "Site settings"
        verbose_name_plural = "Site settings"

    def save(self, *args, **kwargs):
        # Enforce the singleton: there is only ever one row (pk=1).
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"SiteSettings(registration={self.registration_mode})"

    @classmethod
    def load(cls) -> "SiteSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
