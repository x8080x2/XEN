import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared-styles": path.resolve(__dirname, "../client/src"),
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
