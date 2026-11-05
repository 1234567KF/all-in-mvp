/**
 * sqlite-ops.ts 单元测试
 *
 * 覆盖：
 * - getSqliteStats：表行数 / 大小 / 空闲页 / WAL 文件 / 内部表排除；
 * - runSqliteVacuum：回收空闲页、数据不丢、返回值口径；
 * - createSqliteBackup：本地快照可打开、命名规则、轮转保留、参数校验、
 *   OSS 模式（注入假 storage：上传 / 删除本地临时文件 / 云端轮转 / 上传失败清理）。
 */
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { Database } from "bun:sqlite"
import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import {
  _setOssConfigForTesting,
  deleteOssObjects,
  getOssBackupPrefix,
  listOssObjects,
  type OssConfig,
  uploadOssObject,
} from "./oss.js"
import {
  createSqliteBackup,
  DEFAULT_BACKUP_RETAIN,
  getSqliteStats,
  resolveBackupStorage,
  runSqliteVacuum,
  type SqliteBackupStorage,
} from "./sqlite-ops.js"

/** 备份文件名：backup-YYYYMMDDTHHmmss-<8位随机>.db */
const BACKUP_FILE_RE = /^backup-\d{8}T\d{6}-[a-z0-9]+\.db$/

let tmpDirs: string[] = []

/** 创建临时备份目录（测试结束统一清理） */
function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "sqlite-ops-test-"))
  tmpDirs.push(dir)
  return dir
}

/** 内存库 + 示例表；调用方负责 close */
function createTestDb(): Database {
  const db = new Database(":memory:")
  db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
  db.exec("CREATE TABLE logs (id INTEGER PRIMARY KEY, msg TEXT)")
  db.exec("INSERT INTO users (name) VALUES ('alice'), ('bob')")
  db.exec("INSERT INTO logs (msg) VALUES ('hello')")
  return db
}

/** 假 OSS storage：记录调用、维护 key 列表（不发网络请求） */
function createFakeOssStorage(seedKeys: string[] = []): {
  storage: Extract<SqliteBackupStorage, { mode: "oss" }>
  uploaded: Array<{ key: string; localPath: string; sizeBytes: number }>
  removed: string[]
  keys: string[]
} {
  const keys = [...seedKeys]
  const uploaded: Array<{ key: string; localPath: string; sizeBytes: number }> =
    []
  const removed: string[] = []
  const storage = {
    mode: "oss",
    prefix: "backups/",
    upload: async (key, localPath) => {
      uploaded.push({ key, localPath, sizeBytes: statSync(localPath).size })
      keys.push(key)
    },
    list: async () => [...keys],
    remove: async (toRemove) => {
      removed.push(...toRemove)
      for (const key of toRemove) {
        const index = keys.indexOf(key)
        if (index >= 0) keys.splice(index, 1)
      }
      return toRemove
    },
  } as Extract<SqliteBackupStorage, { mode: "oss" }>
  return { storage, uploaded, removed, keys }
}

afterEach(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
  tmpDirs = []
  _setOssConfigForTesting(null)
})

// ─── getSqliteStats ─────────────────────────────────────────────────────────

