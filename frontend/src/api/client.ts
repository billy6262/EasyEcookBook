import axios from "axios";

const CSRF_COOKIE_NAME = "csrftoken";
const CSRF_HEADER_NAME = "X-CSRFToken";
const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

function getCookie(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true, // send HttpOnly JWT cookies automatically
  xsrfCookieName: CSRF_COOKIE_NAME,
  xsrfHeaderName: CSRF_HEADER_NAME,
  headers: {
    "Content-Type": "application/json",
  },
});

let csrfBootstrap: Promise<void> | null = null;

async function ensureCsrfToken(): Promise<void> {
  if (getCookie(CSRF_COOKIE_NAME)) return;
  if (!csrfBootstrap) {
    csrfBootstrap = apiClient.get("/auth/csrf/").then(() => undefined).finally(() => {
      csrfBootstrap = null;
    });
  }
  await csrfBootstrap;
}

apiClient.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase();
  if (method && UNSAFE_METHODS.has(method)) {
    await ensureCsrfToken();
    const token = getCookie(CSRF_COOKIE_NAME);
    if (token) {
      config.headers.set(CSRF_HEADER_NAME, token);
    }
  }
  return config;
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
