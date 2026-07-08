# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage build:
#   Stage 1 (frontend-builder): builds the React/Vite bundle
#   Stage 2 (production):       nginx serves the bundle + proxies to backend
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1 — Build the React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2 — Nginx serving the built frontend
FROM nginx:1.27-alpine

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/dist /var/www/html

EXPOSE 80
