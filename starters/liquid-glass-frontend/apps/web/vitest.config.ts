import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    passWithNoTests: true,
    coverage: {
      // 使用 istanbul 而非 v8：CI 镜像 bun:1-alpine 不含 Node.js，
      // Bun 的 node:inspector shim 不完整，v8 provider 会报
      // "Coverage APIs are not supported"。istanbul 是纯 JS 插桩，兼容。
      provider: "istanbul",
      reporter: ["text", "html"],
      include: [
        "src/hooks/**/*.{ts,tsx}",
        "src/lib/**/*.{ts,tsx}",
        "src/services/**/*.{ts,tsx}",
        "src/stores/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "src/test/**",
        // 胶水层（axios 拦截器 / sonner 包装 / shadcn cn）不适合 unit test
        "src/lib/api.ts",
        "src/lib/toast.ts",
        "src/lib/utils.ts",
      ],
      // 阈值模板阶段先设 0，保证重要的是配置骨架已到位（istanbul provider + include/exclude 白名单 +
      // thresholds 字段）。项目引入正式业务并补齐测试后，按需逐步上提到
      // lines/statements/functions=90, branches=75（避免一上手就因覆盖率报锤卡红 CI）。
      thresholds: {
        lines: 0,
        statements: 0,
        functions: 0,
        branches: 0,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ssr: {
    noExternal: ["zod"],
    resolve: {
      conditions: ["import", "module", "default"],
    },
  },
})
