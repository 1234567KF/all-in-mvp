/**
 * db/seed-users 单测：账号定义唯一真源（R010）的两种播种语义
 *
 * 为什么单独成文件：src/db.ts（启动兜底）与 scripts/seed-dev.ts（本地手动播种）
 * 历史上各写一份账号，合并成单一真源时最容易把「启动行为」一起改掉。
 * 两种语义的差别就是这里的一条条断言：
 * - 启动兜底（seedUsersOnStartup，src/db.ts 的唯一入口）空库才播种，存量库不回填
 *   （否则删掉的默认 admin 会在下次重启被静默复活成可用口令的入口）；
 * - 手动播种按 email 幂等补齐，且绝不覆盖已存在账号的口令。
 */
import { join } from "node:path"

import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"

import { hashPasswordSync, verifyPassword } from "../utils/password.js"
import { applyInitSql } from "./bootstrap.js"
import type { DrizzleDB } from "./index.js"
import { createDrizzleDb } from "./index.js"
import { users } from "./schema.js"
import {
  DEV_SEED_PASSWORD,
  SEED_USER_ACCOUNTS,
  seedUsers,
  seedUsersOnStartup,
} from "./seed-users.js"

/** 结构真源：直接用 apps/api/init.sql，schema 演进时本文件不会静默失真 */
const INIT_SQL_PATH = join(import.meta.dir, "..", "..", "init.sql")

const STARTER_ACCOUNTS = SEED_USER_ACCOUNTS.filter((a) => !a.devOnly)

/** 空库：执行真实 init.sql 建表（顺带验证结构漂移守卫对 init.sql 不误报） */
function openEmptyDb(): { sqlite: Database; db: DrizzleDB } {
  const sqlite = new Database(":memory:")
  applyInitSql(sqlite, INIT_SQL_PATH)
  return { sqlite, db: createDrizzleDb(sqlite) }
}

function emails(d: DrizzleDB): string[] {
  return d
    .select({ email: users.email })
    .from(users)
    .all()
    .map((row) => row.email)
}

function passwordOf(d: DrizzleDB, email: string): string | null {
  return (
    d
      .select({ password: users.password })
      .from(users)
      .where(eq(users.email, email))
      .get()?.password ?? null
  )
}

describe("seedUsersOnStartup · 启动兜底语义（只空库播种）", () => {
  it("空库 → 只播种非 devOnly 账号，演示账号不随启动创建", () => {
    const { sqlite, db } = openEmptyDb()

    const seeded = seedUsersOnStartup(db)

    expect(seeded).toBe(STARTER_ACCOUNTS.length)
    expect(emails(db)).toEqual(STARTER_ACCOUNTS.map((a) => a.email))
    expect(emails(db)).not.toContain("demo@example.com")
    sqlite.close()
  })

  it("落库的是哈希而非明文，且能用种子口令验通过", async () => {
    const { sqlite, db } = openEmptyDb()
    seedUsersOnStartup(db)

    const hashed = passwordOf(db, "admin")
    expect(hashed).toStartWith("$2") // bcrypt 前缀，说明不是明文
    expect(hashed).not.toContain(DEV_SEED_PASSWORD)
    expect(await verifyPassword(DEV_SEED_PASSWORD, hashed!)).toBe(true)
    sqlite.close()
  })

  it("存量库缺 admin → 不回填（删掉的默认管理员不会被重启静默复活）", () => {
    const { sqlite, db } = openEmptyDb()
    db.insert(users)
      .values({ email: "ops@example.com", name: "Ops", role: "user" })
      .run()

    const seeded = seedUsersOnStartup(db)

    expect(seeded).toBe(0)
    expect(emails(db)).toEqual(["ops@example.com"])
    sqlite.close()
  })

  it("改过口令的库重启 → 口令不被种子覆盖", async () => {
    const { sqlite, db } = openEmptyDb()
    seedUsersOnStartup(db)

    db.update(users)
      .set({ password: hashPasswordSync("rotated-by-operator") })
      .where(eq(users.email, "admin"))
      .run()

    expect(seedUsersOnStartup(db)).toBe(0)

    const after = passwordOf(db, "admin")
    expect(await verifyPassword("rotated-by-operator", after!)).toBe(true)
    expect(await verifyPassword(DEV_SEED_PASSWORD, after!)).toBe(false)
    sqlite.close()
  })
})

describe("seedUsers · 手动播种语义（seed-dev）", () => {
  it("includeDevOnly → 补齐全部账号；重复执行为 0（幂等）", () => {
    const { sqlite, db } = openEmptyDb()

    const first = seedUsers(db, { includeDevOnly: true })
    const second = seedUsers(db, { includeDevOnly: true })

    expect(first).toBe(SEED_USER_ACCOUNTS.length)
    expect(second).toBe(0)
    expect([...emails(db)].sort()).toEqual(
      SEED_USER_ACCOUNTS.map((a) => a.email).sort()
    )
    sqlite.close()
  })

  it("存量库只补缺失账号，已有行原样保留", () => {
    const { sqlite, db } = openEmptyDb()
    db.insert(users)
      .values({ email: "demo@example.com", name: "已存在", role: "user" })
      .run()

    const seeded = seedUsers(db, { includeDevOnly: true })

    expect(seeded).toBe(SEED_USER_ACCOUNTS.length - 1)
    expect(
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.email, "demo@example.com"))
        .get()?.name
    ).toBe("已存在")
    sqlite.close()
  })

  it("不带 includeDevOnly 时不创建演示账号（生产启动下限不变）", () => {
    const { sqlite, db } = openEmptyDb()

    expect(seedUsers(db)).toBe(STARTER_ACCOUNTS.length)
    expect(emails(db)).toEqual(STARTER_ACCOUNTS.map((a) => a.email))
    sqlite.close()
  })
})
