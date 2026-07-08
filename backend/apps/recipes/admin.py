from django.contrib import admin

from apps.recipes.models import (
    Category,
    Collection,
    CollectionMembership,
    Comment,
    Ingredient,
    Recipe,
    RecipeIngredient,
    Step,
    Tag,
)


class RecipeIngredientInline(admin.TabularInline):
    model = RecipeIngredient
    extra = 0


class StepInline(admin.TabularInline):
    model = Step
    extra = 0


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ["title", "created_by", "visibility", "created_at"]
    list_filter = ["visibility", "created_at"]
    search_fields = ["title", "description"]
    raw_id_fields = ["created_by", "forked_from"]
    inlines = [RecipeIngredientInline, StepInline]


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "parent"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ["name", "created_by", "visibility", "created_at"]
    raw_id_fields = ["created_by"]


admin.site.register(CollectionMembership)
admin.site.register(Comment)
