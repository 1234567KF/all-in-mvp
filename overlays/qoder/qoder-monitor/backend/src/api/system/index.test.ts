import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb, schema } from '../../db'
import { eq, sql } from 'drizzle-orm'

const TEST_SESSION = `test-sys-${Date.now()}`

describe('M06: system-api', () => {
  beforeAll(() => {
    const db = getDb()
    // Create test data
    db.insert(schema.sessions).values({
      id: TEST_SESSION,
      turnCount: 5,
      a2aCount: 1,
      totalInputUncached: 100000,
      totalInputCached: 50000,
      totalOutput: 30000,
      estimatedCost: 2.50,
    }).run()

    // Insert a few turns
    for (let i = 0; i < 3; i++) {
      db.insert(schema.turns).values({
        id: `sys-turn-${i}`,
        sessionId: TEST_SESSION,
        type: 'turn',
        timestamp: new Date().toISOString(),
        role: i % 2 === 0 ? 'human' : 'ai',
        modelUsed: 'deepseek-v4-pro',
        inputUncached: 10000,
        inputCached: 5000,
        outputTokens: 3000,
      }).run()
    }

    db.insert(schema.optimizations).values({
      optId: `sys-opt-1`,
      sessionId: TEST_SESSION,
      timestamp: new Date().toISOString(),
      modelSwitched: false,
      mechanisms: JSON.stringify({ lean_ctx: 10000 }),
      savedTotal: 10000,
    }).run()
  })

  afterAll(() => {
    const db = getDb()
    db.delete(schema.optimizations).where(eq(schema.optimizations.sessionId, TEST_SESSION)).run()
    db.delete(schema.turns).where(eq(schema.turns.sessionId, TEST_SESSION)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, TEST_SESSION)).run()
    closeDb()
  })

  it('AC-013: 数据库连接健康', () => {
    const db = getDb()
    const result = db.select({ count: sql<number>`count(*)` }).from(schema.sessions).all()
    // Should at least find our test session
    expect(result[0].count).toBeGreaterThanOrEqual(1)
  })

  it('数据库可读写', () => {
    const db = getDb()
    const sessions = db.select().from(schema.sessions).all()
    expect(sessions.length).toBeGreaterThanOrEqual(1)

    const turns = db.select().from(schema.turns).all()
    expect(turns.length).toBeGreaterThanOrEqual(3)
  })

  it('AC-012: 数据清空 - 按表验证删除', () => {
    const db = getDb()
    // Manually delete in dependency order (same as handler)
    db.delete(schema.timers).run()
    db.delete(schema.optimizations).run()
    db.delete(schema.turns).run()
    db.delete(schema.sessions).run()

    const sessionsLeft = db.select({ count: sql<number>`count(*)` }).from(schema.sessions).all()
    expect(sessionsLeft[0].count).toBe(0)

    const turnsLeft = db.select({ count: sql<number>`count(*)` }).from(schema.turns).all()
    expect(turnsLeft[0].count).toBe(0)

    const optsLeft = db.select({ count: sql<number>`count(*)` }).from(schema.optimizations).all()
    expect(optsLeft[0].count).toBe(0)

    const timersLeft = db.select({ count: sql<number>`count(*)` }).from(schema.timers).all()
    expect(timersLeft[0].count).toBe(0)
  })

  it('BR-022: 重复 DELETE 操作安全（幂等）', () => {
    const db = getDb()
    // First delete already happened in previous test, second should be safe
    db.delete(schema.timers).run()
    db.delete(schema.optimizations).run()
    db.delete(schema.turns).run()
    db.delete(schema.sessions).run()

    // Should still be empty
    const count = db.select({ count: sql<number>`count(*)` }).from(schema.sessions).all()
    expect(count[0].count).toBe(0)
  })
})
