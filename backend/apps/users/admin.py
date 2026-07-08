from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.users.models import InviteToken, User, UserProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "username", "is_staff", "is_active", "date_joined"]
    list_filter = ["is_staff", "is_active"]
    search_fields = ["email", "username"]
    ordering = ["email"]
    # email is now the username field
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "username")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "created_at"]
    raw_id_fields = ["user"]


@admin.register(InviteToken)
class InviteTokenAdmin(admin.ModelAdmin):
    list_display = ["token", "created_by", "uses_count", "max_uses", "expires_at", "is_valid"]
    readonly_fields = ["token", "uses_count", "created_at"]
    raw_id_fields = ["created_by", "used_by"]
