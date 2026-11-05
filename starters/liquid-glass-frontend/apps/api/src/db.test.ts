/**
 * db.ts 测试注入边界单测
 *
 * 重点：测试注入内存库后，getRawSqlite() 必须拒绝返回底层连接，
 * 否则「先初始化真实库、再注入内存库」的进程会静默读到真实文件库（测试污染）。
 */
import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"

import { _setTestDb, getRawSqlite } from "./db.js"
import { createDrizzleDb } from "./db/index.js"

describe("getRawSqlite()", () => {
  it("测试注入数据库时不暴露底层连接，改为显式报错", () => {
    const sqlite = new Database(":memory:")
    _setTestDb(createDrizzleDb(sqlite))
    try {
      expect(() => getRawSqlite()).toThrow("测试注入的数据库")
      expect(() => getRawSqlite()).toThrow("请显式传入 db 参数")
    } finally {
      _setTestDb(null)
      sqlite.close()
    }
  })
})
