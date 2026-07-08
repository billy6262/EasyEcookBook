from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children",
    )

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Tag(models.Model):
    name = models.CharField(max_length=50)
    slug = models.SlugField(unique=True, blank=True)

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Ingredient(models.Model):
    """Normalised ingredient dictionary shared across all recipes."""

    name = models.CharField(max_length=200, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Recipe(models.Model):
    VISIBILITY_PUBLIC = "public"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, "Public"),
        (VISIBILITY_PRIVATE, "Private"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    servings = models.PositiveIntegerField(default=4)
    prep_time = models.PositiveIntegerField(help_text="Minutes", null=True, blank=True)
    cook_time = models.PositiveIntegerField(help_text="Minutes", null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recipes"
    )
    cover_image = models.ImageField(upload_to="recipes/covers/", null=True, blank=True)
    cover_image_url = models.URLField(null=True, blank=True)  # user-supplied URL alternative
    visibility = models.CharField(
        max_length=10, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC
    )
    forked_from = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="forks",
    )
    source_url = models.URLField(null=True, blank=True)
    tags = models.ManyToManyField(Tag, blank=True)
    category = models.ForeignKey(
        Category,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="recipes",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(
        Recipe, on_delete=models.CASCADE, related_name="ingredients"
    )
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    unit = models.CharField(max_length=50, blank=True)
    notes = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self) -> str:
        return f"{self.ingredient.name} ({self.recipe.title})"


class Step(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name="steps")
    order = models.PositiveIntegerField()
    description = models.TextField()
    image = models.ImageField(upload_to="recipes/steps/", null=True, blank=True)

    class Meta:
        ordering = ["order"]
        unique_together = [["recipe", "order"]]

    def __str__(self) -> str:
        return f"Step {self.order} — {self.recipe.title}"


class Collection(models.Model):
    VISIBILITY_PUBLIC = "public"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, "Public"),
        (VISIBILITY_PRIVATE, "Private"),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="collections"
    )
    visibility = models.CharField(
        max_length=10, choices=VISIBILITY_CHOICES, default=VISIBILITY_PRIVATE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class CollectionMembership(models.Model):
    ROLE_OWNER = "owner"
    ROLE_CONTRIBUTOR = "contributor"
    ROLE_VIEWER = "viewer"
    ROLE_CHOICES = [
        (ROLE_OWNER, "Owner"),
        (ROLE_CONTRIBUTOR, "Contributor"),
        (ROLE_VIEWER, "Viewer"),
    ]

    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="collection_memberships",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_VIEWER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [["collection", "user"]]

    def __str__(self) -> str:
        return f"{self.user} — {self.collection} ({self.role})"


class CollectionRecipe(models.Model):
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="collection_recipes"
    )
    recipe = models.ForeignKey(
        Recipe, on_delete=models.CASCADE, related_name="collection_memberships"
    )
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="added_collection_recipes",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [["collection", "recipe"]]


class Comment(models.Model):
    recipe = models.ForeignKey(
        Recipe, on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    body = models.TextField()
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="replies",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"Comment by {self.author} on {self.recipe}"


class RecipeAccompaniment(models.Model):
    """
    Bidirectional link between two recipes (e.g. pasta ↔ garlic bread).
    A single row represents both directions — when fetching accompaniments
    for a recipe, query both from_recipe and to_recipe columns.
    """

    from_recipe = models.ForeignKey(
        Recipe, on_delete=models.CASCADE, related_name="accompaniments_from"
    )
    to_recipe = models.ForeignKey(
        Recipe, on_delete=models.CASCADE, related_name="accompaniments_to"
    )
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="added_accompaniments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [["from_recipe", "to_recipe"]]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(from_recipe=models.F("to_recipe")),
                name="accompaniment_no_self_link",
            )
        ]

    def __str__(self) -> str:
        return f"{self.from_recipe} ↔ {self.to_recipe}"
