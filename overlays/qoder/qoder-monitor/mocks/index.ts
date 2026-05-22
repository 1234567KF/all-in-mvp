import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()
app.use('*', cors())
app.use('*', logger())

// ============================================================
// Mock Data
// ============================================================
const mockSessions = [
  { id: 'session-001', created: '2026-05-22T08:00:00.000Z', last_activity: '2026-05-22T10:30:00.000Z', turn_count: 25, a2a_count: 5, total_input_uncached: 1500000, total_input_cached: 500000, total_output: 400000, estimated_cost: 3.245 },
  { id: 'session-002', created: '2026-05-21T14:00:00.000Z', last_activity: '2026-05-21T16:45:00.000Z', turn_count: 18, a2a_count: 3, total_input_uncached: 900000, total_input_cached: 300000, total_output: 250000, estimated_cost: 2.108 },
]

const mockTurns = Array.from({ length: 10 }, (_, i) => ({
  id: `turn-${String(i + 1).padStart(3, '0')}`,
  session_id: i < 5 ? 'session-001' : 'session-002',
  type: i % 3 === 2 ? 'a2a' as const : 'turn' as const,
  parent_turn_id: null,
  phase: i < 3 ? 'Phase 1' : i < 6 ? 'Phase 2' : 'Phase 3',
  timestamp: new Date(Date.now() - i * 60000).toISOString(),
  role: i % 2 === 0 ? 'human' as const : 'ai' as const,
  from_agent: i % 3 === 2 ? 'coordinator' : null,
  to_agent: i % 3 === 2 ? 'backend-1' : null,
  skill: i % 3 === 2 ? 'kf-mvp-backend-tdd' : null,
  model_used: i < 4 ? 'deepseek-v4-pro' : 'deepseek-v4-flash',
  protocol: i % 3 === 2 ? 'native' as const : null,
  input_uncached: Math.floor(Math.random() * 50000),
  input_cached: Math.floor(Math.random() * 20000),
  output_tokens: Math.floor(Math.random() * 10000),
  latency_ms: Math.floor(Math.random() * 5000),
  message_size_bytes: Math.floor(Math.random() * 5000),
  opt_id: null,
  note: null,
  data_source: 'hook' as const,
}))

const mockOptimizations = [
  { opt_id: 'opt-001', session_id: 'session-001', timestamp: '2026-05-22T08:30:00.000Z', model_switched: false, mechanisms: JSON.stringify({ lean_ctx: 10000, l1_cache: 5000 }), saved_total: 15000 },
  { opt_id: 'opt-002', session_id: 'session-001', timestamp: '2026-05-22T09:00:00.000Z', model_switched: true, mechanisms: JSON.stringify({ model_switch: 8000 }), saved_total: 0 },
]

const mockPricing = [
  { model_id: 'deepseek-v4-pro', short: 'V4-Pro', name: 'DeepSeek V4-Pro', input_per_mtok: 3.13, output_per_mtok: 6.26, cache_read_per_mtok: 0.026, note: 'DeepSeek 旗舰模型', currency: '¥' },
  { model_id: 'deepseek-v4-flash', short: 'V4-Flash', name: 'DeepSeek V4-Flash', input_per_mtok: 1.01, output_per_mtok: 2.02, cache_read_per_mtok: 0.020, note: 'DeepSeek 快速模型', currency: '¥' },
  { model_id: 'claude-sonnet-4', short: 'Sonnet 4', name: 'Claude Sonnet 4', input_per_mtok: 21.60, output_per_mtok: 108.00, cache_read_per_mtok: 2.70, note: 'Anthropic Claude', currency: '¥' },
]

const mockTimers = [
  { tool_call_id: 'timer-001', tool_name: 'read_file', start_time: 1747891200000, session_id: 'session-001', latency_ms: 450 },
  { tool_call_id: 'timer-002', tool_name: 'search_codebase', start_time: 1747891205000, session_id: 'session-001', latency_ms: 1200 },
]

// ============================================================
// Turns API
// ============================================================
app.post('/api/turns', (c) => c.json({ ok: true, data: { id: `turn-${Date.now()}`, session_id: 'session-001' } }))

