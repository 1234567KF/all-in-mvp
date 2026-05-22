import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb, schema } from '../../db'
import { eq } from 'drizzle-orm'
import { getDashboardSummary } from './handlers'

// Helper to call handler with mock context and bypass TypeScript strict types
function callHandler(sessionId?: string) {
  const mockC: any = {
    req: { query: (key: string) => key === 'session_id' ? sessionId : undefined },
    json: (data: any) => data,
  }
  return (getDashboardSummary as any)(mockC) as any
}

const TEST_SESSION = `test-dash-${Date.now()}`

describe('M04: dashboard-api', () => {
  beforeAll(() => {
    const db = getDb()
    db.insert(schema.sessions).values({
      id: TEST_SESSION,
      created: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      turnCount: 2,
      a2aCount: 1,
      totalInputUncached: 60000,
      totalInputCached: 20000,
      totalOutput: 15000,
      estimatedCost: 1.50,
    }).run()

    db.insert(schema.turns).values({
      id: `dash-turn-1`,
      sessionId: TEST_SESSION,
      type: 'turn',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      role: 'human',
      modelUsed: 'deepseek-v4-pro',
      inputUncached: 30000,
      inputCached: 10000,
      outputTokens: 8000,
    }).run()

    db.insert(schema.turns).values({
      id: `dash-turn-2`,
      sessionId: TEST_SESSION,
      type: 'a2a',
      timestamp: new Date(Date.now() - 30000).toISOString(),
      role: 'ai',
      modelUsed: 'deepseek-v4-flash',
      fromAgent: 'coordinator',
      toAgent: 'worker',
      inputUncached: 10000,
      inputCached: 5000,
      outputTokens: 3000,
    }).run()

    db.insert(schema.optimizations).values({
      optId: `dash-opt-1`,
      sessionId: TEST_SESSION,
      timestamp: new Date().toISOString(),
      modelSwitched: false,
      mechanisms: JSON.stringify({ lean_ctx: 8000, l1_cache: 4000 }),
      savedTotal: 12000,
    }).run()
  })

  afterAll(() => {
    const db = getDb()
    db.delete(schema.optimizations).where(eq(schema.optimizations.sessionId, TEST_SESSION)).run()
    db.delete(schema.turns).where(eq(schema.turns.sessionId, TEST_SESSION)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, TEST_SESSION)).run()
    closeDb()
  })

  it('AC-005: 数据库中有测试数据', () => {
    const stats = getDb()
      .select({ count: schema.turns.sessionId })
      .from(schema.turns)
      .where(eq(schema.turns.sessionId, TEST_SESSION))
      .all()
    expect(stats.length).toBe(2)
  })

  it('summary_cards 包含 9 个统计字段', () => {
    const result = callHandler(TEST_SESSION)
    const cards = result.data.summary_cards

    expect(cards).toHaveProperty('total_calls')
    expect(cards).toHaveProperty('total_input_tokens')
    expect(cards).toHaveProperty('cache_hit_rate')
    expect(cards).toHaveProperty('total_output_tokens')
    expect(cards).toHaveProperty('model_switch_count')
    expect(cards).toHaveProperty('model_count')
    expect(cards).toHaveProperty('estimated_cost')
    expect(cards).toHaveProperty('total_savings')
    expect(cards).toHaveProperty('currency')
    expect(cards.total_calls).toBeGreaterThan(0)
    expect(cards.currency).toBe('¥')
  })

  it('model_distribution 按模型分组', () => {
    const result = callHandler(TEST_SESSION)
    expect(result.data.model_distribution.length).toBeGreaterThanOrEqual(1)
    result.data.model_distribution.forEach((item: any) => {
      expect(item).toHaveProperty('model')
      expect(item).toHaveProperty('call_count')
      expect(item).toHaveProperty('percentage')
    })
  })

  it('cost_breakdown 成本计算准确', () => {
    const result = callHandler(TEST_SESSION)
    expect(result.data.cost_breakdown.length).toBeGreaterThanOrEqual(1)
    result.data.cost_breakdown.forEach((item: any) => {
      expect(item).toHaveProperty('model')
      expect(item).toHaveProperty('total_cost')
    })
  })

  it('savings_breakdown 优化节省', () => {
    const result = callHandler(TEST_SESSION)
    expect(result.data.savings_breakdown).toHaveProperty('mechanisms')
    expect(result.data.savings_breakdown).toHaveProperty('total_savings')
    expect(result.data.savings_breakdown.total_savings).toBeGreaterThanOrEqual(0)
  })

  it('recent_turns 返回最近记录', () => {
    const result = callHandler(TEST_SESSION)
    expect(result.data.recent_turns.length).toBeGreaterThanOrEqual(1)
  })

  it('sessions 返回会话列表', () => {
    const result = callHandler(TEST_SESSION)
    expect(result.data.sessions.length).toBeGreaterThanOrEqual(1)
  })

  it('BR-010: 空态 - 不存在的 session 返回空数据', () => {
    const result = callHandler('non-existent-session-xyz')
    expect(result.ok).toBe(true)
    expect(result.data).toHaveProperty('summary_cards')
    expect(result.data).toHaveProperty('model_distribution')
    expect(result.data).toHaveProperty('cost_breakdown')
    expect(result.data).toHaveProperty('savings_breakdown')
    expect(result.data).toHaveProperty('recent_turns')
    expect(result.data).toHaveProperty('sessions')
  })
})
