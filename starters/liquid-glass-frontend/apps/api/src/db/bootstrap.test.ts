/**
 * db/bootstrap 单测：模板 init.sql 与生成项目 drizzle 两种来源的识别与执行
 *
 * 覆盖：
 * - 来源解析优先级（DB_BOOTSTRAP_DIR 优先）与双来源守卫（同一目录 / 不同候选目录）；
 * - applyInitSql 的 users 核心表判空、部分初始化报错、事务回滚；
 * - drizzle 分支用临时迁移目录真实执行并建表（不依赖仓库内结构）。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Database } from "bun:sqlite"
import { afterEach, describe, expect, it } from "bun:test"

import {
  applyInitSql,
  bootstrapDatabase,
  resolveBootstrapSource,
} from "./bootstrap.js"
import { createDrizzleDb } from "./index.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "lgs-bootstrap-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

/** 写入一份最小 init.sql（demo 表），返回路径 */
function writeInitSql(dir: string): string {
  const path = join(dir, "init.sql")
  writeFileSync(
    path,
    "CREATE TABLE demo (id text PRIMARY KEY NOT NULL);\n--> statement-breakpoint\nCREATE INDEX idx_demo_id ON demo (id);\n"
  )
  return path
}

/** 写入一份可用的 drizzle 迁移目录（journal + 1 份 .sql），返回目录路径 */
function writeDrizzleMigrations(dir: string): string {
  const drizzleDir = join(dir, "drizzle")
  mkdirSync(join(drizzleDir, "meta"), { recursive: true })
  writeFileSync(
    join(drizzleDir, "0000_init.sql"),
    [
      "CREATE TABLE `users` (",
      "  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,",
      "  `email` text NOT NULL,",
      "  `name` text,",
      "  `role` text DEFAULT 'user',",
      "  `created_at` text",
      ");",
      "--> statement-breakpoint",
      "CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);",
      "",
    ].join("\n")
  )
  writeFileSync(
    join(drizzleDir, "meta", "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "sqlite",
      entries: [
        {
          idx: 0,
          version: "6",
          when: 1700000000000,
          tag: "0000_init",
          breakpoints: true,
        },
      ],
    })
  )
  return drizzleDir
}

/** 库中所有业务表（排除 sqlite_ 内部表） */
function tableNames(sqlite: Database): string[] {
  return (
    sqlite
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .all() as { name: string }[]
  ).map((row) => row.name)
}

/** 执行并返回抛出的错误（未抛出则测试失败） */
function captureError(fn: () => void): Error {
  try {
    fn()
  } catch (err) {
    return err as Error
  }
  throw new Error("期望抛出错误，但没有抛出")
}

/** 临时设置 DB_BOOTSTRAP_DIR，结束后恢复原值 */
function withBootstrapDir(dir: string, fn: () => void): void {
  const previous = process.env.DB_BOOTSTRAP_DIR
  process.env.DB_BOOTSTRAP_DIR = dir
  try {
    fn()
  } finally {
    if (previous === undefined) delete process.env.DB_BOOTSTRAP_DIR
    else process.env.DB_BOOTSTRAP_DIR = previous
  }
}