app.get('/api/turns', (c) => {
  const sessionId = c.req.query('session_id')
  const type = c.req.query('type')
  const model = c.req.query('model')
  const page = parseInt(c.req.query('page') || '1')
  const pageSize = parseInt(c.req.query('page_size') || '50')

  let items = mockTurns
  if (sessionId) items = items.filter(t => t.session_id === sessionId)
  if (type) items = items.filter(t => t.type === type)
  if (model) items = items.filter(t => t.model_used === model)

  const start = (page - 1) * pageSize
  return c.json({ ok: true, data: { items: items.slice(start, start + pageSize), total: items.length, page, page_size: pageSize } })
})

app.get('/api/turns/stats', (c) => {
  const sessionId = c.req.query('session_id')
  const turns = sessionId ? mockTurns.filter(t => t.session_id === sessionId) : mockTurns
  const totalInputUncached = turns.reduce((s, t) => s + t.input_uncached, 0)
  const totalInputCached = turns.reduce((s, t) => s + t.input_cached, 0)
  const totalInput = totalInputUncached + totalInputCached
  return c.json({
    ok: true, data: {
      total_calls: turns.length,
      total_input_tokens: totalInput,
      total_input_uncached: totalInputUncached,
      total_input_cached: totalInputCached,
      cache_hit_rate: totalInput > 0 ? (totalInputCached / totalInput) * 100 : 0,
      total_output_tokens: turns.reduce((s, t) => s + t.output_tokens, 0),
      model_switch_count: mockOptimizations.filter(o => o.model_switched).length,
      model_count: new Set(turns.map(t => t.model_used)).size,
    }
  })
})

app.get('/api/turns/cost', (c) => {
  const sessionId = c.req.query('session_id')
  const turns = sessionId ? mockTurns.filter(t => t.session_id === sessionId) : mockTurns
  const modelGroups: Record<string, { model: string; call_count: number; input_uncached: number; input_cached: number; output_tokens: number }> = {}
  turns.forEach(t => {
    const m = t.model_used || 'unknown'
    if (!modelGroups[m]) modelGroups[m] = { model: m, call_count: 0, input_uncached: 0, input_cached: 0, output_tokens: 0 }
    modelGroups[m].call_count++
    modelGroups[m].input_uncached += t.input_uncached
    modelGroups[m].input_cached += t.input_cached
    modelGroups[m].output_tokens += t.output_tokens
  })

  const items = Object.values(modelGroups).map(g => {
    const pricing = mockPricing.find(p => p.model_id === g.model)
    const hasPricing = !!pricing
    const p = pricing || { input_per_mtok: 0, output_per_mtok: 0, cache_read_per_mtok: 0, currency: '¥' }
    const inputCost = (g.input_uncached / 1000000 * p.input_per_mtok) + (g.input_cached / 1000000 * p.cache_read_per_mtok)
    const outputCost = (g.output_tokens / 1000000 * p.output_per_mtok)
    return { ...g, input_cost: Math.round(inputCost * 10000) / 10000, output_cost: Math.round(outputCost * 10000) / 10000, total_cost: Math.round((inputCost + outputCost) * 10000) / 10000, currency: p.currency, has_pricing: hasPricing }
  })
  return c.json({ ok: true, data: { items, total_cost: items.reduce((s, i) => s + i.total_cost, 0), currency: '¥' } })
})

app.get('/api/turns/savings', (c) => {
  const savings = { lean_ctx: 10000, l1_cache: 5000, l2_warmup: 0, l3_skill_stub: 0, ccp_skip: 0, lambda_lang: 0 }
  const total = Object.values(savings).reduce((s, v) => s + v, 0)
  const percentages: Record<string, number> = {}
  Object.entries(savings).forEach(([k, v]) => { percentages[k] = total > 0 ? Math.round(v / total * 10000) / 100 : 0 })
  return c.json({ ok: true, data: { mechanisms: savings, total_savings: total, model_switch_savings: 8000, percentages } })
})

