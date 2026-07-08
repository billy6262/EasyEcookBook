import apiClient from "./client";

export interface Recipe {
  id: number;
  title: string;
  description: string;
  servings: number;
  prep_time: number | null;
  cook_time: number | null;
  cover_image: string | null;
  visibility: "public" | "private";
  created_by: { id: number; email: string; first_name: string; last_name: string };
  created_at: string;
  fork_count: number;
  forked_from: number | null;
  source_url: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const recipesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Recipe>>("/recipes/", { params }),

  get: (id: number) => apiClient.get<Recipe>(`/recipes/${id}/`),

  create: (data: FormData | Partial<Recipe>) =>
    apiClient.post<Recipe>("/recipes/", data),

  update: (id: number, data: FormData | Partial<Recipe>) =>
    apiClient.patch<Recipe>(`/recipes/${id}/`, data),

  delete: (id: number) => apiClient.delete(`/recipes/${id}/`),

  fork: (id: number) => apiClient.post<Recipe>(`/recipes/${id}/fork/`),

  search: (query: string) =>
    apiClient.get<{ results: Recipe[]; count: number }>("/search/recipes/", {
      params: { q: query },
    }),
};
