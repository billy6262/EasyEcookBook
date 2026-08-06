from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.planner import views

router = DefaultRouter()
router.register("meals", views.PlannedMealViewSet, basename="planned-meal")
router.register("shopping", views.ShoppingItemViewSet, basename="shopping-item")
router.register("cooking-logs", views.CookingLogViewSet, basename="cooking-log")

urlpatterns = [
    path("", include(router.urls)),
]