app.get('/api/turns/model-distribution', (c) => {
  const groups: Record<string, number> = {}
  mockTurns.forEach(t => {
    const m = t.model_used || 'unknown'
    groups[m] = (groups[m] || 0) + 1
  })
  const total = Object.values(groups).reduce((s, v) => s + v, 0)
  return c.json({
    ok: true, data: {
      items: Object.entries(groups).map(([model, count]) => ({ model, call_count: count, percentage: Math.round(count / total * 10000) / 100 }))
    }
  })
})

app.get('/api/turns/:id', (c) => {
  const turn = mockTurns.find(t => t.id === c.req.param('id'))
  if (!turn) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '轮次不存在' } }, 404)
  return c.json({ ok: true, data: { ...turn, estimated_cost: 0.015, savings: null } })
})

// ============================================================
// Sessions API
// ============================================================
app.get('/api/sessions', (c) => c.json({ ok: true, data: { items: mockSessions } }))

app.get('/api/sessions/:id', (c) => {
  const session = mockSessions.find(s => s.id === c.req.param('id'))
  if (!session) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '会话不存在' } }, 404)
  return c.json({ ok: true, data: session })
})

app.get('/api/sessions/:id/stats', (c) => {
  const session = mockSessions.find(s => s.id === c.req.param('id'))
  if (!session) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '会话不存在' } }, 404)
  return c.json({
    ok: true, data: {
      turn_stats: { total_calls: session.turn_count + session.a2a_count, total_input_tokens: session.total_input_uncached + session.total_input_cached, total_input_uncached: session.total_input_uncached, total_input_cached: session.total_input_cached, cache_hit_rate: session.total_input_uncached + session.total_input_cached > 0 ? (session.total_input_cached / (session.total_input_uncached + session.total_input_cached)) * 100 : 0, total_output_tokens: session.total_output, model_switch_count: 1, model_count: 2 },
      cost: { items: [{ model: 'deepseek-v4-pro', call_count: session.turn_count, input_uncached: session.total_input_uncached, input_cached: session.total_input_cached, output_tokens: session.total_output, input_cost: 2.143, output_cost: 1.102, total_cost: session.estimated_cost, currency: '¥', has_pricing: true }], total_cost: session.estimated_cost, currency: '¥' },
      savings: { mechanisms: { lean_ctx: 10000, l1_cache: 5000, l2_warmup: 0, l3_skill_stub: 0, ccp_skip: 0, lambda_lang: 0 }, total_savings: 15000, model_switch_savings: 8000, percentages: { lean_ctx: 66.67, l1_cache: 33.33, l2_warmup: 0, l3_skill_stub: 0, ccp_skip: 0, lambda_lang: 0 } },
      model_distribution: { items: [{ model: 'deepseek-v4-pro', call_count: session.turn_count, percentage: 60 }, { model: 'deepseek-v4-flash', call_count: Math.floor(session.turn_count * 0.6), percentage: 40 }] },
    }
  })
})

// ============================================================
// Optimizations API
// ============================================================
app.post('/api/optimizations', async (c) => {
  const body = await c.req.json()
  return c.json({ ok: true, data: { opt_id: body.opt_id || `opt-${Date.now()}`, saved_total: 15000 } })
})

app.get('/api/optimizations', (c) => {
  const sessionId = c.req.query('session_id')
  const items = sessionId ? mockOptimizations.filter(o => o.session_id === sessionId) : mockOptimizations
  return c.json({ ok: true, data: { items } })
})

app.get('/api/optimizations/summary', (c) => {
  return c.json({
    ok: true, data: {
      mechanisms: { lean_ctx: 10000, l1_cache: 5000, l2_warmup: 0, l3_skill_stub: 0, ccp_skip: 0, lambda_lang: 0 },
      total_savings: 15000,
      model_switch_count: 1,
      model_switch_savings: 8000,
      percentages: { lean_ctx: 66.67, l1_cache: 33.33, l2_warmup: 0, l3_skill_stub: 0, ccp_skip: 0, lambda_lang: 0 },
    }
  })
})

// ============================================================
// Pricing API
// ============================================================
app.get('/api/pricing', (c) => c.json({ ok: true, data: { items: mockPricing } }))

app.get('/api/pricing/:modelId', (c) => {
  const p = mockPricing.find(p => p.model_id === c.req.param('modelId'))
  if (!p) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '模型定价不存在' } }, 404)
  return c.json({ ok: true, data: p })
})

