from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.recipes.models import (
    Category,
    Collection,
    Recipe,
    RecipeIngredient,
    Step,
    Tag,
)
from apps.recipes.permissions import IsRecipeOwnerOrReadOnly
from apps.recipes.serializers import (
    CategorySerializer,
    CollectionSerializer,
    CommentSerializer,
    RecipeDetailSerializer,
    RecipeListSerializer,
    TagSerializer,
)


class RecipeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsRecipeOwnerOrReadOnly]

    def get_serializer_class(self):
        if self.action == "list":
            return RecipeListSerializer
        return RecipeDetailSerializer

    def get_queryset(self):
        user = self.request.user
        # Public recipes + the user's own (public or private)
        return (
            Recipe.objects.filter(visibility=Recipe.VISIBILITY_PUBLIC)
            | Recipe.objects.filter(created_by=user)
        ).distinct().order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def fork(self, request, pk=None):
        """Deep-copy a recipe into the current user's account."""
        original = self.get_object()

        forked = Recipe.objects.create(
            title=f"{original.title} (fork)",
            description=original.description,
            servings=original.servings,
            prep_time=original.prep_time,
            cook_time=original.cook_time,
            created_by=request.user,
            visibility=Recipe.VISIBILITY_PRIVATE,
            forked_from=original,
            source_url=original.source_url,
        )

        for ri in original.ingredients.all():
            RecipeIngredient.objects.create(
                recipe=forked,
                ingredient=ri.ingredient,
                quantity=ri.quantity,
                unit=ri.unit,
                notes=ri.notes,
                order=ri.order,
            )

        for step in original.steps.all():
            # Images are not copied — they point to the original media object
            Step.objects.create(
                recipe=forked,
                order=step.order,
                description=step.description,
            )

        forked.tags.set(original.tags.all())

        serializer = RecipeDetailSerializer(forked, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        recipe = self.get_object()
        if request.method == "GET":
            qs = recipe.comments.filter(parent__isnull=True).prefetch_related("replies")
            return Response(CommentSerializer(qs, many=True).data)
        serializer = CommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(recipe=recipe, author=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.select_related("parent").all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]


class CollectionViewSet(viewsets.ModelViewSet):
    serializer_class = CollectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Collection.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
