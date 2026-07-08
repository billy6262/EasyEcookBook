from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.recipes import views

router = DefaultRouter()
router.register("tags", views.TagViewSet, basename="tag")
router.register("categories", views.CategoryViewSet, basename="category")
router.register("collections", views.CollectionViewSet, basename="collection")
router.register("ingredients", views.IngredientViewSet, basename="ingredient")
router.register("", views.RecipeViewSet, basename="recipe")

urlpatterns = [
    path("", include(router.urls)),
]
