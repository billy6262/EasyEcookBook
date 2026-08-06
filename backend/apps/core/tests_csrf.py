from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken


User = get_user_model()


class JwtCookieCsrfTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="csrf-staff@example.com",
            password="test-password",
            username="csrf-staff",
            is_staff=True,
        )
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.cookies["auth-token"] = str(AccessToken.for_user(self.user))

    def test_cookie_authenticated_write_requires_csrf_token(self):
        response = self.client.post("/api/recipes/tags/", {"name": "CSRF blocked"})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_csrf_bootstrap_allows_cookie_authenticated_write(self):
        bootstrap = self.client.get("/api/auth/csrf/")
        token = bootstrap.data["csrfToken"]

        response = self.client.post(
            "/api/recipes/tags/",
            {"name": "CSRF accepted"},
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)