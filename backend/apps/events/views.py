import uuid

from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.events import notifications
from apps.events.models import (
    Event,
    EventDish,
    EventDishFulfillment,
    EventIngredient,
    EventInvite,
    EventParticipant,
)
from apps.events.serializers import (
    EventDetailSerializer,
    EventDishSerializer,
    EventListSerializer,
)
from apps.recipes.models import Recipe, RecipeIngredient


def _resolve_participant(request) -> EventParticipant | None:
    """Return the EventParticipant for either an authenticated user or a guest."""
    return getattr(request, "guest_participant", None)


class EventViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "list":
            return EventListSerializer
        return EventDetailSerializer

    def get_queryset(self):
        return Event.objects.filter(coordinator=self.request.user)

    @transaction.atomic
    def perform_create(self, serializer):
        event = serializer.save(coordinator=self.request.user)
        # Auto-enrol the coordinator as a participant
        EventParticipant.objects.create(
            event=event,
            user=self.request.user,
            role=EventParticipant.ROLE_COORDINATOR,
        )

    # ── POST /api/events/{id}/join/ ────────────────────────────────────────────
    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        """
        Join an event via an invite token.
        Authenticated users are linked to their account.
        Guests provide guest_name + guest_email and receive a guest_token.
        """
        event = self.get_object()
        invite_token_str = request.data.get("invite_token", "").strip()

        if not invite_token_str:
            return Response(
                {"detail": "invite_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            invite = EventInvite.objects.get(
                token=uuid.UUID(invite_token_str), event=event
            )
        except (EventInvite.DoesNotExist, ValueError):
            return Response(
                {"detail": "Invalid invite token."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not invite.is_valid:
            return Response(
                {"detail": "Invite token is expired or exhausted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Authenticated user join
        participant, created = EventParticipant.objects.get_or_create(
            event=event,
            user=request.user,
            defaults={"role": EventParticipant.ROLE_CONTRIBUTOR},
        )
        if created:
            invite.uses_count += 1
            invite.save(update_fields=["uses_count"])
            notifications.on_participant_joined(event, participant)

        return Response({"participant_id": participant.id})

    # ── POST /api/events/{id}/join-guest/ ──────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="join-guest", permission_classes=[permissions.AllowAny])
    def join_guest(self, request, pk=None):
        """Guest join — no account required. Returns a guest_token for subsequent requests."""
        event = self.get_object()
        invite_token_str = request.data.get("invite_token", "").strip()
        guest_name = request.data.get("guest_name", "").strip()
        guest_email = request.data.get("guest_email", "").strip()

        if not invite_token_str:
            return Response({"detail": "invite_token is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not guest_name:
            return Response({"detail": "guest_name is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invite = EventInvite.objects.get(token=uuid.UUID(invite_token_str), event=event)
        except (EventInvite.DoesNotExist, ValueError):
            return Response({"detail": "Invalid invite token."}, status=status.HTTP_404_NOT_FOUND)

        if not invite.is_valid:
            return Response({"detail": "Invite token is expired or exhausted."}, status=status.HTTP_400_BAD_REQUEST)

        participant = EventParticipant.objects.create(
            event=event,
            guest_name=guest_name,
            guest_email=guest_email,
            role=EventParticipant.ROLE_CONTRIBUTOR,
        )
        invite.uses_count += 1
        invite.save(update_fields=["uses_count"])
        notifications.on_participant_joined(event, participant)

        return Response(
            {"participant_id": participant.id, "guest_token": str(participant.guest_token)},
            status=status.HTTP_201_CREATED,
        )

    # ── POST /api/events/{id}/invites/ ─────────────────────────────────────────
    @action(detail=True, methods=["post"])
    def invites(self, request, pk=None):
        event = self.get_object()
        if event.coordinator != request.user:
            return Response(
                {"detail": "Only the coordinator can create invites."},
                status=status.HTTP_403_FORBIDDEN,
            )
        invite = EventInvite.objects.create(
            event=event,
            max_uses=request.data.get("max_uses") or None,
            expires_at=request.data.get("expires_at") or None,
        )
        return Response(
            {"token": str(invite.token), "max_uses": invite.max_uses, "expires_at": invite.expires_at},
            status=status.HTTP_201_CREATED,
        )

    # ── POST /api/events/{id}/dishes/ ─────────────────────────────────────────
    @action(detail=True, methods=["post", "get"])
    def dishes(self, request, pk=None):
        event = self.get_object()

        if request.method == "GET":
            return Response(EventDishSerializer(event.dishes.all(), many=True).data)

        participant = _resolve_participant(request)
        if not participant:
            try:
                participant = EventParticipant.objects.get(event=event, user=request.user)
            except EventParticipant.DoesNotExist:
                return Response({"detail": "You are not a participant of this event."}, status=status.HTTP_403_FORBIDDEN)

        dish_type = request.data.get("dish_type", EventDish.DISH_TYPE_CUSTOM)
        recipe_id = request.data.get("recipe_id")

        with transaction.atomic():
            dish = EventDish.objects.create(
                event=event,
                dish_type=dish_type,
                recipe_id=recipe_id if dish_type == EventDish.DISH_TYPE_LINKED else None,
                request_description=request.data.get("request_description", ""),
                allow_multiple_fulfillments=request.data.get("allow_multiple_fulfillments", False),
                custom_name=request.data.get("custom_name", ""),
                servings=request.data.get("servings", 4),
                notes=request.data.get("notes", ""),
                added_by=participant,
            )

            # Auto-generate ingredients from a linked recipe
            if dish_type == EventDish.DISH_TYPE_LINKED and recipe_id:
                try:
                    recipe = Recipe.objects.get(pk=recipe_id)
                    ratio = dish.servings / (recipe.servings or 1)
                    for ri in RecipeIngredient.objects.filter(recipe=recipe):
                        EventIngredient.objects.create(
                            event=event,
                            dish=dish,
                            ingredient_name=ri.ingredient.name,
                            quantity=round(ri.quantity * ratio, 3) if ri.quantity else None,
                            unit=ri.unit,
                            is_auto_generated=True,
                        )
                except Recipe.DoesNotExist:
                    pass

        return Response(EventDishSerializer(dish).data, status=status.HTTP_201_CREATED)

    # ── POST /api/events/{id}/dishes/{dish_id}/fulfill/ ───────────────────────
    @action(detail=True, methods=["post"], url_path=r"dishes/(?P<dish_id>\d+)/fulfill")
    def fulfill_dish(self, request, pk=None, dish_id=None):
        event = self.get_object()

        try:
            dish = EventDish.objects.get(pk=dish_id, event=event, dish_type=EventDish.DISH_TYPE_REQUEST)
        except EventDish.DoesNotExist:
            return Response({"detail": "Open request not found."}, status=status.HTTP_404_NOT_FOUND)

        if not dish.allow_multiple_fulfillments and dish.fulfillments.exists():
            return Response({"detail": "This request has already been fulfilled."}, status=status.HTTP_409_CONFLICT)

        participant = _resolve_participant(request)
        if not participant:
            try:
                participant = EventParticipant.objects.get(event=event, user=request.user)
            except EventParticipant.DoesNotExist:
                return Response({"detail": "You are not a participant of this event."}, status=status.HTTP_403_FORBIDDEN)

        custom_name = request.data.get("custom_name", "").strip()
        if not custom_name:
            return Response({"detail": "custom_name is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            fulfillment = EventDishFulfillment.objects.create(
                dish=dish,
                fulfilled_by=participant,
                custom_name=custom_name,
                notes=request.data.get("notes", ""),
            )
            # Create ingredient requests from this fulfillment
            for ing in request.data.get("ingredient_requests", []):
                EventIngredient.objects.create(
                    event=event,
                    fulfillment=fulfillment,
                    ingredient_name=ing.get("name", ""),
                    quantity=ing.get("quantity"),
                    unit=ing.get("unit", ""),
                    notes=ing.get("notes", ""),
                )

        notifications.on_dish_fulfilled(fulfillment)
        from apps.events.serializers import EventDishFulfillmentSerializer
        return Response(EventDishFulfillmentSerializer(fulfillment).data, status=status.HTTP_201_CREATED)

    # ── POST /api/events/{id}/ingredients/{ing_id}/claim/ ─────────────────────
    @action(detail=True, methods=["post", "delete"], url_path=r"ingredients/(?P<ing_id>\d+)/claim")
    def claim_ingredient(self, request, pk=None, ing_id=None):
        event = self.get_object()

        try:
            ingredient = EventIngredient.objects.get(pk=ing_id, event=event)
        except EventIngredient.DoesNotExist:
            return Response({"detail": "Ingredient not found."}, status=status.HTTP_404_NOT_FOUND)

        participant = _resolve_participant(request)
        if not participant:
            try:
                participant = EventParticipant.objects.get(event=event, user=request.user)
            except EventParticipant.DoesNotExist:
                return Response({"detail": "You are not a participant of this event."}, status=status.HTTP_403_FORBIDDEN)

        if request.method == "DELETE":
            if ingredient.claimed_by == participant:
                prev = ingredient.claimed_by
                ingredient.claimed_by = None
                ingredient.save(update_fields=["claimed_by"])
                notifications.on_ingredient_unclaimed(ingredient, prev)
            return Response(status=status.HTTP_204_NO_CONTENT)

        # POST — claim
        if ingredient.claimed_by is not None:
            return Response({"detail": "Already claimed."}, status=status.HTTP_409_CONFLICT)

        ingredient.claimed_by = participant
        ingredient.save(update_fields=["claimed_by"])
        notifications.on_ingredient_claimed(ingredient, participant)
        return Response({"detail": "Claimed."})

    # ── POST /api/events/{id}/fulfillments/{fid}/save-as-recipe/ ─────────────
    @action(detail=True, methods=["post"], url_path=r"fulfillments/(?P<fid>\d+)/save-as-recipe")
    def save_fulfillment_as_recipe(self, request, pk=None, fid=None):
        """Promote a fulfillment's ingredient list into a proper Recipe (registered users only)."""
        if not request.user or not request.user.is_authenticated:
            return Response({"detail": "Must be logged in to save a recipe."}, status=status.HTTP_401_UNAUTHORIZED)

        event = self.get_object()
        try:
            fulfillment = EventDishFulfillment.objects.get(pk=fid, dish__event=event)
        except EventDishFulfillment.DoesNotExist:
            return Response({"detail": "Fulfillment not found."}, status=status.HTTP_404_NOT_FOUND)

        from apps.recipes.models import Ingredient, Recipe, RecipeIngredient

        with transaction.atomic():
            recipe = Recipe.objects.create(
                title=fulfillment.custom_name,
                description=fulfillment.notes,
                created_by=request.user,
                visibility=Recipe.VISIBILITY_PRIVATE,
            )
            for idx, ing in enumerate(fulfillment.ingredients.all()):
                ingredient_obj, _ = Ingredient.objects.get_or_create(name=ing.ingredient_name)
                RecipeIngredient.objects.create(
                    recipe=recipe,
                    ingredient=ingredient_obj,
                    quantity=ing.quantity,
                    unit=ing.unit,
                    notes=ing.notes,
                    order=idx,
                )

        return Response({"recipe_id": recipe.id}, status=status.HTTP_201_CREATED)
