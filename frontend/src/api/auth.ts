import apiClient from "./client";

export interface User {
  pk: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_demo: boolean;
}

export const authApi = {
  getUser: () => apiClient.get<User>("/auth/user/"),

  getPublicSettings: () => apiClient.get<{ demo_enabled: boolean }>("/settings/public/"),

  login: (email: string, password: string) =>
    apiClient.post("/auth/login/", { email, password }),

  demoLogin: () => apiClient.post("/auth/demo-login/"),

  logout: () => apiClient.post("/auth/logout/"),

  register: (email: string, password1: string, password2: string, inviteToken?: string) =>
    apiClient.post("/auth/registration/", {
      email,
      password1,
      password2,
      ...(inviteToken ? { invite_token: inviteToken } : {}),
    }),

  changePassword: (oldPassword: string, newPassword1: string, newPassword2: string) =>
    apiClient.post("/auth/password/change/", {
      old_password: oldPassword,
      new_password1: newPassword1,
      new_password2: newPassword2,
    }),

  requestPasswordReset: (email: string) =>
    apiClient.post("/auth/password/reset/", { email }),
};
