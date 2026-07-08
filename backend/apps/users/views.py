import uuid

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import InviteToken, UserProfile
from apps.users.serializers import UserProfileSerializer


class ProfileView(generics.RetrieveUpdateAPIView):
    """GET/PATCH the authenticated user's profile."""

    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        return profile


class ValidateInviteView(APIView):
    """
    GET /api/users/invite/<token>/validate/
    Returns whether an invite token is valid before the user fills in the form.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, token: str):
        try:
            invite = InviteToken.objects.get(token=uuid.UUID(token))
            if invite.is_valid:
                return Response({"valid": True})
            return Response(
                {"valid": False, "reason": "Token expired or exhausted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except (InviteToken.DoesNotExist, ValueError):
            return Response(
                {"valid": False, "reason": "Invalid token."},
                status=status.HTTP_404_NOT_FOUND,
            )
