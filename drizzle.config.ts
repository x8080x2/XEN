import { defineConfig } from "drizzle-kit";

// Only warn if DATABASE_URL is not set, don't crash
if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL environment variable is not set');
  console.warn('Database operations will not be available');
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://placeholder',
  },
});
