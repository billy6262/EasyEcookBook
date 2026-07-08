"""
Notification hooks for event-related actions.

These functions are **currently no-ops** but serve as defined integration points
wired to Django signals. All the data needed for future emails is already captured
in the model arguments.

To add email / async notification support later:
  1. Uncomment Redis + Celery in docker-compose.yml
  2. Install celery + redis packages (see requirements.txt comments)
  3. Move these functions to tasks.py and add @shared_task
  4. Change call sites here to use .delay() / .apply_async()
  5. The signal wiring in signals.py does NOT need to change
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.events.models import (
        Event,
        EventDishFulfillment,
        EventIngredient,
        EventParticipant,
    )


def on_participant_joined(event: "Event", participant: "EventParticipant") -> None:
    """Called when a new participant joins an event."""
    pass  # TODO: email coordinator


def on_dish_fulfilled(fulfillment: "EventDishFulfillment") -> None:
    """Called when an open-request dish is fulfilled by a participant."""
    pass  # TODO: email coordinator


def on_ingredient_claimed(
    ingredient: "EventIngredient", claimer: "EventParticipant"
) -> None:
    """Called when a participant claims an ingredient."""
    pass  # TODO: email coordinator / dish owner


def on_ingredient_unclaimed(
    ingredient: "EventIngredient", previous_claimer: "EventParticipant"
) -> None:
    """Called when a participant removes their ingredient claim."""
    pass  # TODO: notify relevant parties
