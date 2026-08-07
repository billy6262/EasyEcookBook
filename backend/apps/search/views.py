from django.conf import settings
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.recipes.models import Recipe
from apps.recipes.permissions import recipes_visible_to_request
from apps.recipes.serializers import RecipeListSerializer
from apps.search.meilisearch_client import search_recipe_ids


class RecipeSearchView(APIView):
    """
    GET /api/search/recipes/?q=<query>

    Uses MeiliSearch for typo-tolerant, ranked full-text search when
    MEILISEARCH_ENABLED is true and the service is reachable, and
    transparently falls back to PostgreSQL full-text search otherwise —
    always returning the same response shape either way.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"results": [], "count": 0})

        if settings.MEILISEARCH_ENABLED:
            ids = search_recipe_ids(request, query, limit=30)
            if ids is not None:
                recipes_by_id = Recipe.objects.in_bulk(ids)
                ordered = [recipes_by_id[i] for i in ids if i in recipes_by_id]
                serializer = RecipeListSerializer(
                    ordered, many=True, context={"request": request}
                )
                return Response({"results": serializer.data, "count": len(serializer.data)})

        search_query = SearchQuery(query)
        search_vector = (
            SearchVector("title", weight="A")
            + SearchVector("description", weight="B")
        )

        recipes = recipes_visible_to_request(
            request,
            Recipe.objects.annotate(rank=SearchRank(search_vector, search_query))
            .filter(rank__gte=0.05)
        ).order_by("-rank")[:30]

        serializer = RecipeListSerializer(recipes, many=True, context={"request": request})
        return Response({"results": serializer.data, "count": len(serializer.data)})
