#!/usr/bin/env bun
/**
 * `bun run db:generate` 模板守卫
 *
 * - 模板仓库（存在 apps/api/init.sql）：禁止生成迁移脚本，提示改用 db:init:generate；
 * - scaffold 生成项目（init.sql 已删除）：透传 drizzle-kit generate 生成迁移。
 */
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..")

if (existsSync(join(apiDir, "init.sql"))) {
  console.error(
    [
      "❌ 本仓库是模板：数据库由单份 init.sql 初始化，不使用迁移脚本。",
      "   修改 apps/api/src/db/schema.ts 后请运行：bun run db:init:generate",
      "   （scaffold 生成的项目已删除 init.sql，可正常使用 db:generate）",
    ].join("\n")
  )
  process.exit(1)
}

const proc = Bun.spawn(
  ["bunx", "drizzle-kit", "generate", ...process.argv.slice(2)],
  {
    cwd: apiDir,
    stdout: "pipe",
    stderr: "pipe",
  }
)

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited,
])

// drizzle-kit 遇到 schema/config 语法错误时可能只打印 TransformError / SyntaxError，
// 但 exit code 仍为 0（scaffold 若据此判定成功会产出没有迁移 SQL 的项目）。
// 与 gen-init-sql / migrate-check 相同：兜底探测 stderr 并转为失败。
if (exitCode !== 0 || /\bError\b|SyntaxError|ENOENT|Cannot/i.test(stderr)) {
  process.stdout.write(stdout)
  process.stderr.write(stderr)
  console.error(
    `❌ drizzle-kit generate 失败（exit ${exitCode}）：apps/api/drizzle 未生成可用迁移`
  )
  process.exit(1)
}

process.stdout.write(stdout)
process.exit(exitCode)
