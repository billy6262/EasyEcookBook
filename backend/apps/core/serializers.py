from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.recipes.models import Comment, Recipe
from apps.scraper.models import ScrapedRecipe
from apps.users.models import InviteToken

from .models import SiteSettings

User = get_user_model()


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ["registration_mode", "demo_enabled", "updated_at"]
        read_only_fields = ["updated_at"]


class InviteSerializer(serializers.ModelSerializer):
    share_url = serializers.SerializerMethodField()
    is_valid = serializers.BooleanField(read_only=True)
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    used_by_email = serializers.EmailField(source="used_by.email", read_only=True, default=None)

    class Meta:
        model = InviteToken
        fields = [
            "id", "token", "share_url", "max_uses", "uses_count", "expires_at",
            "is_valid", "created_by_email", "used_by_email", "created_at",
        ]
        read_only_fields = ["id", "token", "uses_count", "created_at"]

    def get_share_url(self, obj) -> str:
        request = self.context.get("request")
        path = f"/register?invite={obj.token}"
        if request is not None:
            return request.build_absolute_uri(path)
        return path


class AdminUserSerializer(serializers.ModelSerializer):
    recipe_count = serializers.IntegerField(source="recipes.count", read_only=True)

    class Meta:
        model = User
        fields = [
            "pk", "email", "username", "first_name", "last_name",
            "is_active", "is_staff", "is_superuser", "is_demo",
            "date_joined", "last_login", "recipe_count",
        ]
        read_only_fields = [
            "pk", "email", "username", "first_name", "last_name",
            "is_superuser", "is_demo", "date_joined", "last_login", "recipe_count",
        ]


class AdminRecipeSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = Recipe
        fields = [
            "id", "title", "visibility", "is_hidden",
            "created_by_email", "created_at",
        ]


class AdminCommentSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)
    recipe_title = serializers.CharField(source="recipe.title", read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id", "body", "is_hidden", "author_email",
            "recipe", "recipe_title", "created_at",
        ]


class AdminScrapedRecipeSerializer(serializers.ModelSerializer):
    requested_by_email = serializers.EmailField(source="requested_by.email", read_only=True)

    class Meta:
        model = ScrapedRecipe
        fields = [
            "id", "url", "status", "requested_by_email",
            "error_message", "imported_recipe", "created_at",
        ]
