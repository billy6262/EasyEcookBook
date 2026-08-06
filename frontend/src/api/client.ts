import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true, // send HttpOnly JWT cookies automatically
  headers: {
    "Content-Type": "application/json",
  },
});

// Attempt a silent token refresh on 401, then retry once.
// Never intercept the refresh or login endpoints themselves to avoid infinite loops.
const NO_RETRY_URLS = ["/auth/token/refresh/", "/auth/login/", "/auth/logout/"];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isRetryable =
      error.response?.status === 401 &&
      !original._retry &&
      !NO_RETRY_URLS.some((url) => original.url?.includes(url));

    if (isRetryable) {
      original._retry = true;
      try {
        await apiClient.post("/auth/token/refresh/");
        return apiClient(original);
      } catch {
        // Refresh failed — leave redirection to ProtectedRoute so that public
        // pages (e.g. guest event access) aren't forced to the login screen.
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
