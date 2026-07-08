"""
Middleware that resolves the X-Guest-Token request header to an EventParticipant
and attaches it to request.guest_participant.

This allows event API views to identify unauthenticated guests without
requiring a full Django auth session.

Security notes:
  - Tokens are UUID4 (122 bits of entropy) — brute-forcing is infeasible.
  - A token is only valid for the specific event it was issued for.
  - Guest tokens should be treated as secrets; they are stored in the
    client's localStorage keyed per event.
"""

import uuid


class GuestTokenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.guest_participant = None

        raw_token = request.headers.get("X-Guest-Token", "").strip()
        if raw_token:
            try:
                token = uuid.UUID(raw_token)
                from apps.events.models import EventParticipant

                request.guest_participant = (
                    EventParticipant.objects.select_related("event")
                    .get(guest_token=token, user__isnull=True)
                )
            except (ValueError, AttributeError):
                pass  # Invalid UUID format — ignore silently
            except Exception:  # EventParticipant.DoesNotExist
                pass  # Unknown token — ignore silently

        return self.get_response(request)
