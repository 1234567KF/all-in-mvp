import type { Context } from 'hono'
import { getDb, schema } from '../../db'
import { desc, eq, sql } from 'drizzle-orm'
import { getTurnStats, getTurnCost, getTurnSavings, getModelDistribution } from '../../services/stats-aggregator'

// GET /api/dashboard/summary - Real-time dashboard summary (F-005)
export function getDashboardSummary(c: Context) {
  const sessionId = c.req.query('session_id') || undefined
  const db = getDb()

  // Get stats from M03 services
  const stats = getTurnStats(sessionId)
  const cost = getTurnCost(sessionId)
  const savings = getTurnSavings(sessionId)
  const distribution = getModelDistribution(sessionId)

  // Get recent turns (last 50)
  const turnConditions = sessionId ? eq(schema.turns.sessionId, sessionId) : sql`1=1`
  const recentTurns = db.select()
    .from(schema.turns)
    .where(turnConditions)
    .orderBy(desc(schema.turns.timestamp))
    .limit(50)
    .all()

  // Enrich turns with cost and savings
  const allPricing = db.select().from(schema.pricing).all()
  const allOpts = db.select().from(schema.optimizations).all()
  const enrichedTurns = recentTurns.map(t => {
    const pricing = allPricing.find(p => p.modelId === t.modelUsed)
    const inputPrice = pricing?.inputPerMtok ?? 0
    const outputPrice = pricing?.outputPerMtok ?? 0
    const cachePrice = pricing?.cacheReadPerMtok ?? inputPrice
    const inputCost = ((t.inputUncached ?? 0) / 1000000 * inputPrice) + ((t.inputCached ?? 0) / 1000000 * cachePrice)
    const outputCost = ((t.outputTokens ?? 0) / 1000000 * outputPrice)
    const estimatedCost = Math.round((inputCost + outputCost) * 10000) / 10000

    // Look up savings by opt_id
    let savings = 0
    if (t.optId) {
      const opt = allOpts.find(o => o.optId === t.optId)
      if (opt) {
        const mechs = JSON.parse(opt.mechanisms || '{}')
        savings = Object.values(mechs).reduce((s: number, v: any) => s + (typeof v === 'number' ? v : 0), 0)
      }
    }

    return { ...t, estimatedCost, savings }
  })

  // Get sessions
  const sessionConditions = sessionId ? eq(schema.sessions.id, sessionId) : sql`1=1`
  const sessionsList = db.select({
    id: schema.sessions.id,
    turnCount: schema.sessions.turnCount,
    a2aCount: schema.sessions.a2aCount,
    created: schema.sessions.created,
    lastActivity: schema.sessions.lastActivity,
  })
    .from(schema.sessions)
    .where(sessionConditions)
    .orderBy(desc(schema.sessions.lastActivity))
    .all()

  // Get estimated cost from sessions (fallback to cost.total_cost)
  const estimatedCost = cost.total_cost > 0 ? cost.total_cost : (sessionId
    ? (db.select({ cost: schema.sessions.estimatedCost })
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .all()[0]?.cost ?? 0)
    : 0)

  // BR-010: Empty state - return zeros and empty arrays
  const isEmpty = stats.total_calls === 0

  return c.json({
    ok: true,
    data: {
      summary_cards: {
        total_calls: stats.total_calls,
        total_input_tokens: stats.total_input_tokens,
        cache_hit_rate: stats.cache_hit_rate,
        total_output_tokens: stats.total_output_tokens,
        model_switch_count: stats.model_switch_count,
        model_count: stats.model_count,
        estimated_cost: estimatedCost,
        total_savings: savings.total_savings,
        currency: '¥',
      },
      model_distribution: isEmpty ? [] : distribution,
      cost_breakdown: isEmpty ? [] : cost.items,
      savings_breakdown: {
        mechanisms: savings.mechanisms,
        total_savings: savings.total_savings,
      },
      recent_turns: isEmpty ? [] : enrichedTurns,
      sessions: isEmpty ? [] : sessionsList,
    }
  })
}
