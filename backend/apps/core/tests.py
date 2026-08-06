from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class DemoLoginTests(APITestCase):
    def test_missing_demo_account_fails_closed_without_creating_one(self):
        response = self.client.post("/api/auth/demo-login/")

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(User.objects.filter(email__iexact=settings.DEMO_ACCOUNT_EMAIL).exists())

    def test_regular_account_at_demo_email_is_not_converted(self):
        user = User.objects.create_user(
            email=settings.DEMO_ACCOUNT_EMAIL,
            password="regular-password",
            username="reserved-email-user",
        )

        response = self.client.post("/api/auth/demo-login/")

        user.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(user.is_demo)