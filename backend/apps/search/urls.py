from django.urls import path

from apps.search import views

urlpatterns = [
    path("recipes/", views.RecipeSearchView.as_view(), name="recipe-search"),
]
