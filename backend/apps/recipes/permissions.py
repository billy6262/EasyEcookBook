from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.recipes.models import Collection, CollectionMembership, Recipe


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


def collection_role(collection: Collection, user) -> str | None:
    """Return the user's effective role in a collection, or None if no access.

    The creator is always treated as owner even without an explicit membership row.
    """
    if not user or not user.is_authenticated:
        return None
    if collection.created_by_id == user.id:
        return CollectionMembership.ROLE_OWNER
    membership = (
        CollectionMembership.objects.filter(collection=collection, user=user)
        .only("role")
        .first()
    )
    return membership.role if membership else None


class IsCollectionMember(BasePermission):
    """
    Object-level access for collections:
    - Read: owner, any member, or anyone if the collection is public.
    - Write (edit meta / delete): owner only.
    Recipe- and member-management actions enforce their own finer-grained
    role checks inside the viewset.
    """

    def has_object_permission(self, request, view, obj: Collection):
        role = collection_role(obj, request.user)
        if request.method in SAFE_METHODS:
            return role is not None or obj.visibility == Collection.VISIBILITY_PUBLIC
        return role == CollectionMembership.ROLE_OWNER
