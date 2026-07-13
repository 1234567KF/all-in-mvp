/**
 * Seed 数据初始化脚本 — Stage 2 标准产物
 *
 * 用于 E2E 测试前初始化文件数据库（非内存数据库），确保测试环境与人工验收环境一致。
 *
 * 使用方式:
 *   npx tsx templates/e2e/seed.ts              # 幂等模式（已有数据不重复插入）
 *   npx tsx templates/e2e/seed.ts --reset      # 重置模式（删除 DB 文件重建，每次测试前推荐）
 *   npx tsx templates/e2e/seed.ts --db=:memory: # 内存数据库模式（单元测试用）
 *
 * 设计原则:
 *   - --reset: 完全删除旧 DB 文件重建，确保每次 E2E 测试从干净状态开始
 *   - 默认幂等: 多次执行不产生重复数据（使用 INSERT OR IGNORE）
 *   - 确定性: 固定测试账号，不依赖随机值
 *   - 完整性: 包含角色、用户、以及关联的业务初始化数据
 */

import Database from 'better-sqlite3'
import { resolve } from 'node:path'
import { existsSync, unlinkSync } from 'node:fs'

// ─── 参数解析 ──────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const SHOULD_RESET = args.includes('--reset')
const DB_PATH = args.find(a => a.startsWith('--db='))?.split('=')[1]
  || resolve(process.cwd(), 'wecrm.db')

/** 测试用户种子数据 — 覆盖所有角色（管理员 / 销售 / 渠道） */
const SEED_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin', displayName: '系统管理员' },
  { username: 'sales1', password: 'sales123', role: 'sales', displayName: '销售张三' },
  { username: 'sales2', password: 'sales123', role: 'sales', displayName: '销售李四' },
  { username: 'partner1', password: 'partner123', role: 'partner', displayName: '渠道王五' },
]

/** 测试角色 */
const SEED_ROLES = [
  { name: 'admin', permissions: JSON.stringify(['*']) },
  { name: 'sales', permissions: JSON.stringify(['customer:read', 'customer:write', 'lead:read', 'lead:write']) },
  { name: 'partner', permissions: JSON.stringify(['customer:read', 'lead:read']) },
]

// ─── 初始化 ──────────────────────────────────────────────────────────────

function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      permissions TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sales',
      display_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

function seedRoles(db: Database.Database): void {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO roles (name, permissions) VALUES (@name, @permissions)'
  )
  for (const role of SEED_ROLES) {
    stmt.run(role)
  }
}

function seedUsers(db: Database.Database): void {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO users (username, password, role, display_name) VALUES (@username, @password, @role, @displayName)'
  )
  for (const user of SEED_USERS) {
    stmt.run(user)
  }
}

function verify(db: Database.Database): void {
  const roleCount = (db.prepare('SELECT COUNT(*) as count FROM roles').get() as any).count
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count

  console.log(`  ✅ 角色: ${roleCount} 条`)
  console.log(`  ✅ 用户: ${userCount} 条`)
  console.log('')
  console.log('  测试账号:')
  for (const u of SEED_USERS) {
    console.log(`    ${u.role.padEnd(8)} | ${u.username.padEnd(12)} | ${u.password}`)
  }
}

// ─── 入口 ──────────────────────────────────────────────────────────────

function main(): void {
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  Seed 数据初始化')
  console.log('═══════════════════════════════════════════')
  console.log('')
  console.log(`  数据库路径: ${DB_PATH}`)
  console.log(`  模式: ${SHOULD_RESET ? '重置（删除旧 DB 重建）' : DB_PATH === ':memory:' ? '内存数据库' : '幂等（保留已有数据）'}`)

  // --reset: 删除旧文件，确保干净状态
  if (SHOULD_RESET && DB_PATH !== ':memory:' && existsSync(DB_PATH)) {
    console.log(`  删除旧数据库: ${DB_PATH}`)
    unlinkSync(DB_PATH)
    // 同时删除 WAL 和 SHM 文件
    if (existsSync(`${DB_PATH}-wal`)) unlinkSync(`${DB_PATH}-wal`)
    if (existsSync(`${DB_PATH}-shm`)) unlinkSync(`${DB_PATH}-shm`)
  }

  const db = new Database(DB_PATH)

  // 启用 WAL 模式以支持并发读写
  db.pragma('journal_mode = WAL')

  initDb(db)
  seedRoles(db)
  seedUsers(db)

  console.log('')
  verify(db)

  db.close()

  console.log('')
  console.log('  ✅ Seed 数据初始化完成！')
  console.log('')
}

main()
