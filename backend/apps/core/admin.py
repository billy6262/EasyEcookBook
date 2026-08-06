from django.contrib import admin

from .models import SiteSettings


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ["registration_mode", "demo_enabled", "updated_at", "updated_by"]
    readonly_fields = ["updated_at"]
