from django.conf import settings
from django.db import models


class ScrapedRecipe(models.Model):
    """
    Staging model for recipes scraped from external URLs.

    The workflow:
      1. User submits a URL → ScrapedRecipe created with status=pending
      2. Scraper task runs (future: async via Celery) → sets raw_data + status=completed
      3. User reviews the parsed data in the UI
      4. User confirms → Recipe created, imported_recipe FK set, status=imported

    This model intentionally has NO code coupled to the scraper library.
    See apps/scraper/utils.py for SSRF protection.
    See requirements.txt for the commented-out recipe-scrapers package.
    """

    STATUS_PENDING = "pending"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_IMPORTED = "imported"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_IMPORTED, "Imported"),
    ]

    url = models.URLField(max_length=2000)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="scraped_recipes",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    raw_data = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    imported_recipe = models.OneToOneField(
        "recipes.Recipe",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scraped_source",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"ScrapedRecipe({self.url[:60]} — {self.status})"
