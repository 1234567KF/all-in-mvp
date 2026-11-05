import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    // 与 src/db.ts 的运行时路径保持一致（apps/api/data/sqlite.db）
    url: "./data/sqlite.db",
  },
})
