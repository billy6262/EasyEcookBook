import decimal
import uuid

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.demo import effective_user
from apps.events import notifications
from apps.events.models import (
    Event,
    EventDish,
    EventDishFulfillment,
    EventIngredient,
    EventInvite,
    EventParticipant,
)
from apps.events.permissions import EventAccessPermission
from apps.events.serializers import (
    EventDetailSerializer,
    EventDishSerializer,
    EventInviteSerializer,
    EventListSerializer,
    EventParticipantSerializer,
)
from apps.recipes.models import Recipe, RecipeIngredient


def _resolve_participant(request) -> EventParticipant | None:
    """Return the EventParticipant for either an authenticated user or a guest."""
    return getattr(request, "guest_participant", None)


class EventViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # lists are small; return plain arrays

    def get_serializer_class(self):
        if self.action == "list":
            return EventListSerializer
        return EventDetailSerializer

    def get_permissions(self):
        # Open to anyone (used by the public join / preview flow).
        if self.action in ("join_guest", "invite_preview"):
            return [permissions.AllowAny()]
        # Read + participation actions allow authenticated users OR resolved guests.
        if self.action in (
            "retrieve", "dishes", "fulfill_dish", "claim_ingredient",
            "save_fulfillment_as_recipe", "leave",
        ):
            return [EventAccessPermission()]
        # Everything else (list, create, join, invites, management, update, delete)
        # requires a real account.
        return [permissions.IsAuthenticated()]

    def get_throttles(self):
        if self.action in ("join", "join_guest"):
            self.throttle_scope = "event_join"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        user = effective_user(self.request)
        if self.action == "list":
            if not user.is_authenticated:
                return Event.objects.none()
            return (
                Event.objects.filter(Q(coordinator=user) | Q(participants__user=user))
                .distinct()
                .order_by("event_date")
            )
        # Detail routes: broad base queryset; access is enforced by
        # EventAccessPermission (reads) and _require_coordinator (mutations).
        return Event.objects.all()

    def _require_coordinator(self, event: Event):
        if not self.request.user.is_authenticated or event.coordinator_id != self.request.user.id:
            raise PermissionDenied("Only the coordinator can modify this event.")

    def update(self, request, *args, **kwargs):
        self._require_coordinator(self.get_object())
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._require_coordinator(self.get_object())
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._require_coordinator(self.get_object())
        return super().destroy(request, *args, **kwargs)

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
    @transaction.atomic
    def join(self, request, pk=None):
        """
        Join an event via an invite token.
        Authenticated users are linked to their account.
        Guests provide guest_name + guest_email and receive a guest_token.
        """
        event = get_object_or_404(Event.objects.select_for_update(), pk=pk)
        invite_token_str = request.data.get("invite_token", "").strip()

        if not invite_token_str:
            return Response(
                {"detail": "invite_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = EventParticipant.objects.filter(event=event, user=request.user).first()
        if existing is not None:
            return Response({"participant_id": existing.id})

        try:
            invite = EventInvite.objects.select_for_update().get(
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

        participant = EventParticipant.objects.create(
            event=event,
            user=request.user,
            role=EventParticipant.ROLE_CONTRIBUTOR,
        )
        invite.uses_count += 1
        invite.save(update_fields=["uses_count"])
        transaction.on_commit(lambda: notifications.on_participant_joined(event, participant))

        return Response({"participant_id": participant.id})

    # ── POST /api/events/{id}/join-guest/ ──────────────────────────────────────
    @action(detail=True, methods=["post"], url_path="join-guest", permission_classes=[permissions.AllowAny])
    @transaction.atomic
    def join_guest(self, request, pk=None):
        """Guest join — no account required. Returns a guest_token for subsequent requests."""
        event = get_object_or_404(Event.objects.select_for_update(), pk=pk)
        invite_token_str = request.data.get("invite_token", "").strip()
        guest_name = request.data.get("guest_name", "").strip()
        guest_email = request.data.get("guest_email", "").strip()

        if not invite_token_str:
            return Response({"detail": "invite_token is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not guest_name:
            return Response({"detail": "guest_name is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invite = EventInvite.objects.select_for_update().get(
                token=uuid.UUID(invite_token_str), event=event
            )
        except (EventInvite.DoesNotExist, ValueError):
            return Response({"detail": "Invalid invite token."}, status=status.HTTP_404_NOT_FOUND)

        if not invite.is_valid:
            return Response({"detail": "Invite token is expired or exhausted."}, status=status.HTTP_400_BAD_REQUEST)

        # A bearer token is issued only at the original join. Do not recover one
        # from identity hints; organizers can remove stale participants instead.
        match = None
        if guest_email:
            match = EventParticipant.objects.filter(
                event=event, user__isnull=True, guest_email__iexact=guest_email
            ).first()
        if match is None:
            match = EventParticipant.objects.filter(
                event=event, user__isnull=True, guest_name__iexact=guest_name
            ).first()

        if match is not None:
            return Response(
                {
                    "detail": (
                        "A guest with these details has already joined. Ask the event organizer "
                        "to remove the previous participant before joining again."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        participant = EventParticipant.objects.create(
            event=event,
            guest_name=guest_name,
            guest_email=guest_email,
            role=EventParticipant.ROLE_CONTRIBUTOR,
        )
        invite.uses_count += 1
        invite.save(update_fields=["uses_count"])
        transaction.on_commit(lambda: notifications.on_participant_joined(event, participant))

        return Response(
            {"participant_id": participant.id, "guest_token": str(participant.guest_token)},
            status=status.HTTP_201_CREATED,
        )

    # ── GET/POST /api/events/{id}/invites/ ─────────────────────────────────────
    @action(detail=True, methods=["get", "post"])
    def invites(self, request, pk=None):
        event = self.get_object()
        if event.coordinator != request.user:
            return Response(
                {"detail": "Only the coordinator can manage invites."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.method == "GET":
            qs = event.invites.order_by("-created_at")
            return Response(EventInviteSerializer(qs, many=True).data)

        invite = EventInvite.objects.create(
            event=event,
            max_uses=request.data.get("max_uses") or None,
            expires_at=request.data.get("expires_at") or None,
        )
        return Response(EventInviteSerializer(invite).data, status=status.HTTP_201_CREATED)

    # ── DELETE /api/events/{id}/invites/{token}/ ───────────────────────────────
    @action(detail=True, methods=["delete"], url_path=r"invites/(?P<token>[0-9a-f-]+)")
    def revoke_invite(self, request, pk=None, token=None):
        event = self.get_object()
        if event.coordinator != request.user:
            return Response(
                {"detail": "Only the coordinator can manage invites."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            EventInvite.objects.filter(event=event, token=uuid.UUID(str(token))).delete()
        except ValueError:
            return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── GET /api/events/invite/{token}/ (public preview) ───────────────────────
    @action(detail=False, methods=["get"], url_path=r"invite/(?P<token>[0-9a-f-]+)")
    def invite_preview(self, request, token=None):
        """Public: minimal event info for an invite landing page (before joining)."""
        try:
            invite = EventInvite.objects.select_related("event").get(token=uuid.UUID(str(token)))
        except (EventInvite.DoesNotExist, ValueError):
            return Response({"detail": "Invalid invite."}, status=status.HTTP_404_NOT_FOUND)

        event = invite.event
        already_participant = False
        if request.user.is_authenticated:
            already_participant = EventParticipant.objects.filter(
                event=event, user=request.user
            ).exists()

        return Response({
            "invite_valid": invite.is_valid,
            "event": {
                "id": event.id,
                "title": event.title,
                "description": event.description,
                "event_date": event.event_date,
                "location": event.location,
                "coordinator_name": event.coordinator.get_full_name() or event.coordinator.email,
                "participant_count": event.participants.count(),
            },
            "already_participant": already_participant,
        })

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
                    # Decimal arithmetic throughout (recipe quantities are Decimal;
                    # mixing with float raises TypeError).
                    ratio = decimal.Decimal(str(dish.servings)) / decimal.Decimal(
                        str(recipe.servings or 1)
                    )
                    for ri in RecipeIngredient.objects.filter(recipe=recipe).select_related(
                        "ingredient"
                    ):
                        scaled_qty = None
                        if ri.quantity is not None:
                            scaled_qty = (ri.quantity * ratio).quantize(
                                decimal.Decimal("0.001"),
                                rounding=decimal.ROUND_HALF_UP,
                            )
                        EventIngredient.objects.create(
                            event=event,
                            dish=dish,
                            ingredient_name=ri.ingredient.name,
                            quantity=scaled_qty,
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
            fulfillment = EventDishFulfillment.objects.select_related("fulfilled_by").get(
                pk=fid, dish__event=event
            )
        except EventDishFulfillment.DoesNotExist:
            return Response({"detail": "Fulfillment not found."}, status=status.HTTP_404_NOT_FOUND)

        from apps.recipes.models import Ingredient, Recipe, RecipeIngredient

        # Don't let the same user save the same brought-dish twice.
        existing = Recipe.objects.filter(
            created_by=request.user, source_event_fulfillment=fulfillment.id
        ).first()
        if existing is not None:
            return Response(
                {"recipe_id": existing.id, "already_saved": True},
                status=status.HTTP_200_OK,
            )

        # Record where the recipe came from in its description.
        brought_by = fulfillment.fulfilled_by.display_name
        provenance = f'From "{event.title}" — brought by {brought_by}.'
        description = provenance if not fulfillment.notes else f"{provenance}\n\n{fulfillment.notes}"

        with transaction.atomic():
            recipe = Recipe.objects.create(
                title=fulfillment.custom_name,
                description=description,
                created_by=request.user,
                visibility=Recipe.VISIBILITY_PRIVATE,
                source_event_fulfillment=fulfillment.id,
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

        return Response(
            {"recipe_id": recipe.id, "already_saved": False},
            status=status.HTTP_201_CREATED,
        )

    # ── PATCH/DELETE /api/events/{id}/dishes/{dish_id}/ ────────────────────────
    @action(detail=True, methods=["patch", "delete"], url_path=r"dishes/(?P<dish_id>\d+)")
    def manage_dish(self, request, pk=None, dish_id=None):
        event = self.get_object()
        try:
            dish = EventDish.objects.get(pk=dish_id, event=event)
        except EventDish.DoesNotExist:
            return Response({"detail": "Dish not found."}, status=status.HTTP_404_NOT_FOUND)

        # The coordinator, or the participant who added the dish, may manage it.
        is_coord = event.coordinator_id == getattr(request.user, "id", None)
        participant = _resolve_participant(request)
        if participant is None and request.user.is_authenticated:
            participant = EventParticipant.objects.filter(event=event, user=request.user).first()
        is_adder = dish.added_by_id is not None and participant is not None and dish.added_by_id == participant.id
        if not (is_coord or is_adder):
            return Response(
                {"detail": "You cannot modify this dish."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.method == "DELETE":
            dish.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        # PATCH — limited editable fields
        for field in ("custom_name", "request_description", "notes"):
            if field in request.data:
                setattr(dish, field, request.data[field])
        if "servings" in request.data:
            dish.servings = request.data["servings"]
        dish.save()
        return Response(EventDishSerializer(dish).data)

    # ── DELETE /api/events/{id}/participants/{pid}/ ────────────────────────────
    @action(detail=True, methods=["delete"], url_path=r"participants/(?P<pid>\d+)")
    def remove_participant(self, request, pk=None, pid=None):
        event = self.get_object()
        if event.coordinator_id != request.user.id:
            return Response(
                {"detail": "Only the coordinator can remove participants."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            participant = EventParticipant.objects.get(pk=pid, event=event)
        except EventParticipant.DoesNotExist:
            return Response({"detail": "Participant not found."}, status=status.HTTP_404_NOT_FOUND)
        if participant.role == EventParticipant.ROLE_COORDINATOR:
            return Response(
                {"detail": "The coordinator cannot be removed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        participant.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── POST /api/events/{id}/leave/ ───────────────────────────────────────────
    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        event = self.get_object()
        participant = _resolve_participant(request)
        if participant is None and request.user.is_authenticated:
            participant = EventParticipant.objects.filter(event=event, user=request.user).first()
        if participant is None:
            return Response(
                {"detail": "You are not a participant of this event."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if participant.role == EventParticipant.ROLE_COORDINATOR:
            return Response(
                {"detail": "The coordinator cannot leave; delete the event instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        participant.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
