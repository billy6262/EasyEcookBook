from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.recipes.models import (
    Category,
    Collection,
    Ingredient,
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
    IngredientSerializer,
    RecipeDetailSerializer,
    RecipeListSerializer,
    RecipeWriteSerializer,
    TagSerializer,
)


class RecipeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsRecipeOwnerOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "title"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return RecipeListSerializer
        if self.action in ("create", "update", "partial_update"):
            return RecipeWriteSerializer
        return RecipeDetailSerializer

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params

        if params.get("mine") == "true":
            qs = Recipe.objects.filter(created_by=user)
        else:
            qs = (
                Recipe.objects.filter(visibility=Recipe.VISIBILITY_PUBLIC)
                | Recipe.objects.filter(created_by=user)
            ).distinct()

        category_id = params.get("category")
        if category_id and category_id.isdigit():
            qs = qs.filter(category_id=category_id)

        for tid in params.get("tags", "").split(","):
            if tid.strip().isdigit():
                qs = qs.filter(tags__id=tid.strip()).distinct()

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(created_by=request.user)
        return Response(
            RecipeDetailSerializer(instance, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(RecipeDetailSerializer(instance, context={"request": request}).data)

    # ── Bulk ingredient replace ───────────────────────────────────────────────
    @action(detail=True, methods=["put"], url_path="ingredients")
    def bulk_ingredients(self, request, pk=None):
        """
        PUT /api/recipes/:id/ingredients/
        Body: [{ingredient_name, quantity?, unit?, notes?, order}]
        Atomically replaces all ingredients on the recipe.
        """
        recipe = self.get_object()
        if recipe.created_by != request.user:
            return Response(
                {"detail": "Only the recipe creator can edit ingredients."},
                status=status.HTTP_403_FORBIDDEN,
            )

        items = request.data if isinstance(request.data, list) else []
        with transaction.atomic():
            recipe.ingredients.all().delete()
            for i, item in enumerate(items):
                name = str(item.get("ingredient_name", "")).strip()
                if not name:
                    continue
                # Case-insensitive match to avoid duplicate normalised entries
                ingredient = Ingredient.objects.filter(name__iexact=name).first()
                if not ingredient:
                    ingredient = Ingredient.objects.create(name=name)
                RecipeIngredient.objects.create(
                    recipe=recipe,
                    ingredient=ingredient,
                    quantity=item.get("quantity") or None,
                    unit=item.get("unit", ""),
                    notes=item.get("notes", ""),
                    order=item.get("order", i),
                )

        return Response(RecipeDetailSerializer(recipe, context={"request": request}).data)

    # ── Bulk step replace ─────────────────────────────────────────────────────
    @action(detail=True, methods=["put"], url_path="steps")
    def bulk_steps(self, request, pk=None):
        """
        PUT /api/recipes/:id/steps/
        Body: [{order, description}]
        Atomically replaces all steps on the recipe.
        """
        recipe = self.get_object()
        if recipe.created_by != request.user:
            return Response(
                {"detail": "Only the recipe creator can edit steps."},
                status=status.HTTP_403_FORBIDDEN,
            )

        items = request.data if isinstance(request.data, list) else []
        with transaction.atomic():
            recipe.steps.all().delete()
            for i, item in enumerate(items):
                desc = str(item.get("description", "")).strip()
                if not desc:
                    continue
                Step.objects.create(
                    recipe=recipe,
                    order=item.get("order", i + 1),
                    description=desc,
                )

        return Response(RecipeDetailSerializer(recipe, context={"request": request}).data)

    # ── Fork ──────────────────────────────────────────────────────────────────
    @action(detail=True, methods=["post"])
    def fork(self, request, pk=None):
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
                recipe=forked, ingredient=ri.ingredient,
                quantity=ri.quantity, unit=ri.unit,
                notes=ri.notes, order=ri.order,
            )
        for step in original.steps.all():
            Step.objects.create(recipe=forked, order=step.order, description=step.description)
        forked.tags.set(original.tags.all())
        return Response(
            RecipeDetailSerializer(forked, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Comments ──────────────────────────────────────────────────────────────
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


class IngredientViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ingredient list; use ?search= for autocomplete."""
    queryset = Ingredient.objects.all().order_by("name")
    serializer_class = IngredientSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ["name"]


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ["name"]


class CategoryViewSet(viewsets.ModelViewSet):
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
