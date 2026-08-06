from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.recipes.models import Recipe
from apps.recipes.serializers import RecipeListSerializer


class RecipeSearchView(APIView):
    """
    GET /api/search/recipes/?q=<query>

    Full-text search over recipe titles and descriptions using PostgreSQL's
    built-in tsvector/tsquery. This is the default search backend.

    For better relevance ranking and typo tolerance, enable the optional
    MeiliSearch service:  docker compose --profile search up
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"results": [], "count": 0})

        search_query = SearchQuery(query)
        search_vector = (
            SearchVector("title", weight="A")
            + SearchVector("description", weight="B")
        )

        recipes = (
            Recipe.objects.annotate(rank=SearchRank(search_vector, search_query))
            .filter(rank__gte=0.05)
            .filter(
                Q(visibility=Recipe.VISIBILITY_PUBLIC)
                | Q(created_by=request.user)
            )
            .order_by("-rank")
            .distinct()[:30]
        )

        serializer = RecipeListSerializer(recipes, many=True, context={"request": request})
        return Response({"results": serializer.data, "count": len(serializer.data)})