describe("resolveBootstrapSource", () => {
  it("baseDir 下有 init.sql → init 模式", () => {
    const dir = createTempDir()
    const initPath = writeInitSql(dir)

    expect(resolveBootstrapSource(dir)).toEqual({
      kind: "init",
      path: initPath,
    })
  })

  it("baseDir 下没有 init.sql 但有 drizzle 迁移 → drizzle 模式", () => {
    const dir = createTempDir()
    const drizzleDir = writeDrizzleMigrations(dir)

    expect(resolveBootstrapSource(dir)).toEqual({
      kind: "drizzle",
      path: drizzleDir,
    })
  })

  it("DB_BOOTSTRAP_DIR 优先于 baseDir（Docker 镜像内布局）", () => {
    const dockerDir = createTempDir()
    mkdirSync(dockerDir, { recursive: true })
    const initPath = writeInitSql(dockerDir)
    const baseDir = createTempDir()
    writeInitSql(baseDir) // baseDir 也有 init.sql，但环境变量优先

    withBootstrapDir(dockerDir, () => {
      expect(resolveBootstrapSource(baseDir).path).toBe(initPath)
    })
  })

  it("同一目录同时存在 init.sql 与 drizzle/ → 抛错并列出两份路径", () => {
    const dir = createTempDir()
    const initPath = writeInitSql(dir)
    const drizzleDir = writeDrizzleMigrations(dir)

    const err = captureError(() => resolveBootstrapSource(dir))

    expect(err.message).toContain("只保留一份结构来源")
    expect(err.message).toContain(initPath)
    expect(err.message).toContain(drizzleDir)
    expect(err.message).toContain("模板留 init.sql，生成项目留 drizzle/")
  })

  it("不同候选目录分别提供 init.sql 与 drizzle/ → 抛错（禁止静默选 init）", () => {
    const baseDir = createTempDir()
    const drizzleDir = writeDrizzleMigrations(baseDir)
    const envDir = createTempDir()
    const initPath = writeInitSql(envDir)

    withBootstrapDir(envDir, () => {
      const err = captureError(() => resolveBootstrapSource(baseDir))

      expect(err.message).toContain("只保留一份结构来源")
      expect(err.message).toContain(initPath)
      expect(err.message).toContain(drizzleDir)
    })
  })

  it("两种来源都不存在时抛出可操作错误", () => {
    const dir = createTempDir()
    expect(() => resolveBootstrapSource(dir)).toThrow(/找不到数据库初始化来源/)
  })
})

describe("applyInitSql", () => {
  it("在空库执行 init.sql（多语句）", () => {
    const dir = createTempDir()
    const initPath = writeInitSql(dir)
    const sqlite = new Database(":memory:")

    applyInitSql(sqlite, initPath)

    expect(tableNames(sqlite)).toContain("demo")
    sqlite.close()
  })

  it("已有 users 核心表时跳过（不重复执行 init.sql）", () => {
    const dir = createTempDir()
    const initPath = writeInitSql(dir)
    const sqlite = new Database(":memory:")
    sqlite.exec("CREATE TABLE users (id integer PRIMARY KEY NOT NULL);")

    applyInitSql(sqlite, initPath)

    expect(tableNames(sqlite)).toEqual(["users"])
    sqlite.close()
  })

  it("存在其它业务表但缺 users → 抛可操作错误，且不执行 init.sql", () => {
    const dir = createTempDir()
    const initPath = writeInitSql(dir)
    const sqlite = new Database(":memory:")
    sqlite.exec("CREATE TABLE legacy (id text);")

    expect(() => applyInitSql(sqlite, initPath)).toThrow(/users/)
    expect(() => applyInitSql(sqlite, initPath)).toThrow(/db:reset/)
    expect(tableNames(sqlite)).toEqual(["legacy"])
    sqlite.close()
  })

  it("init.sql 中途失败时整体回滚（不留半初始化表）", () => {
    const dir = createTempDir()
    const initPath = join(dir, "init.sql")
    writeFileSync(
      initPath,
      [
        "CREATE TABLE users (id integer PRIMARY KEY AUTOINCREMENT NOT NULL);",
        "--> statement-breakpoint",
        "CREATE TABLE broken (id text NOT NULL,);", // 语法错误：故意失败
        "",
      ].join("\n")
    )
    const sqlite = new Database(":memory:")

    expect(() => applyInitSql(sqlite, initPath)).toThrow()

    // 事务回滚：失败语句之前创建的 users 表也不能残留
    expect(tableNames(sqlite)).toEqual([])
    sqlite.close()
  })
})

describe("bootstrapDatabase", () => {
  it("drizzle 分支用临时迁移目录真实执行并建表", () => {
    const dir = createTempDir()
    const drizzleDir = writeDrizzleMigrations(dir)
    const sqlite = new Database(":memory:")
    const db = createDrizzleDb(sqlite)

    const source = bootstrapDatabase(sqlite, db, { baseDir: dir })

    expect(source).toEqual({ kind: "drizzle", path: drizzleDir })
    const tables = tableNames(sqlite)
    expect(tables).toContain("users")
    // drizzle migrator 的迁移记录表，证明走的是真实 migrate 而非空跑
    expect(tables).toContain("__drizzle_migrations")

    // 再次执行应幂等：已应用的迁移不会重复建表
    expect(() => bootstrapDatabase(sqlite, db, { baseDir: dir })).not.toThrow()

    sqlite.close()
  })
})