describe("getSqliteStats()", () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  it("统计各用户表行数（按表名排序）", () => {
    const stats = getSqliteStats(db)
    expect(stats.tables).toEqual([
      { name: "logs", rows: 1 },
      { name: "users", rows: 2 },
    ])
  })

  it("返回逻辑库大小与空闲页（内存库 path 为 :memory:）", () => {
    const stats = getSqliteStats(db)
    expect(stats.path).toBe(":memory:")
    expect(stats.sizeBytes).toBeGreaterThan(0)
    expect(stats.sizeBytes % 1024).toBe(0) // page_count × page_size
    expect(stats.freeBytes).toBeGreaterThanOrEqual(0)
    expect(stats.walBytes).toBe(0)
  })

  it("排除 sqlite_ 内部表", () => {
    db.exec(
      "CREATE TABLE auto_inc (id INTEGER PRIMARY KEY AUTOINCREMENT, v TEXT)"
    )
    db.exec("INSERT INTO auto_inc (v) VALUES ('x')")
    const names = getSqliteStats(db).tables.map((t) => t.name)
    expect(names).toContain("auto_inc")
    expect(names.some((name) => name.startsWith("sqlite_"))).toBe(false)
  })

  it("文件库返回文件路径，并统计 -wal 大小（临时关闭自动 checkpoint）", () => {
    const fileDb = new Database(path.join(makeTempDir(), "stats.db"))
    try {
      fileDb.exec("PRAGMA journal_mode = WAL")
      fileDb.exec("PRAGMA wal_autocheckpoint = 0")
      fileDb.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)")
      fileDb.exec("INSERT INTO t DEFAULT VALUES")

      const walPath = `${fileDb.filename}-wal`
      expect(existsSync(walPath)).toBe(true)
      const stats = getSqliteStats(fileDb)
      expect(stats.path).toBe(fileDb.filename)
      expect(stats.walBytes).toBeGreaterThan(0)
      expect(stats.journalMode).toBe("wal")
    } finally {
      fileDb.close()
    }
  })
})

// ─── runSqliteVacuum ────────────────────────────────────────────────────────

