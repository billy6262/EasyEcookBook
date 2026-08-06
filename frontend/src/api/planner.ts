import apiClient from "./client";
import type { Recipe } from "./recipes";

// ── Types ──────────────────────────────────────────────────────────────────

export type MealStatus = "planned" | "shopping" | "shopped" | "cooked";

export interface PlannedMealRecipe {
  id: number;
  recipe: Recipe;
  display_order: number;
  target_servings: number | null;
}

export interface PlannedMeal {
  id: number;
  name: string;
  display_name: string;
  planned_date: string | null;
  status: MealStatus;
  is_template: boolean;
  source_template: number | null;  // set when duplicated from a template
  notes: string;
  shopped_at: string | null;
  recipe_count?: number;        // list serializer only
  meal_recipes?: PlannedMealRecipe[]; // detail serializer only
  cooking_logs?: CookingLog[];   // detail serializer only
  cooked_count?: number;         // detail serializer only
  created_at: string;
  updated_at?: string;
}

export interface CookingLog {
  id: number;
  planned_meal: number | null;
  cooked_at: string;
  notes: string;
}

export interface ShoppingItem {
  id: number;
  planned_meal: number | null;
  planned_meal_name: string | null;
  ingredient_name: string;
  quantity: string | null;
  unit: string;
  is_checked: boolean;
  is_auto_generated: boolean;
  added_at: string;
}

// ── Status helpers ─────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<MealStatus, string> = {
  planned: "Planned",
  shopping: "Shopping",
  shopped: "Shopped",
  cooked: "Cooked",
};

export const STATUS_NEXT_LABEL: Record<MealStatus, string | null> = {
  planned: "Start Shopping",
  shopping: "Mark as Shopped",
  shopped: "Mark as Cooked",
  cooked: null,
};

export const STATUS_COLOURS: Record<MealStatus, string> = {
  planned: "bg-blue-100 text-blue-700",
  shopping: "bg-yellow-100 text-yellow-700",
  shopped: "bg-green-100 text-green-700",
  cooked: "bg-gray-100 text-gray-500",
};

/** Returns true if a shopped meal has been waiting longer than staleDays. */
export function isMealStale(meal: PlannedMeal, staleDays: number): boolean {
  if (meal.status !== "shopped" || !meal.shopped_at) return false;
  const elapsed = Date.now() - new Date(meal.shopped_at).getTime();
  return elapsed > staleDays * 24 * 60 * 60 * 1000;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const plannerApi = {
  // Meals
  listMeals: (params?: { status?: string; template?: "true" | "false" }) =>
    apiClient.get<PlannedMeal[]>("/planner/meals/", { params }),

  getMeal: (id: number) => apiClient.get<PlannedMeal>(`/planner/meals/${id}/`),

  createMeal: (data: {
    name?: string;
    planned_date?: string | null;
    notes?: string;
    is_template?: boolean;
  }) => apiClient.post<PlannedMeal>("/planner/meals/", data),

  updateMeal: (
    id: number,
    data: { name?: string; planned_date?: string | null; notes?: string; is_template?: boolean }
  ) => apiClient.patch<PlannedMeal>(`/planner/meals/${id}/`, data),

  deleteMeal: (id: number) => apiClient.delete(`/planner/meals/${id}/`),

  addRecipe: (mealId: number, recipeId: number, targetServings?: number | null) =>
    apiClient.post<PlannedMeal>(`/planner/meals/${mealId}/add-recipe/`, {
      recipe_id: recipeId,
      target_servings: targetServings ?? null,
    }),

  removeRecipe: (mealId: number, recipeId: number) =>
    apiClient.delete(`/planner/meals/${mealId}/remove-recipe/${recipeId}/`),

  generateShoppingList: (mealId: number) =>
    apiClient.post<ShoppingItem[]>(`/planner/meals/${mealId}/generate-shopping-list/`),

  advanceStatus: (mealId: number, notes?: string) =>
    apiClient.post<PlannedMeal>(`/planner/meals/${mealId}/advance-status/`, {
      notes: notes ?? "",
    }),

  duplicate: (mealId: number, plannedDate?: string | null) =>
    apiClient.post<PlannedMeal>(`/planner/meals/${mealId}/duplicate/`, {
      planned_date: plannedDate ?? null,
    }),

  saveAsTemplate: (mealId: number) =>
    apiClient.patch<PlannedMeal>(`/planner/meals/${mealId}/`, { is_template: true }),

  // Shopping items
  getShoppingItems: () =>
    apiClient.get<ShoppingItem[]>("/planner/shopping/"),

  createShoppingItem: (data: {
    ingredient_name: string;
    quantity?: string | null;
    unit?: string;
    planned_meal?: number | null;
  }) => apiClient.post<ShoppingItem>("/planner/shopping/", data),

  updateShoppingItem: (id: number, data: Partial<ShoppingItem>) =>
    apiClient.patch<ShoppingItem>(`/planner/shopping/${id}/`, data),

  deleteShoppingItem: (id: number) =>
    apiClient.delete(`/planner/shopping/${id}/`),

  clearChecked: () => apiClient.post("/planner/shopping/clear-checked/"),

  bulkCheck: (ids: number[], checked: boolean) =>
    apiClient.post("/planner/shopping/bulk-check/", { ids, checked }),

  // Cooking logs
  createCookingLog: (mealId: number, notes: string) =>
    apiClient.post<CookingLog>("/planner/cooking-logs/", {
      planned_meal: mealId,
      notes,
    }),

  updateCookingLog: (id: number, notes: string) =>
    apiClient.patch<CookingLog>(`/planner/cooking-logs/${id}/`, { notes }),

  deleteCookingLog: (id: number) =>
    apiClient.delete(`/planner/cooking-logs/${id}/`),
};
