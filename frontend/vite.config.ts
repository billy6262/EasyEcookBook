import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // In development, forward /api requests to the Django dev server
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});
