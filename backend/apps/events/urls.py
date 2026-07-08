from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.events import views

router = DefaultRouter()
router.register("", views.EventViewSet, basename="event")

urlpatterns = [
    path("", include(router.urls)),
]
