from django.core.management.base import BaseCommand, CommandError

from apps.recipes.models import Recipe
from apps.search import meilisearch_client
from django.conf import settings


class Command(BaseCommand):
    help = "Configure the MeiliSearch index and (re)index all recipes."

    def handle(self, *args, **options):
        if not settings.MEILISEARCH_ENABLED:
            self.stdout.write(
                self.style.WARNING("MEILISEARCH_ENABLED is false — nothing to do.")
            )
            return

        if not meilisearch_client.configure_index():
            raise CommandError(
                "Could not reach MeiliSearch to configure the index. "
                "Is the service running (docker compose --profile search up)?"
            )

        recipes = list(Recipe.objects.select_related("category").prefetch_related("tags"))
        indexed = meilisearch_client.index_recipes_bulk(recipes)

        if indexed != len(recipes):
            raise CommandError(
                f"Indexed {indexed}/{len(recipes)} recipes — check the MeiliSearch logs."
            )

        self.stdout.write(self.style.SUCCESS(f"Indexed {indexed} recipes."))
