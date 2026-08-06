from django.contrib import admin

from apps.planner.models import CookingLog, PlannedMeal, PlannedMealRecipe, ShoppingItem


class PlannedMealRecipeInline(admin.TabularInline):
    model = PlannedMealRecipe
    extra = 0
    raw_id_fields = ["recipe"]


@admin.register(PlannedMeal)
class PlannedMealAdmin(admin.ModelAdmin):
    list_display = ["display_name", "created_by", "status", "planned_date", "is_template"]
    list_filter = ["status", "is_template"]
    raw_id_fields = ["created_by"]
    inlines = [PlannedMealRecipeInline]


@admin.register(ShoppingItem)
class ShoppingItemAdmin(admin.ModelAdmin):
    list_display = ["ingredient_name", "user", "planned_meal", "is_checked", "is_auto_generated"]
    list_filter = ["is_checked", "is_auto_generated"]
    raw_id_fields = ["user", "planned_meal"]


@admin.register(CookingLog)
class CookingLogAdmin(admin.ModelAdmin):
    list_display = ["user", "planned_meal", "cooked_at"]
    raw_id_fields = ["user", "planned_meal"]
