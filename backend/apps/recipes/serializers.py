from rest_framework import serializers

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


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "parent"]


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


class RecipeListSerializer(serializers.ModelSerializer):
    """Lightweight representation for list and search results."""

    created_by = RecipeAuthorSerializer(read_only=True)
    fork_count = serializers.IntegerField(source="forks.count", read_only=True)

    class Meta:
        model = Recipe
        fields = [
            "id", "title", "description", "servings",
            "prep_time", "cook_time", "cover_image",
            "visibility", "created_by", "created_at", "fork_count",
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
            "forked_from", "source_url", "tags", "category",
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
