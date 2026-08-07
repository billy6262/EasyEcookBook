from django.contrib import admin
from django.urls import path, include

from apps.core.views import CsrfCookieView, DemoLoginView, PublicSiteSettingsView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth (login, logout, password reset, token refresh)
    path("api/auth/", include("dj_rest_auth.urls")),
    path("api/auth/csrf/", CsrfCookieView.as_view(), name="csrf-cookie"),
    # Registration
    path("api/auth/registration/", include("dj_rest_auth.registration.urls")),
    # Read-only demo login
    path("api/auth/demo-login/", DemoLoginView.as_view(), name="demo-login"),
    # Public site settings (safe subset, no auth required)
    path("api/settings/public/", PublicSiteSettingsView.as_view(), name="public-settings"),
    # App APIs
    path("api/users/", include("apps.users.urls")),
    path("api/recipes/", include("apps.recipes.urls")),
    path("api/events/", include("apps.events.urls")),
    path("api/search/", include("apps.search.urls")),
    path("api/planner/", include("apps.planner.urls")),
    path("api/scraper/", include("apps.scraper.urls")),
    path("api/admin/", include("apps.core.urls")),
]

