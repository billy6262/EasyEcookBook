from rest_framework import serializers

from apps.planner.models import CookingLog, PlannedMeal, PlannedMealRecipe, ShoppingItem
from apps.recipes.serializers import RecipeListSerializer


class PlannedMealRecipeSerializer(serializers.ModelSerializer):
    recipe = RecipeListSerializer(read_only=True)
    recipe_id = serializers.PrimaryKeyRelatedField(
        source="recipe",
        queryset=__import__("apps.recipes.models", fromlist=["Recipe"]).Recipe.objects.all(),
        write_only=True,
    )

    class Meta:
        model = PlannedMealRecipe
        fields = ["id", "recipe", "recipe_id", "display_order", "target_servings"]


class PlannedMealListSerializer(serializers.ModelSerializer):
    """Lightweight representation for overview lists."""

    display_name = serializers.SerializerMethodField()
    recipe_count = serializers.IntegerField(source="meal_recipes.count", read_only=True)

    class Meta:
        model = PlannedMeal
        fields = [
            "id", "name", "display_name", "planned_date", "status",
            "is_template", "source_template", "shopped_at", "recipe_count", "created_at",
        ]

    def get_display_name(self, obj: PlannedMeal) -> str:
        return obj.display_name


class CookingLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = CookingLog
        fields = ["id", "planned_meal", "cooked_at", "notes"]
        read_only_fields = ["cooked_at"]


class PlannedMealDetailSerializer(serializers.ModelSerializer):
    """Full representation including nested recipes and cooking history."""

    display_name = serializers.SerializerMethodField()
    meal_recipes = PlannedMealRecipeSerializer(many=True, read_only=True)
    cooking_logs = CookingLogSerializer(many=True, read_only=True)
    cooked_count = serializers.IntegerField(source="cooking_logs.count", read_only=True)

    class Meta:
        model = PlannedMeal
        fields = [
            "id", "name", "display_name", "planned_date", "status",
            "is_template", "source_template", "notes", "shopped_at",
            "meal_recipes", "cooking_logs", "cooked_count", "created_at", "updated_at",
        ]

    def get_display_name(self, obj: PlannedMeal) -> str:
        return obj.display_name


class ShoppingItemSerializer(serializers.ModelSerializer):
    planned_meal_name = serializers.SerializerMethodField()

    class Meta:
        model = ShoppingItem
        fields = [
            "id", "planned_meal", "planned_meal_name",
            "ingredient_name", "quantity", "unit",
            "is_checked", "is_auto_generated", "added_at",
        ]
        read_only_fields = ["is_auto_generated", "added_at", "planned_meal_name"]

    def get_planned_meal_name(self, obj: ShoppingItem) -> str | None:
        if obj.planned_meal_id:
            return obj.planned_meal.display_name
        return None



