from django.conf import settings
from django.db import models


class PlannedMeal(models.Model):
    STATUS_PLANNED = "planned"
    STATUS_SHOPPING = "shopping"
    STATUS_SHOPPED = "shopped"
    STATUS_COOKED = "cooked"
    STATUS_CHOICES = [
        (STATUS_PLANNED, "Planned"),
        (STATUS_SHOPPING, "Shopping"),
        (STATUS_SHOPPED, "Shopped"),
        (STATUS_COOKED, "Cooked"),
    ]

    name = models.CharField(max_length=200, blank=True)
    planned_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PLANNED
    )
    is_template = models.BooleanField(default=False)
    # Set when this meal was created by duplicating a template
    source_template = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="instances",
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="planned_meals",
    )
    # Set automatically when status transitions to 'shopped'
    shopped_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["planned_date", "-created_at"]

    @property
    def display_name(self) -> str:
        if self.name:
            return self.name
        # Derive from first 3 linked recipe titles
        titles = list(
            self.meal_recipes.select_related("recipe")
            .values_list("recipe__title", flat=True)[:3]
        )
        return " + ".join(titles) if titles else "Unnamed meal"

    def __str__(self) -> str:
        return self.display_name


class PlannedMealRecipe(models.Model):
    """Through model linking recipes to a planned meal, with optional serving scale."""

    planned_meal = models.ForeignKey(
        PlannedMeal, on_delete=models.CASCADE, related_name="meal_recipes"
    )
    recipe = models.ForeignKey(
        "recipes.Recipe", on_delete=models.CASCADE, related_name="meal_appearances"
    )
    display_order = models.PositiveIntegerField(default=0)
    # If null, use recipe.servings as-is. Otherwise scale ingredient quantities.
    target_servings = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["display_order"]
        unique_together = [["planned_meal", "recipe"]]

    def __str__(self) -> str:
        return f"{self.recipe.title} in {self.planned_meal}"


class ShoppingItem(models.Model):
    """
    Global per-user shopping list item.
    Auto-generated items are linked to a planned meal; manual items have planned_meal=None.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shopping_items",
    )
    planned_meal = models.ForeignKey(
        PlannedMeal,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="shopping_items",
    )
    ingredient_name = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    unit = models.CharField(max_length=50, blank=True)
    is_checked = models.BooleanField(default=False)
    is_auto_generated = models.BooleanField(default=False)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["planned_meal", "added_at"]

    def __str__(self) -> str:
        return f"{self.ingredient_name} ({self.user})"


class CookingLog(models.Model):
    """Records each time a user cooks a meal."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cooking_logs",
    )
    planned_meal = models.ForeignKey(
        PlannedMeal,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cooking_logs",
    )
    cooked_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-cooked_at"]

    def __str__(self) -> str:
        return f"{self.user} cooked {self.planned_meal} at {self.cooked_at:%Y-%m-%d}"
