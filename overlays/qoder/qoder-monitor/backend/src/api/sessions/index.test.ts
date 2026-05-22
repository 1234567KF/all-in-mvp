import { describe, it, expect, afterAll } from 'vitest'
import { getDb, closeDb, schema } from '../../db'
import { eq } from 'drizzle-orm'

describe('M08: sessions-api', () => {
  afterAll(() => {
    closeDb()
  })

  it('AC-006: 新增会话后可查询', () => {
    const db = getDb()
    const sessionId = `sess-test-${Date.now()}`
    db.insert(schema.sessions).values({ id: sessionId }).run()

    const result = db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)).all()
    expect(result.length).toBe(1)
    expect(result[0].turnCount).toBe(0)
    expect(result[0].a2aCount).toBe(0)

    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
  })

  it('会话列表面包含正确字段', () => {
    const db = getDb()
    const sessionId = `sess-fields-${Date.now()}`
    db.insert(schema.sessions).values({
      id: sessionId,
      turnCount: 3,
      a2aCount: 1,
    }).run()

    const items = db.select({
      id: schema.sessions.id,
      turnCount: schema.sessions.turnCount,
      a2aCount: schema.sessions.a2aCount,
      created: schema.sessions.created,
      lastActivity: schema.sessions.lastActivity,
    }).from(schema.sessions).where(eq(schema.sessions.id, sessionId)).all()

    expect(items.length).toBe(1)
    expect(items[0].id).toBe(sessionId)
    expect(items[0].turnCount).toBe(3)
    expect(items[0].a2aCount).toBe(1)
    expect(items[0].created).toBeTruthy()
    expect(items[0].lastActivity).toBeTruthy()

    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
  })

  it('会话切换后看板展示该会话数据', () => {
    const db = getDb()
    const sessionId = `sess-dash-${Date.now()}`
    db.insert(schema.sessions).values({ id: sessionId, turnCount: 2, estimatedCost: 1.5 }).run()

    // Simulate: query session-specific data as dashboard would
    const session = db.select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .all()[0]
    expect(session).toBeDefined()
    expect(session.estimatedCost).toBeCloseTo(1.5)

    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
  })

  it('BR-013: 不存在的会话返回空', () => {
    const db = getDb()
    const result = db.select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, 'non-existent-id'))
      .all()
    expect(result.length).toBe(0)
  })
})
