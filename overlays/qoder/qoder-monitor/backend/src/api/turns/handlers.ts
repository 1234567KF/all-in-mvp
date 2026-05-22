import type { Context } from 'hono'
import { getDb, schema } from '../../db'
import { eq, desc, and, like, or, sql } from 'drizzle-orm'

// POST /api/turns - Create a turn record (F-001, F-002, F-003)
export async function createTurn(c: Context) {
  const db = getDb()
  const body = await c.req.json()

  // Validate required fields
  if (!body.session_id || typeof body.session_id !== 'string' || body.session_id.length < 5 || body.session_id.length > 100) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'session_id 必须为 5-100 字符' } }, 400)
  }
  if (!body.type || !['turn', 'a2a'].includes(body.type)) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'type 必须为 turn 或 a2a' } }, 400)
  }
  if (!body.timestamp) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'timestamp 必填' } }, 400)
  }

  // Validate ISO 8601 timestamp
  const ts = new Date(body.timestamp)
  if (isNaN(ts.getTime())) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'timestamp 必须为有效的 ISO 8601 格式' } }, 400)
  }

  // BR-002: Empty message - skip
  if (body.message === '' || (body.message && body.message.trim() === '')) {
    return c.json({ ok: true, data: { skipped: true, reason: '空消息不记录' } })
  }

  // BR-001: Dedup - same session, same role (human), within 30 seconds
  if (body.role === 'human' || !body.role) {
    const recentHuman = db.select()
      .from(schema.turns)
      .where(
        and(
          eq(schema.turns.sessionId, body.session_id),
          eq(schema.turns.type, body.type as 'turn' | 'a2a'),
          eq(schema.turns.role, 'human'),
          sql`${schema.turns.timestamp} > datetime('now', '-30 seconds')`
        )
      )
      .all()

    if (recentHuman.length > 0) {
      return c.json({ ok: true, data: { skipped: true, reason: '30 秒内重复用户输入，已跳过' } })
    }
  }

  // BR-004: Dedup - same session, AI reply within 3 seconds
  if (body.role === 'ai') {
    const recentAi = db.select()
      .from(schema.turns)
      .where(
        and(
          eq(schema.turns.sessionId, body.session_id),
          eq(schema.turns.role, 'ai'),
          sql`${schema.turns.timestamp} > datetime('now', '-3 seconds')`
        )
      )
      .all()

    if (recentAi.length > 0) {
      return c.json({ ok: true, data: { skipped: true, reason: '3 秒内重复 AI 回复，已跳过' } })
    }
  }

  // EB-003: Fix negative token values
  const inputUncached = Math.max(0, body.input_uncached || 0)
  let inputCached = Math.max(0, body.input_cached || 0)
  const outputTokens = Math.max(0, body.output_tokens || 0)

  // EB-004: If cached > total, adjust
  if (inputCached > inputUncached + inputCached) {
    // This shouldn't happen but handle defensively
    inputCached = Math.min(inputCached, inputUncached + inputCached)
  }

  // BR-003: Default model
  const modelUsed = body.model_used || 'deepseek-v4-flash'

  // Validate A2A fields
  if (body.type === 'a2a') {
    if (!body.from_agent || !body.to_agent) {
      return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: 'a2a 类型必须包含 from_agent 和 to_agent' } }, 400)
    }
  }

  // Ensure session exists
  const existingSession = db.select().from(schema.sessions)
    .where(eq(schema.sessions.id, body.session_id))
    .all()

  if (existingSession.length === 0) {
    db.insert(schema.sessions).values({
      id: body.session_id,
      created: body.timestamp,
      lastActivity: body.timestamp,
    }).run()
  }

  // Generate turn ID
  const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // Determine turn type
  const isA2A = body.type === 'a2a'

  // Insert turn
  db.insert(schema.turns).values({
    id: turnId,
    sessionId: body.session_id,
    type: isA2A ? 'a2a' : 'turn',
    phase: body.phase || null,
    timestamp: body.timestamp,
    role: body.role || 'human',
    fromAgent: body.from_agent || null,
    toAgent: body.to_agent || null,
    skill: body.skill || null,
    modelUsed,
    protocol: body.protocol || null,
    inputUncached,
    inputCached,
    outputTokens,
    latencyMs: body.latency_ms || null,
    messageSizeBytes: body.message_size_bytes || null,
    optId: body.opt_id || null,
    note: body.note || null,
    dataSource: body.data_source || 'hook',
  }).run()

  // Update session aggregates
  db.update(schema.sessions)
    .set({
      turnCount: sql`turn_count + 1`,
      a2aCount: isA2A ? sql`a2a_count + 1` : sql`a2a_count`,
      lastActivity: body.timestamp,
      totalInputUncached: sql`total_input_uncached + ${inputUncached}`,
      totalInputCached: sql`total_input_cached + ${inputCached}`,
      totalOutput: sql`total_output + ${outputTokens}`,
    })
    .where(eq(schema.sessions.id, body.session_id))
    .run()

  return c.json({ ok: true, data: { id: turnId, session_id: body.session_id } })
}

// GET /api/turns - List turns with filters
export async function getTurns(c: Context) {
  const db = getDb()
  const sessionId = c.req.query('session_id')
  const type = c.req.query('type')
  const model = c.req.query('model')
  const phase = c.req.query('phase')
  const keyword = c.req.query('keyword')
  const page = parseInt(c.req.query('page') || '1')
  const pageSize = parseInt(c.req.query('page_size') || '50')

  const conditions = []

  if (sessionId) conditions.push(eq(schema.turns.sessionId, sessionId))
  if (type) conditions.push(eq(schema.turns.type, type as 'turn' | 'a2a'))
  if (model) conditions.push(eq(schema.turns.modelUsed, model))
  if (phase) conditions.push(eq(schema.turns.phase, phase))
  if (keyword) conditions.push(like(schema.turns.note, `%${keyword}%`))

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const offset = (page - 1) * pageSize

  const items = db.select()
    .from(schema.turns)
    .where(where)
    .orderBy(desc(schema.turns.timestamp))
    .limit(pageSize)
    .offset(offset)
    .all()

  const total = db.select({ count: sql<number>`count(*)` })
    .from(schema.turns)
    .where(where)
    .all()[0].count

  return c.json({
    ok: true,
    data: { items, total, page, page_size: pageSize }
  })
}

// GET /api/turns/:id - Get single turn
export async function getTurnById(c: Context) {
  const db = getDb()
  const id = c.req.param('id')

  if (!id) {
    return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '缺少轮次 ID' } }, 400)
  }

  const turn = db.select()
    .from(schema.turns)
    .where(eq(schema.turns.id, id))
    .all()

  if (turn.length === 0) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '轮次不存在' } }, 404)
  }

  return c.json({ ok: true, data: turn[0] })
}
