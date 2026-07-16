import path from "path"
import { defineConfig } from "vitest/config"

// packages/shared 的 Vitest 配置。
// 模板阶段还没有测试文件时，`bunx vitest run` 会因 include 未命中而退出 1；
// 交由 root `test:shared` 触发时如需容错请追加 `passWithNoTests: true`，或
// 引入首个 *.test.ts 后自然满足。
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      // 模板阶段阀值先设 0；随业务成长上提到参考基线（lines/statements/functions=90, branches=75）。
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
      "@workspace/shared": path.resolve(__dirname, "./src"),
      zod: path.resolve(__dirname, "node_modules/zod/index.js"),
    },
  },
  ssr: {
    noExternal: ["zod"],
    resolve: {
      conditions: ["import", "module", "default"],
    },
  },
})
