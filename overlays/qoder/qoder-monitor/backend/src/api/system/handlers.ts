import type { Context } from 'hono'
import { getDb, getSqlite, closeDb, schema } from '../../db'
import fs from 'fs'
import path from 'path'
import { eq, sql } from 'drizzle-orm'

// GET /api/health - Health check (F-013)
export function healthCheck(c: Context) {
  try {
    const db = getDb()
    const sqlite = getSqlite()

    // Check database connection
    let dbConnected = false
    let dbSize = 0
    let turnCount = 0

    try {
      const result = sqlite.prepare('SELECT 1 as ok').get() as any
      dbConnected = result?.ok === 1

      // Get db file size
      const dbPath = path.resolve(process.cwd(), 'data', 'monitor.db')
      if (fs.existsSync(dbPath)) {
        dbSize = fs.statSync(dbPath).size
      }

      // Count turns
      const countResult = db.select({ count: sql<number>`count(*)` }).from(schema.turns).all()
      turnCount = countResult[0].count
    } catch {
      dbConnected = false
    }

    return c.json({
      ok: true,
      data: {
        status: dbConnected ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        db_connected: dbConnected,
        db_size: dbSize,
        turn_count: turnCount,
      }
    })
  } catch (err) {
    return c.json({
      ok: true,
      data: {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        db_connected: false,
        db_size: 0,
        turn_count: 0,
      }
    })
  }
}

// DELETE /api/data - Clear all data (F-012)
export function clearAllData(c: Context) {
  try {
    const db = getDb()
    const sqlite = getSqlite()

    // Disable foreign keys temporarily to allow cascading deletes
    sqlite.pragma('foreign_keys = OFF')

    // Delete in dependency order
    db.delete(schema.timers).run()
    db.delete(schema.optimizations).run()
    db.delete(schema.turns).run()
    db.delete(schema.sessions).run()

    sqlite.pragma('foreign_keys = ON')

    // Delete JSONL backup file (silently skip if doesn't exist - BR-022)
    const dataDir = path.resolve(process.cwd(), 'data')
    const jsonlPath = path.join(dataDir, 'monitor.jsonl')
    if (fs.existsSync(jsonlPath)) {
      try {
        fs.unlinkSync(jsonlPath)
      } catch {
        // BR-022: Silently skip
      }
    }

    return c.json({
      ok: true,
      data: {
        message: '所有数据已清空',
        cleared_tables: ['turns', 'optimizations', 'sessions', 'timers'],
      }
    })
  } catch (err) {
    return c.json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: '数据清空失败' }
    }, 500)
  }
}
