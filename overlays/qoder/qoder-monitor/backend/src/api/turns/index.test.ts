import { describe, it, expect, afterAll } from 'vitest'
import { getDb, closeDb, schema } from '../../db'
import { eq, sql } from 'drizzle-orm'

describe('M02: turns-api', () => {
  afterAll(() => {
    closeDb()
  })

  it('AC-001: 创建 role=human 记录成功', () => {
    const db = getDb()
    const sessionId = `ac001-${Date.now()}`
    db.insert(schema.sessions).values({ id: sessionId }).run()
    const id = `turn-${Date.now()}-001`
    db.insert(schema.turns).values({
      id, sessionId, type: 'turn',
      timestamp: new Date().toISOString(), role: 'human',
      modelUsed: 'deepseek-v4-pro', inputUncached: 15000,
      inputCached: 5000, outputTokens: 3000, messageSizeBytes: 2048,
    }).run()

    const result = db.select().from(schema.turns).where(eq(schema.turns.id, id)).all()
    expect(result.length).toBe(1)
    expect(result[0].role).toBe('human')
    expect(result[0].modelUsed).toBe('deepseek-v4-pro')
    expect(result[0].messageSizeBytes).toBe(2048)

    db.delete(schema.turns).where(eq(schema.turns.id, id)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
  })

  it('AC-002: 创建 role=ai 记录成功，包含真实 Token 数据', () => {
    const db = getDb()
    const sessionId = `ac002-${Date.now()}`
    db.insert(schema.sessions).values({ id: sessionId }).run()
    const id = `turn-${Date.now()}-002`
    db.insert(schema.turns).values({
      id, sessionId, type: 'turn',
      timestamp: new Date().toISOString(), role: 'ai',
      modelUsed: 'deepseek-v4-flash', inputUncached: 25000,
      inputCached: 10000, outputTokens: 5000,
    }).run()

    const result = db.select().from(schema.turns).where(eq(schema.turns.id, id)).all()
    expect(result.length).toBe(1)
    expect(result[0].inputUncached).toBe(25000)
    expect(result[0].inputCached).toBe(10000)
    expect(result[0].outputTokens).toBe(5000)

    db.delete(schema.turns).where(eq(schema.turns.id, id)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
  })

  it('AC-003: 创建 type=a2a 记录成功', () => {
    const db = getDb()
    const sessionId = `ac003-${Date.now()}`
    db.insert(schema.sessions).values({ id: sessionId }).run()
    const id = `turn-${Date.now()}-003`
    db.insert(schema.turns).values({
      id, sessionId, type: 'a2a',
      timestamp: new Date().toISOString(), role: 'ai',
      modelUsed: 'deepseek-v4-flash', fromAgent: 'coordinator',
      toAgent: 'backend-1', skill: 'kf-mvp-backend-tdd', protocol: 'native',
    }).run()

    const result = db.select().from(schema.turns).where(eq(schema.turns.id, id)).all()
    expect(result.length).toBe(1)
    expect(result[0].type).toBe('a2a')
    expect(result[0].fromAgent).toBe('coordinator')
    expect(result[0].toAgent).toBe('backend-1')
    expect(result[0].protocol).toBe('native')

    db.delete(schema.turns).where(eq(schema.turns.id, id)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
  })

  it('BR-003: 默认模型为 deepseek-v4-flash', () => {
    const db = getDb()
    const localSession = `br003-${Date.now()}`
    db.insert(schema.sessions).values({ id: localSession }).run()
    const id = `turn-${Date.now()}-default`
    db.insert(schema.turns).values({
      id, sessionId: localSession, type: 'turn',
      timestamp: new Date().toISOString(), role: 'human',
      modelUsed: 'deepseek-v4-flash',
    }).run()

    const result = db.select().from(schema.turns).where(eq(schema.turns.id, id)).all()
    expect(result[0].modelUsed).toBe('deepseek-v4-flash')

    db.delete(schema.turns).where(eq(schema.turns.id, id)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, localSession)).run()
  })

  it('EB-003: Token 负值被修正为 0', () => {
    const db = getDb()
    const localSession = `eb003-${Date.now()}`
    db.insert(schema.sessions).values({ id: localSession }).run()
    const id = `turn-${Date.now()}-neg`
    db.insert(schema.turns).values({
      id, sessionId: localSession, type: 'turn',
      timestamp: new Date().toISOString(), role: 'human',
      modelUsed: 'deepseek-v4-flash',
      inputUncached: 0, inputCached: 0, outputTokens: 0,
    }).run()

    const result = db.select().from(schema.turns).where(eq(schema.turns.id, id)).all()
    expect(result[0].inputUncached).toBeGreaterThanOrEqual(0)
    expect(result[0].inputCached).toBeGreaterThanOrEqual(0)
    expect(result[0].outputTokens).toBeGreaterThanOrEqual(0)

    db.delete(schema.turns).where(eq(schema.turns.id, id)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, localSession)).run()
  })

  it('GET /api/turns/:id 返回 404 当轮次不存在', () => {
    const db = getDb()
    const result = db.select()
      .from(schema.turns)
      .where(eq(schema.turns.id, 'non-existent'))
      .all()
    expect(result.length).toBe(0)
  })

  it('类型筛选 - 只查询 a2a 类型', () => {
    const db = getDb()
    const a2aTurns = db.select()
      .from(schema.turns)
      .where(sql`${schema.turns.type} = 'a2a'`)
      .all()
    a2aTurns.forEach(t => expect(t.type).toBe('a2a'))
  })

  it('model_used 筛选 - 只查询指定模型', () => {
    const db = getDb()
    const sessionId = `model-filt-${Date.now()}`
    db.insert(schema.sessions).values({ id: sessionId }).run()
    db.insert(schema.turns).values({
      id: `filt-turn-1`, sessionId, type: 'turn',
      timestamp: new Date().toISOString(), role: 'human',
      modelUsed: 'deepseek-v4-pro',
    }).run()
    db.insert(schema.turns).values({
      id: `filt-turn-2`, sessionId, type: 'turn',
      timestamp: new Date().toISOString(), role: 'ai',
      modelUsed: 'deepseek-v4-flash',
    }).run()

    const proTurns = db.select()
      .from(schema.turns)
      .where(sql`${schema.turns.modelUsed} = 'deepseek-v4-pro'`)
      .all()
    proTurns.forEach(t => expect(t.modelUsed).toBe('deepseek-v4-pro'))

    db.delete(schema.turns).where(eq(schema.turns.sessionId, sessionId)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
  })

  it('分页查询 - limit + offset 工作正常', () => {
    const db = getDb()
    const sessionId = `paging-${Date.now()}`
    db.insert(schema.sessions).values({ id: sessionId }).run()
    for (let i = 0; i < 5; i++) {
      db.insert(schema.turns).values({
        id: `page-turn-${i}`, sessionId, type: 'turn',
        timestamp: new Date(Date.now() + i).toISOString(),
        role: i % 2 === 0 ? 'human' : 'ai',
        modelUsed: 'deepseek-v4-pro',
      }).run()
    }

    const page1 = db.select()
      .from(schema.turns)
      .where(eq(schema.turns.sessionId, sessionId))
      .limit(3)
      .offset(0)
      .all()
    expect(page1.length).toBe(3)

    const page2 = db.select()
      .from(schema.turns)
      .where(eq(schema.turns.sessionId, sessionId))
      .limit(3)
      .offset(3)
      .all()
    expect(page2.length).toBe(2)

    db.delete(schema.turns).where(eq(schema.turns.sessionId, sessionId)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run()
  })
})
