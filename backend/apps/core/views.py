from datetime import timedelta

from dj_rest_auth.jwt_auth import set_jwt_cookies
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.recipes.models import Comment, Recipe
from apps.scraper.models import ScrapedRecipe
from apps.users.models import InviteToken

from .models import SiteSettings
from .permissions import IsStaff, IsSuperUser
from .serializers import (
    AdminCommentSerializer,
    AdminRecipeSerializer,
    AdminScrapedRecipeSerializer,
    AdminUserSerializer,
    InviteSerializer,
    SiteSettingsSerializer,
)

User = get_user_model()


# ── Site settings ──────────────────────────────────────────────────────────────
class SiteSettingsView(APIView):
    """GET (staff) / PATCH (superuser) the singleton site settings."""

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsSuperUser()]
        return [IsStaff()]

    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.load()).data)

    def patch(self, request):
        site = SiteSettings.load()
        serializer = SiteSettingsSerializer(site, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)


# ── Invite management ────────────────────────────────────────────────────────────
class InviteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaff]
    serializer_class = InviteSerializer
    queryset = InviteToken.objects.select_related("created_by", "used_by").all()
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        return super().get_queryset().order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# ── User management ──────────────────────────────────────────────────────────────
class AdminUserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaff]
    serializer_class = AdminUserSerializer
    queryset = User.objects.all()
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        qs = User.objects.all().order_by("-date_joined")
        params = self.request.query_params
        search = params.get("search")
        if search:
            qs = qs.filter(email__icontains=search) | qs.filter(username__icontains=search)
        active = params.get("is_active")
        if active in ("true", "false"):
            qs = qs.filter(is_active=(active == "true"))
        staff = params.get("is_staff")
        if staff in ("true", "false"):
            qs = qs.filter(is_staff=(staff == "true"))
        return qs.distinct()

    def partial_update(self, request, *args, **kwargs):
        target = self.get_object()
        actor = request.user
        data = request.data

        # Guard rails.
        if target.pk == actor.pk:
            return Response(
                {"detail": "You cannot modify your own account here."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if target.is_demo:
            return Response(
                {"detail": "The demo account cannot be modified."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if "is_staff" in data and not actor.is_superuser:
            return Response(
                {"detail": "Only a superuser can change staff status."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if target.is_superuser and not actor.is_superuser:
            return Response(
                {"detail": "You cannot modify a superuser account."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if "is_active" in data:
            target.is_active = bool(data["is_active"])
        if "is_staff" in data and actor.is_superuser:
            target.is_staff = bool(data["is_staff"])
        target.save(update_fields=["is_active", "is_staff"])
        return Response(AdminUserSerializer(target).data)


# ── Content moderation ───────────────────────────────────────────────────────────
class AdminRecipeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaff]
    serializer_class = AdminRecipeSerializer
    queryset = Recipe.objects.select_related("created_by").all()
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        qs = Recipe.objects.select_related("created_by").all().order_by("-created_at")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(title__icontains=search)
        hidden = self.request.query_params.get("is_hidden")
        if hidden in ("true", "false"):
            qs = qs.filter(is_hidden=(hidden == "true"))
        return qs

    @action(detail=True, methods=["post"])
    def hide(self, request, pk=None):
        recipe = self.get_object()
        recipe.is_hidden = True
        recipe.save(update_fields=["is_hidden"])
        return Response(AdminRecipeSerializer(recipe).data)

    @action(detail=True, methods=["post"])
    def unhide(self, request, pk=None):
        recipe = self.get_object()
        recipe.is_hidden = False
        recipe.save(update_fields=["is_hidden"])
        return Response(AdminRecipeSerializer(recipe).data)


class AdminCommentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsStaff]
    serializer_class = AdminCommentSerializer
    queryset = Comment.objects.select_related("author", "recipe").all()
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        qs = Comment.objects.select_related("author", "recipe").all().order_by("-created_at")
        hidden = self.request.query_params.get("is_hidden")
        if hidden in ("true", "false"):
            qs = qs.filter(is_hidden=(hidden == "true"))
        return qs

    @action(detail=True, methods=["post"])
    def hide(self, request, pk=None):
        comment = self.get_object()
        comment.is_hidden = True
        comment.save(update_fields=["is_hidden"])
        return Response(AdminCommentSerializer(comment).data)

    @action(detail=True, methods=["post"])
    def unhide(self, request, pk=None):
        comment = self.get_object()
        comment.is_hidden = False
        comment.save(update_fields=["is_hidden"])
        return Response(AdminCommentSerializer(comment).data)


# ── Scraped-recipe audit ─────────────────────────────────────────────────────────
class AdminScrapedRecipeViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsStaff]
    serializer_class = AdminScrapedRecipeSerializer
    queryset = ScrapedRecipe.objects.select_related("requested_by").all()

    def get_queryset(self):
        qs = ScrapedRecipe.objects.select_related("requested_by").all().order_by("-created_at")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


# ── Dashboard stats ──────────────────────────────────────────────────────────────
class AdminStatsView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        since = timezone.now() - timedelta(days=30)
        signups = (
            User.objects.filter(date_joined__gte=since)
            .annotate(day=TruncDate("date_joined"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        return Response(
            {
                "total_users": User.objects.count(),
                "active_users": User.objects.filter(is_active=True).count(),
                "staff_users": User.objects.filter(is_staff=True).count(),
                "total_recipes": Recipe.objects.count(),
                "hidden_recipes": Recipe.objects.filter(is_hidden=True).count(),
                "total_comments": Comment.objects.count(),
                "outstanding_invites": sum(
                    1 for i in InviteToken.objects.all() if i.is_valid
                ),
                "signups_last_30d": [
                    {"day": row["day"].isoformat(), "count": row["count"]}
                    for row in signups
                ],
            }
        )


# ── Read-only demo login (public) ────────────────────────────────────────────────
class DemoLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "demo_login"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request):
        site = SiteSettings.load()
        if not site.demo_enabled:
            return Response(
                {"detail": "The demo is currently disabled."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = User.objects.filter(email__iexact=settings.DEMO_ACCOUNT_EMAIL).first()
        if (
            user is None
            or not user.is_demo
            or not user.is_active
            or user.is_staff
            or user.is_superuser
            or user.has_usable_password()
        ):
            return Response(
                {"detail": "The demo is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        refresh = RefreshToken.for_user(user)
        response = Response({"detail": "Logged in to the read-only demo."})
        set_jwt_cookies(response, str(refresh.access_token), str(refresh))
        return response


class PublicSiteSettingsView(APIView):
    """Unauthenticated, minimal subset of SiteSettings safe to expose publicly."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        site = SiteSettings.load()
        return Response({"demo_enabled": site.demo_enabled})


class CsrfCookieView(APIView):
    """Set and return Django's CSRF token for the cookie-authenticated SPA."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})
