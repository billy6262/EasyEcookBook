import apiClient from "./client";
import type { Recipe } from "./recipes";

// ── Types ──────────────────────────────────────────────────────────────────

export type CollectionVisibility = "public" | "private";
export type MemberRole = "owner" | "contributor" | "viewer";

export interface Collection {
  id: number;
  name: string;
  description: string;
  visibility: CollectionVisibility;
  created_by_email: string;
  recipe_count: number;
  member_count: number;
  my_role: MemberRole | null;
  created_at: string;
}

export interface CollectionMember {
  id: number;
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: MemberRole;
  joined_at: string;
}

export interface CollectionRecipeEntry {
  id: number;
  recipe: Recipe;
  added_by_email: string | null;
  added_at: string;
}

export interface CollectionDetail extends Collection {
  recipes: CollectionRecipeEntry[];
  members: CollectionMember[];
}

// ── Role helpers ─────────────────────────────────────────────────────────────

/** Can the current role add/remove recipes? */
export function canEditRecipes(role: MemberRole | null): boolean {
  return role === "owner" || role === "contributor";
}

/** Can the current role manage members and collection settings? */
export function isOwner(role: MemberRole | null): boolean {
  return role === "owner";
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  contributor: "Contributor",
  viewer: "Viewer",
};

export const ROLE_BADGE_COLOURS: Record<MemberRole, string> = {
  owner: "bg-green-100 text-green-700",
  contributor: "bg-blue-100 text-blue-700",
  viewer: "bg-gray-100 text-gray-500",
};

export type CollectionScope = "mine" | "shared" | "public";

// ── API calls ──────────────────────────────────────────────────────────────

export const collectionsApi = {
  list: (scope?: CollectionScope) => {
    const params: Record<string, string> = {};
    if (scope === "shared" || scope === "public") params.scope = scope;
    return apiClient.get<Collection[]>("/recipes/collections/", { params });
  },

  get: (id: number) =>
    apiClient.get<CollectionDetail>(`/recipes/collections/${id}/`),

  create: (data: {
    name: string;
    description?: string;
    visibility?: CollectionVisibility;
  }) => apiClient.post<CollectionDetail>("/recipes/collections/", data),

  update: (
    id: number,
    data: { name?: string; description?: string; visibility?: CollectionVisibility }
  ) => apiClient.patch<CollectionDetail>(`/recipes/collections/${id}/`, data),

  remove: (id: number) => apiClient.delete(`/recipes/collections/${id}/`),

  // Recipes
  addRecipe: (collectionId: number, recipeId: number) =>
    apiClient.post<CollectionDetail>(
      `/recipes/collections/${collectionId}/add-recipe/`,
      { recipe_id: recipeId }
    ),

  removeRecipe: (collectionId: number, recipeId: number) =>
    apiClient.delete(
      `/recipes/collections/${collectionId}/remove-recipe/${recipeId}/`
    ),

  // Members
  addMember: (collectionId: number, email: string, role: Exclude<MemberRole, "owner">) =>
    apiClient.post<CollectionMember>(
      `/recipes/collections/${collectionId}/add-member/`,
      { email, role }
    ),

  updateMember: (
    collectionId: number,
    userId: number,
    role: Exclude<MemberRole, "owner">
  ) =>
    apiClient.patch<CollectionMember>(
      `/recipes/collections/${collectionId}/members/${userId}/`,
      { role }
    ),

  removeMember: (collectionId: number, userId: number) =>
    apiClient.delete(`/recipes/collections/${collectionId}/members/${userId}/`),

  leave: (collectionId: number) =>
    apiClient.post(`/recipes/collections/${collectionId}/leave/`),
};