app.put('/api/pricing/:modelId', async (c) => {
  const existing = mockPricing.find(p => p.model_id === c.req.param('modelId'))
  if (!existing) return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '模型定价不存在' } }, 404)
  const body = await c.req.json()
  return c.json({ ok: true, data: { ...existing, ...body } })
})

// ============================================================
// Timers API
// ============================================================
app.post('/api/timers', async (c) => {
  const body = await c.req.json()
  return c.json({ ok: true, data: { tool_call_id: body.tool_call_id } })
})

app.get('/api/timers', (c) => {
  const sessionId = c.req.query('session_id')
  const items = sessionId ? mockTimers.filter(t => t.session_id === sessionId) : mockTimers
  return c.json({ ok: true, data: { items } })
})

// ============================================================
// System API
// ============================================================
app.delete('/api/data', (c) => c.json({
  ok: true, data: { message: '所有数据已清空', cleared_tables: ['turns', 'optimizations', 'sessions', 'timers'] }
}))

app.get('/api/health', (c) => c.json({
  ok: true, data: { status: 'healthy', timestamp: new Date().toISOString(), db_connected: true, db_size: 245760, turn_count: mockTurns.length }
}))

// ============================================================
// Dashboard API
// ============================================================
app.get('/api/dashboard/summary', (c) => {
  const sessionId = c.req.query('session_id')
  const turns = sessionId ? mockTurns.filter(t => t.session_id === sessionId) : mockTurns
  const sessions = sessionId ? mockSessions.filter(s => s.id === sessionId) : mockSessions
  const totalInputUncached = turns.reduce((s, t) => s + t.input_uncached, 0)
  const totalInputCached = turns.reduce((s, t) => s + t.input_cached, 0)
  const totalInput = totalInputUncached + totalInputCached

  if (turns.length === 0) {
    return c.json({
      ok: true, data: {
        summary_cards: { total_calls: 0, total_input_tokens: 0, cache_hit_rate: 0, total_output_tokens: 0, model_switch_count: 0, model_count: 0, estimated_cost: 0, total_savings: 0, currency: '¥' },
        model_distribution: [], cost_breakdown: [], savings_breakdown: { mechanisms: {}, total_savings: 0 }, recent_turns: [], sessions: []
      }
    })
  }

  return c.json({
    ok: true, data: {
      summary_cards: {
        total_calls: turns.length,
        total_input_tokens: totalInput,
        cache_hit_rate: totalInput > 0 ? Math.round(totalInputCached / totalInput * 10000) / 100 : 0,
        total_output_tokens: turns.reduce((s, t) => s + t.output_tokens, 0),
        model_switch_count: mockOptimizations.filter(o => o.model_switched).length,
        model_count: new Set(turns.map(t => t.model_used)).size,
        estimated_cost: 3.245, total_savings: 15000, currency: '¥'
      },
      model_distribution: [{ model: 'deepseek-v4-pro', call_count: 4, percentage: 40 }, { model: 'deepseek-v4-flash', call_count: 6, percentage: 60 }],
      cost_breakdown: [{ model: 'deepseek-v4-pro', call_count: 4, input_cost: 2.143, output_cost: 1.102, total_cost: 3.245 }],
      savings_breakdown: { mechanisms: { lean_ctx: 10000, l1_cache: 5000, l2_warmup: 0, l3_skill_stub: 0, ccp_skip: 0, lambda_lang: 0 }, total_savings: 15000 },
      recent_turns: turns.slice(0, 50),
      sessions: sessions.map(s => ({ id: s.id, turn_count: s.turn_count, a2a_count: s.a2a_count, created: s.created, last_activity: s.last_activity }))
    }
  })
})

// ============================================================
// Start Server
// ============================================================
const port = parseInt(process.env.MOCK_PORT || '3457')
console.log(`[mock-server] starting on http://localhost:${port}`)

export default { port, fetch: app.fetch }

// 单独运行时启动服务
if (require.main === module) {
  const { serve } = require('@hono/node-server')
  serve({ fetch: app.fetch, port }, (info: any) => {
    console.log(`[mock-server] listening on http://localhost:${info.port}`)
  })
}
