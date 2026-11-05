#!/usr/bin/env bun
/**
 * 生成模板的单份初始化脚本 apps/api/init.sql（从 schema.ts 生成，禁止手写）
 *
 * 用法：
 *   bun scripts/gen-init-sql.ts           # 重新生成 init.sql
 *   bun scripts/gen-init-sql.ts --check   # CI/预检：校验 init.sql 与 schema.ts 一致
 *
 * 实现：把 drizzle-kit generate 的输出重定向到临时目录，取唯一一份 SQL 作为
 * baseline（模板不维护迁移链），加文件头后写入 init.sql。
 *
 * 失败语义：所有错误统一 throw，由顶层 catch 设置 exitCode=1；临时目录
 * `.tmp-init-gen/` 的清理放在 finally，任何退出路径（含 --check 失败）都不残留。
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const initSqlPath = join(apiDir, "init.sql")
const checkMode = process.argv.includes("--check")

const TMP_DIR_NAME = ".tmp-init-gen"
const tmpDir = join(apiDir, TMP_DIR_NAME)
const outDir = join(tmpDir, "drizzle")
const configPath = join(tmpDir, "drizzle.config.ts")

const HEADER = `-- 模板数据库初始化脚本（DO NOT EDIT）
-- 由 apps/api/src/db/schema.ts 自动生成；修改 schema 后运行：
--   bun --filter api db:init:generate
-- 模板部署级别无记忆：空库时直接执行本脚本（不维护迁移链）。
-- scaffold 生成的项目会删除本文件并改用 drizzle 迁移。
`

/** 预期内的失败：抛错交给顶层统一处理，确保 finally 清理仍会执行 */
function fail(message: string): never {
  throw new Error(message)
}

try {
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })

  // drizzle-kit 的 out 相对 cwd（apiDir）解析
  writeFileSync(
    configPath,
    [
      'import { defineConfig } from "drizzle-kit"',
      "export default defineConfig({",
      '  dialect: "sqlite",',
      '  schema: "./src/db/schema.ts",',
      `  out: "./${TMP_DIR_NAME}/drizzle",`,
      "})",
      "",
    ].join("\n")
  )

  const proc = Bun.spawn(
    ["bunx", "drizzle-kit", "generate", "--config", configPath],
    { cwd: apiDir, stdout: "pipe", stderr: "pipe" }
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  // drizzle-kit 出错时 exit code 可能仍为 0，stderr 需要一起判断
  // （注意包含 SyntaxError：快照/配置 JSON 损坏时 drizzle-kit 只打印堆栈并仍 exit 0）
  if (exitCode !== 0 || /\bError\b|SyntaxError|ENOENT|Cannot/i.test(stderr)) {
    process.stderr.write(stdout)
    process.stderr.write(stderr)
    fail(`drizzle-kit generate 失败（exit ${exitCode}）`)
  }

  const sqlFiles = readdirSync(outDir).filter((file) => file.endsWith(".sql"))
  if (sqlFiles.length !== 1) {
    fail(`期望生成 1 份 baseline SQL，实际得到 ${sqlFiles.length} 份`)
  }

  const generated = readFileSync(join(outDir, sqlFiles[0]), "utf8").trim()
  const content = `${HEADER}${generated}\n`

  if (checkMode) {
    const existing = existsSync(initSqlPath)
      ? readFileSync(initSqlPath, "utf8")
      : ""
    if (existing !== content) {
      fail(
        "init.sql 与 schema.ts 不一致。请运行：bun --filter api db:init:generate，并提交更新后的 init.sql"
      )
    }
    console.log("✅ init.sql 与 schema.ts 一致")
  } else {
    writeFileSync(initSqlPath, content)
    console.log(`✅ 已生成模板初始化脚本：${initSqlPath}`)
  }
} catch (err) {
  console.error(`❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
} finally {
  // 任何路径都清理生成用的临时目录（失败时尤其重要，避免脏目录影响后续运行）
  rmSync(tmpDir, { recursive: true, force: true })
}
