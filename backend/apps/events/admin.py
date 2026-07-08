from django.contrib import admin

from apps.events.models import (
    Event,
    EventDish,
    EventDishFulfillment,
    EventIngredient,
    EventInvite,
    EventParticipant,
)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "coordinator", "event_date", "visibility", "created_at"]
    list_filter = ["visibility"]
    search_fields = ["title"]
    raw_id_fields = ["coordinator"]


@admin.register(EventParticipant)
class EventParticipantAdmin(admin.ModelAdmin):
    list_display = ["event", "user", "guest_name", "role", "joined_at"]
    list_filter = ["role"]
    raw_id_fields = ["event", "user"]


@admin.register(EventDish)
class EventDishAdmin(admin.ModelAdmin):
    list_display = ["event", "dish_type", "display_name", "servings", "allow_multiple_fulfillments"]
    list_filter = ["dish_type"]
    raw_id_fields = ["event", "recipe", "added_by"]


admin.site.register(EventInvite)
admin.site.register(EventDishFulfillment)
admin.site.register(EventIngredient)
