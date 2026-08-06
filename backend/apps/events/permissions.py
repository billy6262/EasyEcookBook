from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.events.models import Event, EventParticipant


class EventAccessPermission(BasePermission):
    """
    Object-level access for events, used by read + participation actions.

    - Public events: readable (SAFE methods) by anyone.
    - Coordinator: full access.
    - A participant (authenticated user) or a resolved guest participant
      (via X-Guest-Token) may read and take part.
    - Everyone else is denied.

    Event mutation (update/delete) and coordinator-only management actions are
    NOT gated here — those use IsAuthenticated plus an explicit coordinator
    check in the view, so that join / join-guest remain open to non-members.
    """

    def has_permission(self, request, view):
        # Defer to object-level checks; all actions using this class are detail routes.
        return True

    def has_object_permission(self, request, view, obj: Event):
        if obj.visibility == Event.VISIBILITY_PUBLIC and request.method in SAFE_METHODS:
            return True

        user = request.user
        if user and user.is_authenticated:
            if obj.coordinator_id == user.id:
                return True
            if EventParticipant.objects.filter(event=obj, user=user).exists():
                return True

        guest = getattr(request, "guest_participant", None)
        if guest is not None and guest.event_id == obj.id:
            return True

        return False
