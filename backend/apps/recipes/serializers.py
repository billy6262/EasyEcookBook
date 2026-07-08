from rest_framework import serializers

from apps.recipes.models import (
    Category,
    Collection,
    Comment,
    Ingredient,
    Recipe,
    RecipeIngredient,
    Step,
    Tag,
)


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

    class Meta:
        model = Collection
        fields = ["id", "name", "description", "visibility", "created_by_email", "recipe_count", "created_at"]
        read_only_fields = ["created_by_email", "created_at"]
