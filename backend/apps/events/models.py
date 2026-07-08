import uuid

from django.conf import settings
from django.db import models


class Event(models.Model):
    VISIBILITY_PUBLIC = "public"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, "Public"),
        (VISIBILITY_PRIVATE, "Private"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    event_date = models.DateTimeField()
    location = models.CharField(max_length=300, blank=True)
    coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="coordinated_events",
    )
    visibility = models.CharField(
        max_length=10, choices=VISIBILITY_CHOICES, default=VISIBILITY_PRIVATE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["event_date"]

    def __str__(self) -> str:
        return self.title


class EventInvite(models.Model):
    """Shareable invite link for an event. Can be limited by uses or expiry."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="invites")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    max_uses = models.PositiveIntegerField(null=True, blank=True)  # null = unlimited
    uses_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_valid(self) -> bool:
        from django.utils import timezone

        if self.expires_at and self.expires_at < timezone.now():
            return False
        if self.max_uses is not None and self.uses_count >= self.max_uses:
            return False
        return True

    def __str__(self) -> str:
        return f"Invite({self.event} — {str(self.token)[:8]}…)"


class EventParticipant(models.Model):
    """
    Represents either a registered user or an anonymous guest at an event.
    Exactly one of (user, guest_name) must be set.
    """

    ROLE_COORDINATOR = "coordinator"
    ROLE_CONTRIBUTOR = "contributor"
    ROLE_CHOICES = [
        (ROLE_COORDINATOR, "Coordinator"),
        (ROLE_CONTRIBUTOR, "Contributor"),
    ]

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="participants"
    )
    # Registered user path
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="event_participations",
    )
    # Guest path
    guest_name = models.CharField(max_length=150, blank=True)
    guest_email = models.EmailField(blank=True)
    guest_token = models.UUIDField(default=uuid.uuid4, null=True, blank=True, unique=True)

    role = models.CharField(
        max_length=20, choices=ROLE_CHOICES, default=ROLE_CONTRIBUTOR
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["event", "user"],
                condition=models.Q(user__isnull=False),
                name="unique_user_per_event",
            )
        ]

    @property
    def display_name(self) -> str:
        if self.user:
            return self.user.get_full_name() or self.user.email
        return self.guest_name

    def __str__(self) -> str:
        return f"{self.display_name} @ {self.event}"


class EventDish(models.Model):
    """
    A dish slot on an event. Three types:
      linked_recipe  — coordinator attached an existing Recipe
      custom         — coordinator defined a specific named dish
      open_request   — coordinator posted a request; participants can fulfil it
    """

    DISH_TYPE_LINKED = "linked_recipe"
    DISH_TYPE_CUSTOM = "custom"
    DISH_TYPE_REQUEST = "open_request"
    DISH_TYPE_CHOICES = [
        (DISH_TYPE_LINKED, "Linked Recipe"),
        (DISH_TYPE_CUSTOM, "Custom Dish"),
        (DISH_TYPE_REQUEST, "Open Request"),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="dishes")
    dish_type = models.CharField(max_length=20, choices=DISH_TYPE_CHOICES)

    # linked_recipe type
    recipe = models.ForeignKey(
        "recipes.Recipe",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="event_dishes",
    )

    # open_request type
    request_description = models.CharField(max_length=300, blank=True)
    allow_multiple_fulfillments = models.BooleanField(default=False)

    # custom type (also used as display name for fulfilled open_requests)
    custom_name = models.CharField(max_length=200, blank=True)

    servings = models.PositiveIntegerField(default=4)
    added_by = models.ForeignKey(
        EventParticipant,
        on_delete=models.SET_NULL,
        null=True,
        related_name="added_dishes",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def display_name(self) -> str:
        if self.dish_type == self.DISH_TYPE_LINKED and self.recipe:
            return self.recipe.title
        return self.custom_name or self.request_description

    def __str__(self) -> str:
        return f"{self.display_name} ({self.event})"


class EventDishFulfillment(models.Model):
    """
    Records a participant's commitment to fulfil an open_request EventDish.
    If EventDish.allow_multiple_fulfillments is False, only one row is allowed
    per dish (enforced at the view level to return a 409 for races).
    """

    dish = models.ForeignKey(
        EventDish, on_delete=models.CASCADE, related_name="fulfillments"
    )
    fulfilled_by = models.ForeignKey(
        EventParticipant, on_delete=models.CASCADE, related_name="fulfillments"
    )
    custom_name = models.CharField(max_length=200)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.fulfilled_by.display_name} → {self.custom_name}"


class EventIngredient(models.Model):
    """
    A claimable ingredient associated with a dish or a fulfillment.
    Exactly one of (dish, fulfillment) must be set — enforced by a DB constraint.

    dish         → coordinator-defined or auto-generated from a linked Recipe
    fulfillment  → participant-added when fulfilling an open_request dish
    """

    # Denormalised FK for efficient per-event queries
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="ingredients"
    )
    dish = models.ForeignKey(
        EventDish,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ingredients",
    )
    fulfillment = models.ForeignKey(
        EventDishFulfillment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ingredients",
    )

    ingredient_name = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    unit = models.CharField(max_length=50, blank=True)
    is_auto_generated = models.BooleanField(default=False)

    claimed_by = models.ForeignKey(
        EventParticipant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="claimed_ingredients",
    )
    notes = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(dish__isnull=False, fulfillment__isnull=True)
                    | models.Q(dish__isnull=True, fulfillment__isnull=False)
                ),
                name="event_ingredient_exactly_one_parent",
            )
        ]

    def __str__(self) -> str:
        return f"{self.ingredient_name} ({self.event})"
