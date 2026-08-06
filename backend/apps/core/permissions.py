from rest_framework.permissions import BasePermission


class IsStaff(BasePermission):
    """Allow access only to active staff members."""

    message = "Staff privileges are required for this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff)


class IsSuperUser(BasePermission):
    """Allow access only to superusers (sensitive actions)."""

    message = "Superuser privileges are required for this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)
