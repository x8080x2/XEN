import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point to web's UI components for consistent look and feel
      "@": path.resolve(__dirname, "../client/src"),
      // Desktop-specific services remain in user-package
      "@desktop": path.resolve(__dirname, "./client/src"),
    },
  },
  root: "client",
  server: {
    host: "localhost",
    port: 5173,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  base: "./",
});
