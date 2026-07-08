import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true, // send HttpOnly JWT cookies automatically
  headers: {
    "Content-Type": "application/json",
  },
});

// Attempt a silent token refresh on 401, then retry once.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await apiClient.post("/auth/token/refresh/");
        return apiClient(original);
      } catch {
        // Refresh also failed — redirect to login
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
