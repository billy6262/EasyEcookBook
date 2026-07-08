from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.recipes.models import CollectionMembership, Recipe


class IsRecipeOwnerOrReadOnly(BasePermission):
    """
    - Public recipes: any authenticated user can read; only the creator can write.
    - Private recipes: only the creator can read or write.
    - Collection contributors: can also write to a recipe if it lives in a
      collection where they hold contributor or owner role.
    """

    def has_object_permission(self, request, view, obj: Recipe):
        if request.method in SAFE_METHODS:
            if obj.visibility == Recipe.VISIBILITY_PUBLIC:
                return True
            return obj.created_by == request.user

        # Write access
        if obj.created_by == request.user:
            return True

        return CollectionMembership.objects.filter(
            collection__collection_recipes__recipe=obj,
            user=request.user,
            role__in=[CollectionMembership.ROLE_OWNER, CollectionMembership.ROLE_CONTRIBUTOR],
        ).exists()