describe("runSqliteVacuum()", () => {
  it("回收空闲页，数据不丢失", () => {
    const db = createTestDb()
    try {
      // 制造大量空闲页：写入 1000 行后全部删除
      db.exec("CREATE TABLE bulk (id INTEGER PRIMARY KEY, v TEXT)")
      const insert = db.prepare("INSERT INTO bulk (v) VALUES (?)")
      for (let i = 0; i < 1000; i++) insert.run(`payload-${i}`)
      db.exec("DELETE FROM bulk")

      const before = getSqliteStats(db).sizeBytes
      const result = runSqliteVacuum(db)
      const after = getSqliteStats(db).sizeBytes

      expect(result.beforeBytes).toBe(before)
      expect(result.afterBytes).toBe(after)
      expect(result.freedBytes).toBeGreaterThan(0)
      expect(after).toBeLessThan(before)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)

      // 原有数据完整保留
      expect(getSqliteStats(db).tables).toEqual([
        { name: "bulk", rows: 0 },
        { name: "logs", rows: 1 },
        { name: "users", rows: 2 },
      ])
      expect(
        (db.query("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c
      ).toBe(2)
    } finally {
      db.close()
    }
  })

  it("空库上执行也不报错（freedBytes 可为 0）", () => {
    const db = new Database(":memory:")
    try {
      // 空库 VACUUM 后 ANALYZE 会新建 sqlite_stat1，after 可能大于 before（freed 为负），
      // 因此空库场景只断言口径自洽（freed = before - after）与结果非空。
      const result = runSqliteVacuum(db)
      expect(result.freedBytes).toBe(result.beforeBytes - result.afterBytes)
      expect(result.afterBytes).toBeGreaterThan(0)
    } finally {
      db.close()
    }
  })
})

// ─── createSqliteBackup ─────────────────────────────────────────────────────

describe("createSqliteBackup() — 本地模式", () => {
  let db: Database

  it("默认保留份数为 30", () => {
    expect(DEFAULT_BACKUP_RETAIN).toBe(30)
  })

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  it("VACUUM INTO 生成快照，返回结果与文件一致", async () => {
    const dir = makeTempDir()
    const result = await createSqliteBackup({ db, dir })

    expect(result.storage).toBe("local")
    expect(result.fileName).toMatch(BACKUP_FILE_RE)
    expect(result.retainedCount).toBe(1)
    expect(Number.isNaN(Date.parse(result.at))).toBe(false)

    const filePath = path.join(dir, result.fileName)
    expect(existsSync(filePath)).toBe(true)
    expect(result.sizeBytes).toBe(statSync(filePath).size)
    expect(result.sizeMB).toBe(
      Math.round((result.sizeBytes / 1024 / 1024) * 100) / 100
    )
  })

  it("快照是可直接打开的完整数据库（数据一致）", async () => {
    const dir = makeTempDir()
    const result = await createSqliteBackup({ db, dir })

    const backupDb = new Database(path.join(dir, result.fileName), {
      readonly: true,
    })
    try {
      expect(
        (
          backupDb.query("SELECT COUNT(*) AS c FROM users").get() as {
            c: number
          }
        ).c
      ).toBe(2)
      expect(
        (
          backupDb.query("SELECT COUNT(*) AS c FROM logs").get() as {
            c: number
          }
        ).c
      ).toBe(1)
    } finally {
      backupDb.close()
    }
  })

  it("按文件名时间戳轮转：只保留最近 retain 份，且不误删非备份文件", async () => {
    const dir = makeTempDir()
    // 预置两天前的旧备份 + 一个无关文件
    writeFileSync(path.join(dir, "backup-20200101T000000-aaaaaaaa.db"), "")
    writeFileSync(path.join(dir, "backup-20200102T000000-bbbbbbbb.db"), "")
    writeFileSync(path.join(dir, "notes.txt"), "keep me")

    const result = await createSqliteBackup({ db, dir })

    expect(result.retainedCount).toBe(3)
    const files = readdirSync(dir)
    expect(files.filter((f) => BACKUP_FILE_RE.test(f))).toHaveLength(3)
    expect(files).toContain(result.fileName)
    expect(files).toContain("notes.txt") // 非备份文件不受轮转影响
  })

  it("retain=1 时只保留最新快照", async () => {
    const dir = makeTempDir()
    writeFileSync(path.join(dir, "backup-20200101T000000-aaaaaaaa.db"), "")

    const result = await createSqliteBackup({ db, dir, retain: 1 })

    expect(result.retainedCount).toBe(1)
    expect(readdirSync(dir)).toEqual([result.fileName])
  })

  it("支持自定义文件名前缀", async () => {
    const dir = makeTempDir()
    const result = await createSqliteBackup({
      db,
      dir,
      filePrefix: "snapshot_1",
    })
    expect(result.fileName).toMatch(/^snapshot_1-\d{8}T\d{6}-[a-z0-9]+\.db$/)
    expect(existsSync(path.join(dir, result.fileName))).toBe(true)
  })

  it("目录不存在时自动创建", async () => {
    const dir = path.join(makeTempDir(), "nested", "backups")
    const result = await createSqliteBackup({ db, dir })
    expect(existsSync(path.join(dir, result.fileName))).toBe(true)
  })

  it("非法 retain / filePrefix 直接拒绝，不产生文件", async () => {
    const dir = makeTempDir()
    await expect(createSqliteBackup({ db, dir, retain: 0 })).rejects.toThrow(
      "retain 必须为正整数"
    )
    await expect(createSqliteBackup({ db, dir, retain: 1.5 })).rejects.toThrow(
      "retain 必须为正整数"
    )
    await expect(
      createSqliteBackup({ db, dir, filePrefix: "../evil" })
    ).rejects.toThrow("filePrefix 只能包含")
    await expect(
      createSqliteBackup({ db, dir, filePrefix: "a/b" })
    ).rejects.toThrow("filePrefix 只能包含")
    expect(readdirSync(dir)).toEqual([])
  })
})

describe("createSqliteBackup() — OSS 模式（注入假 storage）", () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  it("上传到备份前缀后删除本地临时文件，返回 storage=oss", async () => {
    const dir = makeTempDir()
    const fake = createFakeOssStorage()

    const result = await createSqliteBackup({
      db,
      dir,
      storage: fake.storage,
    })

    expect(result.storage).toBe("oss")
    expect(result.retainedCount).toBe(1)
    expect(fake.uploaded).toHaveLength(1)
    expect(fake.uploaded[0]!.key).toBe(`backups/${result.fileName}`)
    expect(fake.uploaded[0]!.sizeBytes).toBe(result.sizeBytes)
    // 本地临时快照已清理
    expect(readdirSync(dir)).toEqual([])
  })

  it("云端按时间戳轮转，删除超额旧备份", async () => {
    const dir = makeTempDir()
    const fake = createFakeOssStorage([
      "backups/backup-20200101T000000-aaaaaaaa.db",
      "backups/backup-20200102T000000-bbbbbbbb.db",
    ])

    const result = await createSqliteBackup({
      db,
      dir,
      retain: 2,
      storage: fake.storage,
    })

    expect(result.retainedCount).toBe(2)
    expect(fake.removed).toEqual(["backups/backup-20200101T000000-aaaaaaaa.db"])
    expect(fake.keys).toHaveLength(2)
    expect(fake.keys).toContain(`backups/${result.fileName}`)
  })

  it("云端轮转删除失败时 retainedCount 以实际剩余为准，不虚报", async () => {
    const dir = makeTempDir()
    const fake = createFakeOssStorage([
      "backups/backup-20200101T000000-aaaaaaaa.db",
    ])
    // 模拟默认适配器吞掉删除失败：remove 返回空数组但一个都不删
    const failingStorage: SqliteBackupStorage = {
      ...fake.storage,
      remove: async () => [],
    }

    const result = await createSqliteBackup({
      db,
      dir,
      retain: 1,
      storage: failingStorage,
    })

    // 旧备份仍在（删除失败），retainedCount 必须反映真实剩余数量而非期望值
    expect(result.retainedCount).toBe(2)
    expect(fake.keys).toHaveLength(2)
  })

  it("删除阶段抛错时向上抛错（不吞错）", async () => {
    const dir = makeTempDir()
    const fake = createFakeOssStorage([
      "backups/backup-20200101T000000-aaaaaaaa.db",
    ])
    const throwingStorage: SqliteBackupStorage = {
      ...fake.storage,
      remove: async () => {
        throw new Error("remove boom")
      },
    }

    await expect(
      createSqliteBackup({ db, dir, retain: 1, storage: throwingStorage })
    ).rejects.toThrow("remove boom")
    // 上传后的本地临时快照仍应被清理
    expect(readdirSync(dir)).toEqual([])
  })

  it("上传失败时清理本地临时快照并向上抛错", async () => {
    const dir = makeTempDir()
    const storage: SqliteBackupStorage = {
      mode: "oss",
      prefix: "backups/",
      upload: async () => {
        throw new Error("oss network down")
      },
      list: async () => [],
      remove: async () => [],
    }

    await expect(createSqliteBackup({ db, dir, storage })).rejects.toThrow(
      "oss network down"
    )
    expect(readdirSync(dir)).toEqual([])
  })
})

