import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use the direct (non-pooler) connection string for migrations.
    url: process.env.DATABASE_URL ?? "",
  },
});
