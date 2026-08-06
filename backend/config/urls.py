from django.contrib import admin
from django.urls import path, include

from apps.core.views import DemoLoginView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth (login, logout, password reset, token refresh)
    path("api/auth/", include("dj_rest_auth.urls")),
    # Registration
    path("api/auth/registration/", include("dj_rest_auth.registration.urls")),
    # Read-only demo login
    path("api/auth/demo-login/", DemoLoginView.as_view(), name="demo-login"),
    # App APIs
    path("api/users/", include("apps.users.urls")),
    path("api/recipes/", include("apps.recipes.urls")),
    path("api/events/", include("apps.events.urls")),
    path("api/search/", include("apps.search.urls")),
    path("api/planner/", include("apps.planner.urls")),
    path("api/scraper/", include("apps.scraper.urls")),
    path("api/admin/", include("apps.core.urls")),
]