describe("resolveBackupStorage() — 默认组装", () => {
  const OSS_ON: OssConfig = {
    accessKeyId: "id",
    accessKeySecret: "secret",
    bucket: "bucket",
    region: "oss-cn-hangzhou",
    endpoint: "",
    prefix: "",
    cdnDomain: "",
    maxUploadSizeMB: 10,
  }
  const OSS_OFF: OssConfig = {
    ...OSS_ON,
    accessKeyId: "",
    accessKeySecret: "",
    bucket: "",
  }

  it("未启用 OSS → local 模式（不组装云端依赖）", () => {
    _setOssConfigForTesting(OSS_OFF)
    expect(resolveBackupStorage()).toEqual({ mode: "local" })
  })

  it("启用 OSS → oss 模式，prefix 与 oss.ts 同源、函数指向 oss 适配器", () => {
    _setOssConfigForTesting(OSS_ON)
    const storage = resolveBackupStorage()
    expect(storage.mode).toBe("oss")
    if (storage.mode !== "oss") return
    expect(storage.prefix).toBe(getOssBackupPrefix())
    expect(storage.prefix).toBe("backups/")
    expect(storage.upload).toBe(uploadOssObject)
    expect(storage.list).toBe(listOssObjects)
    expect(storage.remove).toBe(deleteOssObjects)
  })

  it("OSS_PREFIX 参与备份前缀（多环境隔离）", () => {
    _setOssConfigForTesting({ ...OSS_ON, prefix: "my-app/dev" })
    const storage = resolveBackupStorage()
    expect(storage.mode).toBe("oss")
    if (storage.mode !== "oss") return
    expect(storage.prefix).toBe("my-app/dev/backups/")
  })

  it("显式注入的 storage 原样返回（便于测试 / 自定义）", () => {
    const custom: SqliteBackupStorage = { mode: "local" }
    expect(resolveBackupStorage(custom)).toBe(custom)
  })
})
