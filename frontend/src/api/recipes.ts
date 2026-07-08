import apiClient from "./client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RecipeAuthor {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent: number | null;
}

export interface RecipeIngredient {
  id: number;
  ingredient_name: string;
  quantity: string | null;
  unit: string;
  notes: string;
  order: number;
}

export interface RecipeStep {
  id: number;
  order: number;
  description: string;
  image: string | null;
}

export interface Recipe {
  id: number;
  title: string;
  description: string;
  servings: number;
  prep_time: number | null;
  cook_time: number | null;
  cover_image: string | null;
  cover_image_url: string | null;
  visibility: "public" | "private";
  created_by: RecipeAuthor;
  created_at: string;
  updated_at?: string;
  fork_count: number;
  forked_from: number | null;
  source_url: string | null;
  // Detail only
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  tags?: Tag[];
  category?: Category | null;
}

export interface Comment {
  id: number;
  author_email: string;
  body: string;
  parent: number | null;
  created_at: string;
  replies?: Comment[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface RecipeFilters {
  mine?: boolean;
  category?: number;
  tags?: number[];
  search?: string;
  ordering?: string;
  page?: number;
}

export interface BulkIngredientItem {
  ingredient_name: string;
  quantity?: string | number | null;
  unit?: string;
  notes?: string;
  order: number;
}

export interface BulkStepItem {
  order: number;
  description: string;
}

type RecipeWritePayload = {
  title?: string;
  description?: string;
  servings?: number;
  prep_time?: number | null;
  cook_time?: number | null;
  visibility?: "public" | "private";
  cover_image_url?: string | null;
  source_url?: string | null;
  tag_ids?: number[];
  category_id?: number | null;
};

// ── API calls ──────────────────────────────────────────────────────────────

export const recipesApi = {
  list: (filters?: RecipeFilters) => {
    const params: Record<string, string> = {};
    if (filters?.mine) params.mine = "true";
    if (filters?.category) params.category = String(filters.category);
    if (filters?.tags?.length) params.tags = filters.tags.join(",");
    if (filters?.search) params.search = filters.search;
    if (filters?.ordering) params.ordering = filters.ordering;
    if (filters?.page && filters.page > 1) params.page = String(filters.page);
    return apiClient.get<PaginatedResponse<Recipe>>("/recipes/", { params });
  },

  get: (id: number) => apiClient.get<Recipe>(`/recipes/${id}/`),

  create: (data: RecipeWritePayload) => apiClient.post<Recipe>("/recipes/", data),

  update: (id: number, data: RecipeWritePayload) =>
    apiClient.patch<Recipe>(`/recipes/${id}/`, data),

  uploadCoverImage: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("cover_image", file);
    return apiClient.patch<Recipe>(`/recipes/${id}/`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  delete: (id: number) => apiClient.delete(`/recipes/${id}/`),

  fork: (id: number) => apiClient.post<Recipe>(`/recipes/${id}/fork/`),

  updateIngredients: (id: number, ingredients: BulkIngredientItem[]) =>
    apiClient.put<Recipe>(`/recipes/${id}/ingredients/`, ingredients),

  updateSteps: (id: number, steps: BulkStepItem[]) =>
    apiClient.put<Recipe>(`/recipes/${id}/steps/`, steps),

  listTags: () => apiClient.get<PaginatedResponse<Tag>>("/recipes/tags/"),

  searchTags: (q: string) =>
    apiClient.get<PaginatedResponse<Tag>>("/recipes/tags/", { params: { search: q } }),

  createTag: (name: string) => apiClient.post<Tag>("/recipes/tags/", { name }),

  listCategories: () => apiClient.get<PaginatedResponse<Category>>("/recipes/categories/"),

  createCategory: (name: string) =>
    apiClient.post<Category>("/recipes/categories/", { name }),

  searchIngredients: (q: string) =>
    apiClient.get<PaginatedResponse<{ id: number; name: string }>>(
      "/recipes/ingredients/",
      { params: { search: q, page_size: 10 } }
    ),

  search: (query: string) =>
    apiClient.get<{ results: Recipe[]; count: number }>("/search/recipes/", {
      params: { q: query },
    }),

  getComments: (id: number) =>
    apiClient.get<Comment[]>(`/recipes/${id}/comments/`),

  addComment: (id: number, body: string, parent?: number) =>
    apiClient.post<Comment>(`/recipes/${id}/comments/`, { body, parent }),
};
