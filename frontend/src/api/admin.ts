import apiClient from "./client";

export interface SiteSettings {
  registration_mode: "open" | "invite_only";
  demo_enabled: boolean;
  updated_at: string;
}

export interface Invite {
  id: number;
  token: string;
  share_url: string;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  is_valid: boolean;
  created_by_email: string;
  used_by_email: string | null;
  created_at: string;
}

export interface AdminUser {
  pk: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_demo: boolean;
  date_joined: string;
  last_login: string | null;
  recipe_count: number;
}

export interface AdminRecipe {
  id: number;
  title: string;
  visibility: string;
  is_hidden: boolean;
  created_by_email: string;
  created_at: string;
}

export interface AdminComment {
  id: number;
  body: string;
  is_hidden: boolean;
  author_email: string;
  recipe: number;
  recipe_title: string;
  created_at: string;
}

export interface AdminScrapedRecipe {
  id: number;
  url: string;
  status: string;
  requested_by_email: string;
  error_message: string;
  imported_recipe: number | null;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  staff_users: number;
  total_recipes: number;
  hidden_recipes: number;
  total_comments: number;
  outstanding_invites: number;
  signups_last_30d: { day: string; count: number }[];
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const adminApi = {
  // Settings
  getSettings: () => apiClient.get<SiteSettings>("/admin/settings/"),
  updateSettings: (data: Partial<SiteSettings>) =>
    apiClient.patch<SiteSettings>("/admin/settings/", data),

  // Stats
  getStats: () => apiClient.get<AdminStats>("/admin/stats/"),

  // Invites
  listInvites: () => apiClient.get<Paginated<Invite>>("/admin/invites/"),
  createInvite: (data: { max_uses?: number; expires_at?: string | null }) =>
    apiClient.post<Invite>("/admin/invites/", data),
  revokeInvite: (id: number) => apiClient.delete(`/admin/invites/${id}/`),

  // Users
  listUsers: (params?: { search?: string; is_active?: string; is_staff?: string }) =>
    apiClient.get<Paginated<AdminUser>>("/admin/users/", { params }),
  updateUser: (pk: number, data: { is_active?: boolean; is_staff?: boolean }) =>
    apiClient.patch<AdminUser>(`/admin/users/${pk}/`, data),

  // Moderation — recipes
  listRecipes: (params?: { search?: string; is_hidden?: string }) =>
    apiClient.get<Paginated<AdminRecipe>>("/admin/recipes/", { params }),
  hideRecipe: (id: number) => apiClient.post(`/admin/recipes/${id}/hide/`),
  unhideRecipe: (id: number) => apiClient.post(`/admin/recipes/${id}/unhide/`),
  deleteRecipe: (id: number) => apiClient.delete(`/admin/recipes/${id}/`),

  // Moderation — comments
  listComments: (params?: { is_hidden?: string }) =>
    apiClient.get<Paginated<AdminComment>>("/admin/comments/", { params }),
  hideComment: (id: number) => apiClient.post(`/admin/comments/${id}/hide/`),
  unhideComment: (id: number) => apiClient.post(`/admin/comments/${id}/unhide/`),
  deleteComment: (id: number) => apiClient.delete(`/admin/comments/${id}/`),

  // Scraped audit
  listScraped: (params?: { status?: string }) =>
    apiClient.get<Paginated<AdminScrapedRecipe>>("/admin/scraped-recipes/", { params }),
};
