# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build:
#   Stage 1 (frontend-builder): builds the React/Vite bundle
#   Stage 2 (production):       nginx serves the bundle + proxies to backend
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1 — Build the React frontend
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS frontend-builder

WORKDIR /app

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2 — Nginx serving the built frontend
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/dist /var/www/html

EXPOSE 80
