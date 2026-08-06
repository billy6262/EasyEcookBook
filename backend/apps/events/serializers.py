from rest_framework import serializers

from apps.events.models import (
    Event,
    EventDish,
    EventDishFulfillment,
    EventIngredient,
    EventInvite,
    EventParticipant,
)


class EventIngredientSerializer(serializers.ModelSerializer):
    claimed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EventIngredient
        fields = [
            "id", "ingredient_name", "quantity", "unit", "notes",
            "is_auto_generated", "claimed_by", "claimed_by_name",
        ]
        read_only_fields = ["is_auto_generated", "claimed_by_name"]

    def get_claimed_by_name(self, obj):
        return obj.claimed_by.display_name if obj.claimed_by else None


class EventDishFulfillmentSerializer(serializers.ModelSerializer):
    ingredients = EventIngredientSerializer(many=True, read_only=True)
    fulfilled_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EventDishFulfillment
        fields = [
            "id", "custom_name", "notes",
            "fulfilled_by_name", "ingredients", "created_at",
        ]
        read_only_fields = ["fulfilled_by_name", "created_at"]

    def get_fulfilled_by_name(self, obj):
        return obj.fulfilled_by.display_name


class EventDishSerializer(serializers.ModelSerializer):
    ingredients = EventIngredientSerializer(many=True, read_only=True)
    fulfillments = EventDishFulfillmentSerializer(many=True, read_only=True)
    display_name = serializers.ReadOnlyField()
    is_fulfilled = serializers.SerializerMethodField()

    class Meta:
        model = EventDish
        fields = [
            "id", "dish_type", "request_description", "display_name",
            "allow_multiple_fulfillments", "servings", "notes",
            "ingredients", "fulfillments", "is_fulfilled",
        ]

    def get_is_fulfilled(self, obj):
        if obj.dish_type != EventDish.DISH_TYPE_REQUEST:
            return True
        if obj.allow_multiple_fulfillments:
            return False  # always open
        return obj.fulfillments.exists()


class EventParticipantSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()
    is_guest = serializers.SerializerMethodField()

    class Meta:
        model = EventParticipant
        fields = ["id", "user", "display_name", "role", "is_guest", "joined_at"]
        read_only_fields = ["user", "display_name", "is_guest", "joined_at"]

    def get_is_guest(self, obj) -> bool:
        return obj.user_id is None


class EventInviteSerializer(serializers.ModelSerializer):
    is_valid = serializers.ReadOnlyField()

    class Meta:
        model = EventInvite
        fields = ["token", "max_uses", "uses_count", "expires_at", "is_valid", "created_at"]
        read_only_fields = ["token", "uses_count", "is_valid", "created_at"]


class EventListSerializer(serializers.ModelSerializer):
    participant_count = serializers.IntegerField(
        source="participants.count", read_only=True
    )

    class Meta:
        model = Event
        fields = [
            "id", "title", "event_date", "location",
            "visibility", "participant_count", "created_at",
        ]


class EventDetailSerializer(serializers.ModelSerializer):
    dishes = EventDishSerializer(many=True, read_only=True)
    participants = EventParticipantSerializer(many=True, read_only=True)
    my_participant_id = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    is_coordinator = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id", "title", "description", "event_date", "location",
            "visibility", "dishes", "participants",
            "my_participant_id", "my_role", "is_coordinator",
            "created_at", "updated_at",
        ]

    def _me(self, obj: Event):
        """Return the requesting user's/guest's EventParticipant for this event."""
        request = self.context.get("request")
        if request is None:
            return None
        guest = getattr(request, "guest_participant", None)
        if guest is not None and guest.event_id == obj.id:
            return guest
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            return next(
                (p for p in obj.participants.all() if p.user_id == user.id),
                None,
            )
        return None

    def get_my_participant_id(self, obj: Event):
        me = self._me(obj)
        return me.id if me else None

    def get_my_role(self, obj: Event):
        me = self._me(obj)
        return me.role if me else None

    def get_is_coordinator(self, obj: Event) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        return bool(user and user.is_authenticated and obj.coordinator_id == user.id)
