import type { Context } from 'hono'
import { getDb, schema } from '../../db'
import { eq, desc } from 'drizzle-orm'

// GET /api/sessions - List all sessions
export function listSessions(c: Context) {
  const db = getDb()
  const items = db.select({
    id: schema.sessions.id,
    turnCount: schema.sessions.turnCount,
    a2aCount: schema.sessions.a2aCount,
    created: schema.sessions.created,
    lastActivity: schema.sessions.lastActivity,
  })
    .from(schema.sessions)
    .orderBy(desc(schema.sessions.lastActivity))
    .all()

  return c.json({ ok: true, data: { items, total: items.length } })
}

// GET /api/sessions/:id - Get session by ID
export function getSessionById(c: Context) {
  const id = c.req.param('id')
  if (!id) {
    return c.json({ ok: false, error: { code: 'INVALID_PARAM', message: '缺少会话 ID' } }, 400)
  }

  const db = getDb()
  const session = db.select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, id))
    .all()[0]

  if (!session) {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: '会话不存在' } }, 404)
  }

  return c.json({ ok: true, data: session })
}
