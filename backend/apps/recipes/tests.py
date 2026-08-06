from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.recipes.models import Recipe, RecipeAccompaniment, Tag


User = get_user_model()


class RecipeAuthorizationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="test-password", username="owner"
        )
        self.viewer = User.objects.create_user(
            email="viewer@example.com", password="test-password", username="viewer"
        )
        self.public_recipe = Recipe.objects.create(
            title="Public recipe", created_by=self.owner, visibility=Recipe.VISIBILITY_PUBLIC
        )
        self.private_recipe = Recipe.objects.create(
            title="Private accompaniment",
            created_by=self.owner,
            visibility=Recipe.VISIBILITY_PRIVATE,
        )
        RecipeAccompaniment.objects.create(
            from_recipe=self.public_recipe,
            to_recipe=self.private_recipe,
            added_by=self.owner,
        )
        self.client.force_authenticate(self.viewer)

    def test_accompaniments_exclude_unreadable_private_recipes(self):
        response = self.client.get(f"/api/recipes/{self.public_recipe.pk}/accompaniments/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_authenticated_user_cannot_create_shared_tag(self):
        response = self.client.post("/api/recipes/tags/", {"name": "Unapproved"})

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Tag.objects.filter(name="Unapproved").exists())

    def test_staff_member_can_create_shared_tag(self):
        self.viewer.is_staff = True
        self.viewer.save(update_fields=["is_staff"])

        response = self.client.post("/api/recipes/tags/", {"name": "Approved"})

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Tag.objects.filter(name="Approved").exists())

    def test_search_excludes_hidden_public_recipe_for_non_owner(self):
        Recipe.objects.create(
            title="Hidden fennel tart",
            created_by=self.owner,
            visibility=Recipe.VISIBILITY_PUBLIC,
            is_hidden=True,
        )

        response = self.client.get("/api/search/recipes/?q=fennel")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"], [])