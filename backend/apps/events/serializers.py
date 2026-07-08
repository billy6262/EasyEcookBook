from rest_framework import serializers

from apps.events.models import (
    Event,
    EventDish,
    EventDishFulfillment,
    EventIngredient,
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

    class Meta:
        model = EventParticipant
        fields = ["id", "display_name", "role", "joined_at"]


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

    class Meta:
        model = Event
        fields = [
            "id", "title", "description", "event_date", "location",
            "visibility", "dishes", "participants", "created_at", "updated_at",
        ]
