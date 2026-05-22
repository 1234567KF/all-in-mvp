import type { Context } from 'hono'
import { getDb, schema } from '../../db'
import { eq } from 'drizzle-orm'
import { getTurnSavings } from '../../services/stats-aggregator'

// POST /api/optimizations - Create an optimization record (F-004)
export async function createOptimization(c: Context) {
  const body = await c.req.json()
  if (!body.opt_id) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'opt_id 必填' } }, 400)
  }
  if (!body.session_id) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'session_id 必填' } }, 400)
  }

  const db = getDb()

  // Ensure session exists (auto-create if needed, like turns handler)
  const existing = db.select().from(schema.sessions)
    .where(eq(schema.sessions.id, body.session_id))
    .all()
  if (existing.length === 0) {
    db.insert(schema.sessions).values({ id: body.session_id }).run()
  }

  const mechanisms = typeof body.mechanisms === 'object' ? JSON.stringify(body.mechanisms) : body.mechanisms
  const savedTotal = typeof body.mechanisms === 'object'
    ? Object.values(body.mechanisms).reduce((s: number, v: any) => s + (typeof v === 'number' ? v : 0), 0)
    : 0

  db.insert(schema.optimizations).values({
    optId: body.opt_id,
    sessionId: body.session_id,
    timestamp: body.timestamp || new Date().toISOString(),
    modelSwitched: body.model_switched || false,
    mechanisms,
    savedTotal,
  }).run()

  return c.json({
    ok: true,
    data: { opt_id: body.opt_id, saved_total: savedTotal }
  })
}

// GET /api/optimizations - List optimization records
export function listOptimizations(c: Context) {
  const db = getDb()
  const sessionId = c.req.query('session_id')

  const conditions = sessionId ? eq(schema.optimizations.sessionId, sessionId) : undefined
  const items = db.select()
    .from(schema.optimizations)
    .where(conditions)
    .all()

  return c.json({
    ok: true,
    data: {
      items: items.map(o => ({
        opt_id: o.optId,
        session_id: o.sessionId,
        timestamp: o.timestamp,
        model_switched: o.modelSwitched,
        mechanisms: JSON.parse(o.mechanisms || '{}'),
        saved_total: o.savedTotal,
      }))
    }
  })
}

// GET /api/optimizations/summary - Optimization savings summary
export function getOptimizationSummary(c: Context) {
  const sessionId = c.req.query('session_id')
  const savings = getTurnSavings(sessionId || undefined)
  return c.json({ ok: true, data: savings })
}
