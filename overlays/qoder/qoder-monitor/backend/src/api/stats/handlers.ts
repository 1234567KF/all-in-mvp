import type { Context } from 'hono'
import { getTurnStats, getTurnCost, getTurnSavings, getModelDistribution } from '../../services/stats-aggregator'
import { getDb, schema } from '../../db'
import { eq } from 'drizzle-orm'

// GET /api/turns/stats - Token statistics (F-007)
export function getTurnStatsHandler(c: Context) {
  const sessionId = c.req.query('session_id')
  const stats = getTurnStats(sessionId || undefined)
  return c.json({ ok: true, data: stats })
}

// GET /api/turns/cost - Cost estimation (F-008)
export function getTurnCostHandler(c: Context) {
  const sessionId = c.req.query('session_id')
  const cost = getTurnCost(sessionId || undefined)
  return c.json({ ok: true, data: cost })
}

// GET /api/turns/savings - Optimization savings (F-009)
export function getTurnSavingsHandler(c: Context) {
  const sessionId = c.req.query('session_id')
  const savings = getTurnSavings(sessionId || undefined)
  return c.json({ ok: true, data: savings })
}

// GET /api/turns/model-distribution - Model distribution
export function getModelDistributionHandler(c: Context) {
  const sessionId = c.req.query('session_id')
  const distribution = getModelDistribution(sessionId || undefined)
  return c.json({ ok: true, data: { items: distribution } })
}

// GET /api/pricing/:modelId - Get pricing for a model
export function getPricingHandler(c: Context) {
  const modelId = c.req.param('modelId')
  if (!modelId) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '缺少模型 ID' } }, 400)
  }
  const db = getDb()
  const pricing = db.select().from(schema.pricing).where(eq(schema.pricing.modelId, modelId)).all()[0]
  if (!pricing) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '模型定价不存在' } }, 404)
  }
  return c.json({
    ok: true,
    data: {
      model_id: pricing.modelId,
      short: pricing.short,
      name: pricing.name,
      input_per_mtok: pricing.inputPerMtok,
      output_per_mtok: pricing.outputPerMtok,
      cache_read_per_mtok: pricing.cacheReadPerMtok,
      note: pricing.note,
      currency: pricing.currency,
    }
  })
}

// GET /api/pricing - List all pricing
export function listPricingHandler(c: Context) {
  const db = getDb()
  const items = db.select().from(schema.pricing).all()
  return c.json({
    ok: true,
    data: {
      items: items.map(p => ({
        model_id: p.modelId,
        short: p.short,
        name: p.name,
        input_per_mtok: p.inputPerMtok,
        output_per_mtok: p.outputPerMtok,
        cache_read_per_mtok: p.cacheReadPerMtok,
        note: p.note,
        currency: p.currency,
      }))
    }
  })
}

// PUT /api/pricing/:modelId - Update pricing for a model
export function updatePricingHandler(c: Context) {
  const modelId = c.req.param('modelId')
  if (!modelId) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '缺少模型 ID' } }, 400)
  }
  const db = getDb()
  const existing = db.select().from(schema.pricing).where(eq(schema.pricing.modelId, modelId)).all()[0]
  if (!existing) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '模型定价不存在' } }, 404)
  }
  return c.req.json().then((body: any) => {
    db.update(schema.pricing)
      .set({
        ...(body.input_per_mtok != null ? { inputPerMtok: body.input_per_mtok } : {}),
        ...(body.output_per_mtok != null ? { outputPerMtok: body.output_per_mtok } : {}),
        ...(body.cache_read_per_mtok != null ? { cacheReadPerMtok: body.cache_read_per_mtok } : {}),
        ...(body.note != null ? { note: body.note } : {}),
      })
      .where(eq(schema.pricing.modelId, modelId))
      .run()
    return c.json({ ok: true, data: { model_id: modelId } })
  })
}

// Re-export with handler names for clarity
export { getTurnStatsHandler as getTurnStats }
export { getTurnCostHandler as getTurnCost }
export { getTurnSavingsHandler as getTurnSavings }
export { getModelDistributionHandler as getModelDistribution }
