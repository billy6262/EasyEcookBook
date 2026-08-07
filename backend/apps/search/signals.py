"""
Keeps the MeiliSearch recipe index in sync with the Recipe model.
Connected once from SearchConfig.ready() to avoid import-time side effects.
"""

from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver


def connect_signals() -> None:
    """Register signal handlers. Called once from SearchConfig.ready()."""

    from apps.recipes.models import Recipe
    from apps.search import meilisearch_client

    @receiver(post_save, sender=Recipe, weak=False)
    def recipe_saved(sender, instance, **kwargs):
        meilisearch_client.index_recipe(instance)

    @receiver(post_delete, sender=Recipe, weak=False)
    def recipe_deleted(sender, instance, **kwargs):
        meilisearch_client.delete_recipe(instance.id)

    @receiver(m2m_changed, sender=Recipe.tags.through, weak=False)
    def recipe_tags_changed(sender, instance, action, **kwargs):
        # Tag names are part of the indexed document, so re-index on any
        # add/remove/clear of the recipe's tags.
        if action in ("post_add", "post_remove", "post_clear"):
            meilisearch_client.index_recipe(instance)
