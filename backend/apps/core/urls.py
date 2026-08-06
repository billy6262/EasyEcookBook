from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminCommentViewSet,
    AdminRecipeViewSet,
    AdminScrapedRecipeViewSet,
    AdminStatsView,
    AdminUserViewSet,
    InviteViewSet,
    SiteSettingsView,
)

router = DefaultRouter()
router.register("invites", InviteViewSet, basename="admin-invite")
router.register("users", AdminUserViewSet, basename="admin-user")
router.register("recipes", AdminRecipeViewSet, basename="admin-recipe")
router.register("comments", AdminCommentViewSet, basename="admin-comment")
router.register("scraped-recipes", AdminScrapedRecipeViewSet, basename="admin-scraped")

urlpatterns = [
    path("settings/", SiteSettingsView.as_view(), name="admin-settings"),
    path("stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("", include(router.urls)),
]
