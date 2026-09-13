import { defineConfig } from "drizzle-kit";

// drizzle-kit 会自动加载根目录 .env(含 DATABASE_URL)
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
