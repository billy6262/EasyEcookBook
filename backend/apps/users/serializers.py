import uuid

from allauth.account import app_settings as allauth_account_settings
from allauth.account.adapter import get_adapter
from allauth.account.utils import setup_user_email
from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.users.models import InviteToken, UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["avatar", "bio", "shopping_staleness_days"]


class UserDetailsSerializer(serializers.ModelSerializer):
    """Returned by /api/auth/user/ — used by dj-rest-auth."""

    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "pk", "email", "username", "first_name", "last_name",
            "is_staff", "is_superuser", "is_demo", "profile",
        ]
        read_only_fields = ["email", "is_staff", "is_superuser", "is_demo"]


class CustomRegisterSerializer(serializers.Serializer):
    """
    Email + password registration serializer that avoids importing
    dj_rest_auth's social-account-aware base class.
    Optionally validates an invite token.
    """

    email = serializers.EmailField(required=True)
    password1 = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)
    invite_token = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, email: str) -> str:
        email = get_adapter().clean_email(email)
        if allauth_account_settings.UNIQUE_EMAIL:
            if User.objects.filter(email__iexact=email).exists():
                raise serializers.ValidationError(
                    "A user with this email address already exists."
                )
        return email

    def validate_password1(self, password: str) -> str:
        return get_adapter().clean_password(password)

    def validate(self, data):
        if data["password1"] != data["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})

        # Enforce invite-only registration when configured in the admin dashboard.
        from apps.core.models import SiteSettings

        site = SiteSettings.load()
        if site.registration_mode == SiteSettings.REGISTRATION_INVITE_ONLY:
            if not data.get("invite_token"):
                raise serializers.ValidationError(
                    {"invite_token": "Registration is invite-only. A valid invite token is required."}
                )
        return data

    def validate_invite_token(self, value: str) -> str:
        if not value:
            return value
        try:
            invite = InviteToken.objects.get(token=uuid.UUID(value))
            if not invite.is_valid:
                raise serializers.ValidationError(
                    "This invite token is expired or has reached its usage limit."
                )
        except (InviteToken.DoesNotExist, ValueError):
            raise serializers.ValidationError("Invalid invite token.")
        return value

    def save(self, request):
        adapter = get_adapter()
        user = adapter.new_user(request)
        self.cleaned_data = self.validated_data
        adapter.save_user(request, user, self)
        setup_user_email(request, user, [])

        invite_token_value = self.validated_data.get("invite_token")
        if invite_token_value:
            try:
                invite = InviteToken.objects.get(token=uuid.UUID(invite_token_value))
                invite.uses_count += 1
                invite.used_by = user
                invite.save(update_fields=["uses_count", "used_by"])
            except InviteToken.DoesNotExist:
                pass

        return user
