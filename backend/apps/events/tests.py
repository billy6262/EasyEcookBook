from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.events.models import Event, EventInvite, EventParticipant


User = get_user_model()


class EventInviteSecurityTests(APITestCase):
    def setUp(self):
        self.coordinator = User.objects.create_user(
            email="coordinator@example.com",
            password="test-password",
            username="coordinator",
        )
        self.event = Event.objects.create(
            title="Security test event",
            event_date=timezone.now(),
            coordinator=self.coordinator,
        )

    def test_guest_identity_match_never_returns_existing_bearer_token(self):
        invite = EventInvite.objects.create(event=self.event, max_uses=2)
        existing = EventParticipant.objects.create(
            event=self.event,
            guest_name="Existing Guest",
            guest_email="guest@example.com",
        )

        response = self.client.post(
            f"/api/events/{self.event.pk}/join-guest/",
            {
                "invite_token": str(invite.token),
                "guest_name": "Existing Guest",
                "guest_email": "guest@example.com",
                "resume": True,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertNotIn("guest_token", response.data)
        self.assertNotIn(str(existing.guest_token), str(response.data))

    def test_exhausted_invite_cannot_add_another_guest(self):
        invite = EventInvite.objects.create(event=self.event, max_uses=1)
        payload = {
            "invite_token": str(invite.token),
            "guest_name": "First Guest",
            "guest_email": "first@example.com",
        }

        first_response = self.client.post(f"/api/events/{self.event.pk}/join-guest/", payload)
        payload.update({"guest_name": "Second Guest", "guest_email": "second@example.com"})
        second_response = self.client.post(f"/api/events/{self.event.pk}/join-guest/", payload)

        invite.refresh_from_db()
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invite.uses_count, 1)