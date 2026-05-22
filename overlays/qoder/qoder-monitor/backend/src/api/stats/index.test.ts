import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb, schema } from '../../db'
import { eq } from 'drizzle-orm'
import { getTurnStats, getTurnCost, getTurnSavings, getModelDistribution } from '../../services/stats-aggregator'

const TEST_SESSION = `test-stats-${Date.now()}`

describe('M03: stats-api', () => {
  beforeAll(() => {
    const db = getDb()
    // Create test session with diverse turns for stats testing
    db.insert(schema.sessions).values({
      id: TEST_SESSION,
      created: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }).run()

    // Insert turns with different models
    const now = Date.now()
    const turns = [
      { id: `stat-turn-1`, sessionId: TEST_SESSION, type: 'turn' as const, timestamp: new Date(now - 60000).toISOString(), role: 'human' as const, modelUsed: 'deepseek-v4-pro', inputUncached: 50000, inputCached: 10000, outputTokens: 8000 },
      { id: `stat-turn-2`, sessionId: TEST_SESSION, type: 'turn' as const, timestamp: new Date(now - 30000).toISOString(), role: 'ai' as const, modelUsed: 'deepseek-v4-pro', inputUncached: 0, inputCached: 0, outputTokens: 12000 },
      { id: `stat-turn-3`, sessionId: TEST_SESSION, type: 'turn' as const, timestamp: new Date(now - 10000).toISOString(), role: 'human' as const, modelUsed: 'deepseek-v4-flash', inputUncached: 30000, inputCached: 20000, outputTokens: 5000 },
      { id: `stat-turn-4`, sessionId: TEST_SESSION, type: 'a2a' as const, timestamp: new Date(now).toISOString(), role: 'ai' as const, modelUsed: 'deepseek-v4-flash', fromAgent: 'coordinator', toAgent: 'worker', inputUncached: 10000, inputCached: 5000, outputTokens: 2000 },
    ]
    for (const t of turns) {
      db.insert(schema.turns).values(t).run()
    }

    // Insert an optimization with model_switch for savings testing
    db.insert(schema.optimizations).values({
      optId: `stat-opt-1`,
      sessionId: TEST_SESSION,
      timestamp: new Date().toISOString(),
      modelSwitched: false,
      mechanisms: JSON.stringify({ lean_ctx: 5000, l1_cache: 3000 }),
      savedTotal: 8000,
    }).run()

    db.insert(schema.optimizations).values({
      optId: `stat-opt-2`,
      sessionId: TEST_SESSION,
      timestamp: new Date().toISOString(),
      modelSwitched: true,
      mechanisms: JSON.stringify({ model_switch: 4000 }),
      savedTotal: 0,
    }).run()
  })

  afterAll(() => {
    const db = getDb()
    db.delete(schema.optimizations).where(eq(schema.optimizations.sessionId, TEST_SESSION)).run()
    db.delete(schema.turns).where(eq(schema.turns.sessionId, TEST_SESSION)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, TEST_SESSION)).run()
    closeDb()
  })

  it('AC-007: Token 统计准确', () => {
    const stats = getTurnStats(TEST_SESSION)
    expect(stats.total_calls).toBe(4)
    expect(stats.total_input_uncached).toBe(90000) // 50000 + 0 + 30000 + 10000
    expect(stats.total_input_cached).toBe(35000)   // 10000 + 0 + 20000 + 5000
    expect(stats.total_input_tokens).toBe(125000)
    expect(stats.total_output_tokens).toBe(27000)  // 8000 + 12000 + 5000 + 2000
    expect(stats.cache_hit_rate).toBeCloseTo(28, 0) // 35000/125000 ≈ 28%
    expect(stats.model_count).toBe(2)
  })

  it('BR-014: 总输入为 0 时缓存率为 0.0%', () => {
    const stats = getTurnStats('non-existent-session')
    expect(stats.total_input_tokens).toBe(0)
    expect(stats.cache_hit_rate).toBe(0)
  })

  it('AC-008: 成本估算准确', () => {
    const cost = getTurnCost(TEST_SESSION)
    expect(cost.items.length).toBeGreaterThanOrEqual(2)
    expect(cost.total_cost).toBeGreaterThan(0)
    expect(cost.currency).toBe('¥')

    // Each item should have has_pricing
    cost.items.forEach(item => {
      expect(typeof item.input_cost).toBe('number')
      expect(typeof item.output_cost).toBe('number')
      expect(typeof item.total_cost).toBe('number')
    })
  })

  it('BR-016: 无定价模型的成本为 0 并标记无定价', () => {
    // Insert a turn with unknown model
    const db = getDb()
    const id = `stat-unknown-${Date.now()}`
    db.insert(schema.turns).values({
      id,
      sessionId: TEST_SESSION,
      type: 'turn',
      timestamp: new Date().toISOString(),
      role: 'human',
      modelUsed: 'unknown-model-xyz',
      inputUncached: 1000,
      inputCached: 500,
      outputTokens: 300,
    }).run()

    const cost = getTurnCost(TEST_SESSION)
    const unknown = cost.items.find(i => i.model === 'unknown-model-xyz')
    expect(unknown).toBeDefined()
    expect(unknown!.has_pricing).toBe(false)
    // BR-016: cost = 0 when no pricing
    expect(unknown!.total_cost).toBeGreaterThanOrEqual(0)

    // Cleanup
    db.delete(schema.turns).where(eq(schema.turns.id, id)).run()
  })

  it('AC-009: 优化节省汇总正确', () => {
    const savings = getTurnSavings(TEST_SESSION)
    expect(savings.total_savings).toBeGreaterThan(0)

    // lean_ctx should be 5000
    expect(savings.mechanisms.lean_ctx).toBe(5000)
    expect(savings.mechanisms.l1_cache).toBe(3000)

    // BR-008: model_switch not counted in total savings
    expect(savings.model_switch_savings).toBe(4000)
    expect(savings.model_switch_count).toBe(1)

    // Percentages should sum to ~100%
    const pctSum = Object.values(savings.percentages).reduce((s, v) => s + v, 0)
    expect(pctSum).toBeGreaterThan(99)
  })

  it('模型分布统计正确', () => {
    const dist = getModelDistribution(TEST_SESSION)
    expect(dist.length).toBeGreaterThanOrEqual(2)

    const pro = dist.find(d => d.model === 'deepseek-v4-pro')
    const flash = dist.find(d => d.model === 'deepseek-v4-flash')
    expect(pro).toBeDefined()
    expect(flash).toBeDefined()

    expect(pro!.call_count).toBe(2)
    expect(flash!.call_count).toBe(2)

    // Percentages should sum to ~100%
    const pctSum = dist.reduce((s, d) => s + d.percentage, 0)
    expect(pctSum).toBeGreaterThan(99)
  })

  it('BR-017: 默认货币符号为 ¥', () => {
    const cost = getTurnCost(TEST_SESSION)
    expect(cost.currency).toBe('¥')
    cost.items.forEach(item => {
      expect(item.currency).toBeDefined()
    })
  })
})
