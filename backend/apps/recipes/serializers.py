from rest_framework import serializers

from django.core.exceptions import ValidationError as DjangoValidationError

from apps.recipes.models import (
    Category,
    Collection,
    CollectionMembership,
    CollectionRecipe,
    Comment,
    Ingredient,
    Recipe,
    RecipeIngredient,
    Step,
    Tag,
)
from apps.recipes.permissions import recipes_visible_to_request
from apps.scraper.utils import validate_scrape_url


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]
        read_only_fields = ["slug"]  # auto-generated from name in model.save()


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "parent"]
        read_only_fields = ["slug"]  # auto-generated from name in model.save()


class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ["id", "name"]


class RecipeIngredientSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name")

    class Meta:
        model = RecipeIngredient
        fields = ["id", "ingredient_name", "quantity", "unit", "notes", "order"]


class StepSerializer(serializers.ModelSerializer):
    class Meta:
        model = Step
        fields = ["id", "order", "description", "image"]


class RecipeAuthorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()


class RecipeWriteSerializer(serializers.ModelSerializer):
    """Used for CREATE and PATCH — accepts tag_ids and category_id as FK IDs."""

    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(),
        many=True,
        source="tags",
        required=False,
        allow_empty=True,
    )
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source="category",
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Recipe
        fields = [
            "title", "description", "servings", "prep_time", "cook_time",
            "visibility", "cover_image", "cover_image_url", "source_url",
            "tag_ids", "category_id",
        ]

    def validate_cover_image_url(self, value):
        """Reject URLs that resolve to private/reserved networks or embed
        credentials, mirroring the scraper's SSRF-safe URL policy. Browsers
        (not Django) load this URL, so this is defense-in-depth against
        internal-network probing/phishing via a pasted image link, not a
        server-side fetch."""
        if not value:
            return value
        try:
            validate_scrape_url(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                exc.messages[0] if exc.messages else "Invalid image URL."
            )
        return value

    def _set_tags(self, instance, tags):
        if tags is not None:
            instance.tags.set(tags)

    def create(self, validated_data):
        tags = validated_data.pop("tags", [])
        instance = super().create(validated_data)
        instance.tags.set(tags)
        return instance

    def update(self, instance, validated_data):
        tags = validated_data.pop("tags", None)
        instance = super().update(instance, validated_data)
        self._set_tags(instance, tags)
        return instance


class RecipeListSerializer(serializers.ModelSerializer):
    """Lightweight representation for list and search results."""

    created_by = RecipeAuthorSerializer(read_only=True)
    fork_count = serializers.IntegerField(source="forks.count", read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Recipe
        fields = [
            "id", "title", "description", "servings",
            "prep_time", "cook_time", "cover_image", "cover_image_url",
            "visibility", "created_by", "created_at", "fork_count",
            "tags", "category",
        ]


class RecipeDetailSerializer(serializers.ModelSerializer):
    """Full representation including ingredients, steps, tags, and category."""

    ingredients = RecipeIngredientSerializer(many=True, read_only=True)
    steps = StepSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    created_by = RecipeAuthorSerializer(read_only=True)
    fork_count = serializers.IntegerField(source="forks.count", read_only=True)

    class Meta:
        model = Recipe
        fields = [
            "id", "title", "description", "servings",
            "prep_time", "cook_time", "cover_image",
            "visibility", "created_by", "created_at", "updated_at",
            "forked_from", "source_url", "cover_image_url", "tags", "category",
            "ingredients", "steps", "fork_count",
        ]


class CommentSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "author_email", "body", "parent", "created_at"]
        read_only_fields = ["author_email", "created_at"]


class CollectionSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    recipe_count = serializers.IntegerField(source="collection_recipes.count", read_only=True)
    member_count = serializers.IntegerField(source="memberships.count", read_only=True)
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = [
            "id", "name", "description", "visibility",
            "created_by_email", "recipe_count", "member_count",
            "my_role", "created_at",
        ]
        read_only_fields = ["created_by_email", "created_at"]

    def get_my_role(self, obj: Collection) -> str | None:
        """The requesting user's role, or 'owner' if they created it."""
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.created_by_id == request.user.id:
            return CollectionMembership.ROLE_OWNER
        membership = next(
            (m for m in obj.memberships.all() if m.user_id == request.user.id),
            None,
        )
        return membership.role if membership else None


class CollectionMembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = CollectionMembership
        fields = ["id", "user_id", "email", "first_name", "last_name", "role", "joined_at"]
        read_only_fields = ["joined_at"]


class CollectionRecipeSerializer(serializers.ModelSerializer):
    recipe = RecipeListSerializer(read_only=True)
    added_by_email = serializers.EmailField(source="added_by.email", read_only=True)

    class Meta:
        model = CollectionRecipe
        fields = ["id", "recipe", "added_by_email", "added_at"]
        read_only_fields = ["added_by_email", "added_at"]


class CollectionDetailSerializer(CollectionSerializer):
    """Full representation with nested recipes and members."""

    recipes = serializers.SerializerMethodField()
    members = CollectionMembershipSerializer(source="memberships", many=True, read_only=True)

    class Meta(CollectionSerializer.Meta):
        fields = CollectionSerializer.Meta.fields + ["recipes", "members"]

    def get_recipes(self, obj: Collection) -> list:
        qs = obj.collection_recipes.select_related("recipe", "added_by").order_by("-added_at")
        request = self.context.get("request")
        if request is None:
            return []
        visible_recipes = recipes_visible_to_request(
            request,
            Recipe.objects.filter(id__in=qs.values("recipe_id")),
        )
        qs = qs.filter(recipe__in=visible_recipes)
        return CollectionRecipeSerializer(qs, many=True, context=self.context).data
