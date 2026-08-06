import decimal

from django.db import models as dj_models
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.demo import effective_user
from apps.planner.models import CookingLog, PlannedMeal, PlannedMealRecipe, ShoppingItem
from apps.planner.serializers import (
    CookingLogSerializer,
    PlannedMealDetailSerializer,
    PlannedMealListSerializer,
    ShoppingItemSerializer,
)
from apps.recipes.models import Recipe


class PlannedMealViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # lists are small; return plain arrays

    def get_serializer_class(self):
        if self.action == "list":
            return PlannedMealListSerializer
        return PlannedMealDetailSerializer

    def get_queryset(self):
        qs = PlannedMeal.objects.filter(
            created_by=effective_user(self.request)
        ).prefetch_related("meal_recipes__recipe", "cooking_logs")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            # Supports comma-separated values, e.g. ?status=planned,shopping
            statuses = [s.strip() for s in status_filter.split(",")]
            qs = qs.filter(status__in=statuses)

        is_template = self.request.query_params.get("template")
        if is_template == "true":
            qs = qs.filter(is_template=True)
        elif is_template == "false":
            qs = qs.filter(is_template=False)

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    # ── Add / remove recipes ─────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="add-recipe")
    def add_recipe(self, request, pk=None):
        meal = self.get_object()
        recipe_id = request.data.get("recipe_id")
        target_servings = request.data.get("target_servings") or None

        try:
            recipe = Recipe.objects.get(pk=recipe_id)
        except Recipe.DoesNotExist:
            return Response({"detail": "Recipe not found."}, status=status.HTTP_404_NOT_FOUND)

        order = meal.meal_recipes.count()
        meal_recipe, created = PlannedMealRecipe.objects.get_or_create(
            planned_meal=meal,
            recipe=recipe,
            defaults={"display_order": order, "target_servings": target_servings},
        )
        if not created and target_servings is not None:
            meal_recipe.target_servings = target_servings
            meal_recipe.save(update_fields=["target_servings"])

        return Response(
            PlannedMealDetailSerializer(meal, context={"request": request}).data
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"remove-recipe/(?P<recipe_id>\d+)",
    )
    def remove_recipe(self, request, pk=None, recipe_id=None):
        meal = self.get_object()
        PlannedMealRecipe.objects.filter(
            planned_meal=meal, recipe_id=recipe_id
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Shopping list generation ─────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="generate-shopping-list")
    def generate_shopping_list(self, request, pk=None):
        """
        Regenerates auto-created ShoppingItems from the meal's recipes,
        scaled by target_servings if set.
        """
        meal = self.get_object()

        # Clear existing auto-generated items for this meal
        ShoppingItem.objects.filter(
            planned_meal=meal, is_auto_generated=True
        ).delete()

        created = []
        for meal_recipe in meal.meal_recipes.select_related("recipe").prefetch_related(
            "recipe__ingredients__ingredient"
        ):
            recipe = meal_recipe.recipe
            recipe_servings = recipe.servings or 1
            target = meal_recipe.target_servings or recipe_servings
            scale = decimal.Decimal(str(target)) / decimal.Decimal(str(recipe_servings))

            for ri in recipe.ingredients.all():
                scaled_qty = None
                if ri.quantity is not None:
                    scaled_qty = (ri.quantity * scale).quantize(
                        decimal.Decimal("0.001"),
                        rounding=decimal.ROUND_HALF_UP,
                    )

                item = ShoppingItem.objects.create(
                    user=request.user,
                    planned_meal=meal,
                    ingredient_name=ri.ingredient.name,
                    quantity=scaled_qty,
                    unit=ri.unit,
                    is_auto_generated=True,
                )
                created.append(item)

        return Response(
            ShoppingItemSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Status advancement ───────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="advance-status")
    def advance_status(self, request, pk=None):
        """
        Advance the meal through:  planned → shopping → shopped → cooked
        Sets shopped_at when transitioning to 'shopped'.
        Creates a CookingLog when transitioning to 'cooked'.
        """
        meal = self.get_object()
        transitions = {
            PlannedMeal.STATUS_PLANNED: PlannedMeal.STATUS_SHOPPING,
            PlannedMeal.STATUS_SHOPPING: PlannedMeal.STATUS_SHOPPED,
            PlannedMeal.STATUS_SHOPPED: PlannedMeal.STATUS_COOKED,
        }
        next_status = transitions.get(meal.status)
        if not next_status:
            return Response(
                {"detail": "Meal is already cooked."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        update_fields = ["status", "updated_at"]
        meal.status = next_status

        if next_status == PlannedMeal.STATUS_SHOPPED:
            meal.shopped_at = timezone.now()
            update_fields.append("shopped_at")

            # Mark all items for this meal as checked
            meal_item_names = list(
                ShoppingItem.objects.filter(planned_meal=meal)
                .values_list("ingredient_name", flat=True)
                .distinct()
            )
            ShoppingItem.objects.filter(planned_meal=meal).update(is_checked=True)

            # Also check identical ingredient names that belong to other meals
            # currently in "shopping" status for the same user — the shopper
            # likely picked up those items too.
            if meal_item_names:
                other_shopping_meal_ids = PlannedMeal.objects.filter(
                    created_by=request.user,
                    status=PlannedMeal.STATUS_SHOPPING,
                ).exclude(pk=meal.pk).values_list("id", flat=True)

                ShoppingItem.objects.filter(
                    user=request.user,
                    planned_meal_id__in=other_shopping_meal_ids,
                    ingredient_name__in=meal_item_names,
                ).update(is_checked=True)

        if next_status == PlannedMeal.STATUS_COOKED:
            CookingLog.objects.create(
                user=request.user,
                planned_meal=meal,
                notes=request.data.get("notes", ""),
            )

            # Templates reset to planned after cooking so they can be reused.
            if meal.is_template:
                meal.status = PlannedMeal.STATUS_PLANNED
                meal.shopped_at = None
                update_fields.append("shopped_at")
                # Uncheck all shopping items so the list is fresh next time
                ShoppingItem.objects.filter(planned_meal=meal).update(is_checked=False)

        meal.save(update_fields=update_fields)
        return Response(
            PlannedMealDetailSerializer(meal, context={"request": request}).data
        )

    # ── Template duplication ─────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        """Create a fresh planned meal from a template or any existing meal."""
        source = self.get_object()
        new_meal = PlannedMeal.objects.create(
            name=source.name,
            planned_date=request.data.get("planned_date") or None,
            notes=source.notes,
            is_template=False,
            source_template=source if source.is_template else None,
            created_by=request.user,
        )
        for mr in source.meal_recipes.all():
            PlannedMealRecipe.objects.create(
                planned_meal=new_meal,
                recipe=mr.recipe,
                display_order=mr.display_order,
                target_servings=mr.target_servings,
            )
        return Response(
            PlannedMealDetailSerializer(new_meal, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ShoppingItemViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ShoppingItemSerializer
    pagination_class = None  # return plain array

    def get_queryset(self):
        return (
            ShoppingItem.objects.filter(user=effective_user(self.request))
            .filter(
                dj_models.Q(planned_meal__isnull=True)
                | ~dj_models.Q(planned_meal__status=PlannedMeal.STATUS_COOKED)
            )
            .select_related("planned_meal")
            .order_by("planned_meal", "added_at")
        )

    def perform_create(self, serializer):
        # Guard against attaching an item to another user's meal (IDOR).
        meal = serializer.validated_data.get("planned_meal")
        if meal is not None and meal.created_by_id != self.request.user.id:
            raise PermissionDenied("You can only add items to your own meals.")
        serializer.save(user=self.request.user, is_auto_generated=False)

    @action(detail=False, methods=["post"], url_path="clear-checked")
    def clear_checked(self, request):
        deleted, _ = ShoppingItem.objects.filter(
            user=request.user, is_checked=True
        ).delete()
        return Response({"deleted": deleted})

    @action(detail=False, methods=["post"], url_path="bulk-check")
    def bulk_check(self, request):
        ids = request.data.get("ids", [])
        checked = request.data.get("checked", True)
        updated = ShoppingItem.objects.filter(
            user=request.user, id__in=ids
        ).update(is_checked=checked)
        return Response({"updated": updated})


class CookingLogViewSet(viewsets.ModelViewSet):
    """Create / edit-notes / delete cooking logs for the user's own meals.

    Logs are also created automatically when a meal advances to 'cooked'
    (see PlannedMealViewSet.advance_status); this viewset lets users record
    additional cooks and manage the history manually.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CookingLogSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return CookingLog.objects.filter(user=effective_user(self.request)).select_related(
            "planned_meal"
        )

    def perform_create(self, serializer):
        meal = serializer.validated_data.get("planned_meal")
        if meal is None or meal.created_by_id != self.request.user.id:
            raise PermissionDenied("You can only log cooks for your own meals.")
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # Only notes are editable; ignore any attempt to reassign the meal.
        serializer.save(planned_meal=serializer.instance.planned_meal)
