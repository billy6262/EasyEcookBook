from django.db import transaction
from django.db.models import Q
from django.contrib.auth import get_user_model
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from apps.recipes.models import (
    Category,
    Collection,
    CollectionMembership,
    CollectionRecipe,
    Ingredient,
    Recipe,
    RecipeAccompaniment,
    RecipeIngredient,
    Step,
    Tag,
)
from apps.recipes.permissions import IsRecipeOwnerOrReadOnly, IsCollectionMember, collection_role
from apps.recipes.serializers import (
    CategorySerializer,
    CollectionDetailSerializer,
    CollectionMembershipSerializer,
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

    # ── Accompaniments ────────────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="accompaniments")
    def accompaniments(self, request, pk=None):
        """
        GET  /api/recipes/:id/accompaniments/       → list all linked recipes
        POST /api/recipes/:id/accompaniments/ {recipe_id} → add a bidirectional link
        """
        recipe = self.get_object()

        if request.method == "GET":
            from_ids = RecipeAccompaniment.objects.filter(
                from_recipe=recipe
            ).values_list("to_recipe_id", flat=True)
            to_ids = RecipeAccompaniment.objects.filter(
                to_recipe=recipe
            ).values_list("from_recipe_id", flat=True)
            linked = Recipe.objects.filter(
                id__in=list(from_ids) + list(to_ids)
            ).order_by("title")
            return Response(
                RecipeListSerializer(linked, many=True, context={"request": request}).data
            )

        # POST — add link
        other_id = request.data.get("recipe_id")
        if not other_id:
            return Response(
                {"detail": "recipe_id is required."}, status=status.HTTP_400_BAD_REQUEST
            )
        if int(other_id) == recipe.id:
            return Response(
                {"detail": "Cannot link a recipe to itself."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            other = Recipe.objects.get(pk=other_id)
        except Recipe.DoesNotExist:
            return Response({"detail": "Recipe not found."}, status=status.HTTP_404_NOT_FOUND)

        # Block linking a private recipe the user can't access (silent 404).
        if (
            other.visibility != Recipe.VISIBILITY_PUBLIC
            and other.created_by_id != request.user.id
        ):
            return Response({"detail": "Recipe not found."}, status=status.HTTP_404_NOT_FOUND)

        already_linked = RecipeAccompaniment.objects.filter(
            Q(from_recipe=recipe, to_recipe=other)
            | Q(from_recipe=other, to_recipe=recipe)
        ).exists()
        if already_linked:
            return Response({"detail": "Already linked."}, status=status.HTTP_400_BAD_REQUEST)

        RecipeAccompaniment.objects.create(
            from_recipe=recipe, to_recipe=other, added_by=request.user
        )
        return Response(
            RecipeListSerializer(other, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"accompaniments/(?P<acc_id>\d+)",
    )
    def remove_accompaniment(self, request, pk=None, acc_id=None):
        """DELETE /api/recipes/:id/accompaniments/:acc_id/ — remove a bidirectional link"""
        recipe = self.get_object()
        RecipeAccompaniment.objects.filter(
            Q(from_recipe=recipe, to_recipe_id=acc_id)
            | Q(from_recipe_id=acc_id, to_recipe=recipe)
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

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
    permission_classes = [permissions.IsAuthenticated, IsCollectionMember]
    pagination_class = None  # lists are small; return plain arrays

    def get_serializer_class(self):
        if self.action in ("retrieve", "create", "update", "partial_update"):
            return CollectionDetailSerializer
        return CollectionSerializer

    def get_queryset(self):
        user = self.request.user
        base = Collection.objects.prefetch_related("memberships", "collection_recipes")

        # ?scope=public → discover other users' public collections
        if self.request.query_params.get("scope") == "public":
            return (
                base.filter(visibility=Collection.VISIBILITY_PUBLIC)
                .exclude(created_by=user)
                .exclude(memberships__user=user)
                .distinct()
                .order_by("-created_at")
            )

        # ?scope=shared → collections I'm a member of but didn't create
        if self.request.query_params.get("scope") == "shared":
            return (
                base.filter(memberships__user=user)
                .exclude(created_by=user)
                .distinct()
                .order_by("-created_at")
            )

        # Default: everything I can access (mine + shared)
        return (
            base.filter(Q(created_by=user) | Q(memberships__user=user))
            .distinct()
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        collection = serializer.save(created_by=self.request.user)
        # Ensure the creator has an explicit owner membership row.
        CollectionMembership.objects.get_or_create(
            collection=collection,
            user=self.request.user,
            defaults={"role": CollectionMembership.ROLE_OWNER},
        )

    # ── helpers ──────────────────────────────────────────────────────────────

    def _require_role(self, collection, roles):
        """Return True if the requesting user holds one of the given roles."""
        return collection_role(collection, self.request.user) in roles

    # ── Recipe management ────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="add-recipe")
    def add_recipe(self, request, pk=None):
        collection = self.get_object()
        if not self._require_role(
            collection,
            [CollectionMembership.ROLE_OWNER, CollectionMembership.ROLE_CONTRIBUTOR],
        ):
            return Response(
                {"detail": "You need contributor access to add recipes."},
                status=status.HTTP_403_FORBIDDEN,
            )

        recipe_id = request.data.get("recipe_id")
        try:
            recipe = Recipe.objects.get(pk=recipe_id)
        except Recipe.DoesNotExist:
            return Response({"detail": "Recipe not found."}, status=status.HTTP_404_NOT_FOUND)

        # Don't allow adding a private recipe the user can't access (avoid
        # leaking its existence — respond with 404 rather than 403).
        if (
            recipe.visibility != Recipe.VISIBILITY_PUBLIC
            and recipe.created_by_id != request.user.id
        ):
            return Response({"detail": "Recipe not found."}, status=status.HTTP_404_NOT_FOUND)

        CollectionRecipe.objects.get_or_create(
            collection=collection,
            recipe=recipe,
            defaults={"added_by": request.user},
        )
        return Response(
            CollectionDetailSerializer(collection, context={"request": request}).data
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"remove-recipe/(?P<recipe_id>\d+)",
    )
    def remove_recipe(self, request, pk=None, recipe_id=None):
        collection = self.get_object()
        if not self._require_role(
            collection,
            [CollectionMembership.ROLE_OWNER, CollectionMembership.ROLE_CONTRIBUTOR],
        ):
            return Response(
                {"detail": "You need contributor access to remove recipes."},
                status=status.HTTP_403_FORBIDDEN,
            )
        CollectionRecipe.objects.filter(
            collection=collection, recipe_id=recipe_id
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Member management ────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="add-member")
    def add_member(self, request, pk=None):
        collection = self.get_object()
        if not self._require_role(collection, [CollectionMembership.ROLE_OWNER]):
            return Response(
                {"detail": "Only the owner can manage members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        email = (request.data.get("email") or "").strip().lower()
        role = request.data.get("role") or CollectionMembership.ROLE_VIEWER
        valid_roles = {
            CollectionMembership.ROLE_CONTRIBUTOR,
            CollectionMembership.ROLE_VIEWER,
        }
        if role not in valid_roles:
            return Response(
                {"detail": "Role must be 'contributor' or 'viewer'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {"detail": f"No user found with email '{email}'."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.id == collection.created_by_id:
            return Response(
                {"detail": "The owner is already a member."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership, _ = CollectionMembership.objects.update_or_create(
            collection=collection,
            user=user,
            defaults={"role": role},
        )
        return Response(
            CollectionMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"members/(?P<user_id>\d+)",
    )
    def manage_member(self, request, pk=None, user_id=None):
        collection = self.get_object()
        if not self._require_role(collection, [CollectionMembership.ROLE_OWNER]):
            return Response(
                {"detail": "Only the owner can manage members."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if int(user_id) == collection.created_by_id:
            return Response(
                {"detail": "The owner's membership cannot be changed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = CollectionMembership.objects.filter(
            collection=collection, user_id=user_id
        ).first()
        if not membership:
            return Response({"detail": "Member not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            membership.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        role = request.data.get("role")
        if role not in {
            CollectionMembership.ROLE_CONTRIBUTOR,
            CollectionMembership.ROLE_VIEWER,
        }:
            return Response(
                {"detail": "Role must be 'contributor' or 'viewer'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        membership.role = role
        membership.save(update_fields=["role"])
        return Response(CollectionMembershipSerializer(membership).data)

    @action(detail=True, methods=["post"], url_path="leave")
    def leave(self, request, pk=None):
        collection = self.get_object()
        if collection.created_by_id == request.user.id:
            return Response(
                {"detail": "The owner cannot leave their own collection."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted, _ = CollectionMembership.objects.filter(
            collection=collection, user=request.user
        ).delete()
        if not deleted:
            return Response(
                {"detail": "You are not a member of this collection."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
