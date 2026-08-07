"""
Thin wrapper around the optional MeiliSearch backend for recipe search.

Every function degrades gracefully: when ``settings.MEILISEARCH_ENABLED`` is
False, or the service can't be reached, indexing functions become no-ops and
``search_recipe_ids`` returns ``None`` so callers can fall back to PostgreSQL
full-text search (see ``apps.search.views.RecipeSearchView`` and
``apps.recipes.views.RecipeViewSet``).

A short in-process cooldown avoids hammering an unreachable service with a
slow connection attempt on every single request.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)

_client = None
_unavailable_until = 0.0
_CONNECT_TIMEOUT = 2  # seconds
_COOLDOWN_SECONDS = 30


def _get_client():
    global _client

    if not settings.MEILISEARCH_ENABLED:
        return None
    if time.monotonic() < _unavailable_until:
        return None

    if _client is None:
        import meilisearch

        _client = meilisearch.Client(
            settings.MEILISEARCH_URL,
            settings.MEILI_MASTER_KEY or None,
            timeout=_CONNECT_TIMEOUT,
        )
    return _client


def _mark_unavailable() -> None:
    global _unavailable_until
    _unavailable_until = time.monotonic() + _COOLDOWN_SECONDS


def _get_index():
    client = _get_client()
    if client is None:
        return None
    return client.index(settings.MEILISEARCH_INDEX_RECIPES)


def configure_index() -> bool:
    """Create/configure the recipes index. Safe to call repeatedly."""
    client = _get_client()
    if client is None:
        return False
    try:
        try:
            client.create_index(settings.MEILISEARCH_INDEX_RECIPES, {"primaryKey": "id"})
        except Exception:
            pass  # index likely already exists

        index = client.index(settings.MEILISEARCH_INDEX_RECIPES)
        index.update_searchable_attributes(
            ["title", "description", "tag_names", "category_name"]
        )
        index.update_filterable_attributes(["visibility", "is_hidden", "created_by_id"])
        return True
    except Exception:
        logger.warning("Could not configure MeiliSearch index", exc_info=True)
        _mark_unavailable()
        return False


def _document_for(recipe) -> dict:
    return {
        "id": recipe.id,
        "title": recipe.title,
        "description": recipe.description or "",
        "tag_names": list(recipe.tags.values_list("name", flat=True)),
        "category_name": recipe.category.name if recipe.category_id else "",
        "visibility": recipe.visibility,
        "is_hidden": recipe.is_hidden,
        "created_by_id": recipe.created_by_id,
    }


def index_recipe(recipe) -> None:
    """Upsert a single recipe document. Safe to call from signal handlers."""
    index = _get_index()
    if index is None:
        return
    try:
        index.add_documents([_document_for(recipe)])
    except Exception:
        logger.warning("Failed to index recipe %s in MeiliSearch", recipe.id, exc_info=True)
        _mark_unavailable()


def index_recipes_bulk(recipes) -> int:
    """Upsert many recipe documents at once. Returns the number submitted."""
    index = _get_index()
    if index is None:
        return 0
    docs = [_document_for(r) for r in recipes]
    if not docs:
        return 0
    try:
        index.add_documents(docs)
        return len(docs)
    except Exception:
        logger.warning("Bulk MeiliSearch indexing failed", exc_info=True)
        _mark_unavailable()
        return 0


def delete_recipe(recipe_id: int) -> None:
    index = _get_index()
    if index is None:
        return
    try:
        index.delete_document(recipe_id)
    except Exception:
        logger.warning("Failed to delete recipe %s from MeiliSearch", recipe_id, exc_info=True)
        _mark_unavailable()


def _visibility_filter(request) -> str:
    from apps.core.demo import effective_user
    from apps.recipes.models import Recipe

    owner = effective_user(request)
    if getattr(request.user, "is_staff", False):
        public_clause = f'visibility = "{Recipe.VISIBILITY_PUBLIC}"'
    else:
        public_clause = f'visibility = "{Recipe.VISIBILITY_PUBLIC}" AND is_hidden = false'
    return f"({public_clause}) OR created_by_id = {owner.id}"


def search_recipe_ids(
    request, query: str, limit: int = 30, mine: bool = False
) -> Optional[list[int]]:
    """
    Return a relevance-ordered list of recipe IDs matching `query` and visible
    to `request`, or None if MeiliSearch is disabled/unavailable — callers
    must fall back to the PostgreSQL search path in that case.
    """
    index = _get_index()
    if index is None:
        return None

    if mine:
        from apps.core.demo import effective_user

        filter_expr = f"created_by_id = {effective_user(request).id}"
    else:
        filter_expr = _visibility_filter(request)

    try:
        result = index.search(
            query,
            {
                "filter": filter_expr,
                "limit": limit,
                "attributesToRetrieve": ["id"],
            },
        )
        return [hit["id"] for hit in result["hits"]]
    except Exception:
        logger.warning("MeiliSearch query failed; falling back", exc_info=True)
        _mark_unavailable()
        return None
