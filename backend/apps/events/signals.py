"""
Django signal handlers for the events app.
Connected in EventsConfig.ready() to avoid import-time side effects.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver


def connect_signals() -> None:
    """Register signal handlers. Called once from EventsConfig.ready()."""

    from apps.events import notifications
    from apps.events.models import (
        EventDishFulfillment,
        EventIngredient,
        EventParticipant,
    )

    @receiver(post_save, sender=EventParticipant, weak=False)
    def participant_joined(sender, instance, created, **kwargs):
        if created:
            notifications.on_participant_joined(instance.event, instance)

    @receiver(post_save, sender=EventDishFulfillment, weak=False)
    def dish_fulfilled(sender, instance, created, **kwargs):
        if created:
            notifications.on_dish_fulfilled(instance)

    @receiver(post_save, sender=EventIngredient, weak=False)
    def ingredient_claimed(sender, instance, created, **kwargs):
        if not created and instance.claimed_by is not None:
            notifications.on_ingredient_claimed(instance, instance.claimed_by)
