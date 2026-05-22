import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb, schema } from './index'
import { eq } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'

describe('M01: db-core', () => {
  beforeAll(() => {
    // Ensure DB is initialized
    const dbDir = path.resolve(process.cwd(), 'data')
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
  })

  afterAll(() => {
    closeDb()
  })

  it('should have all 6 tables defined in schema', () => {
    expect(schema.sessions).toBeDefined()
    expect(schema.turns).toBeDefined()
    expect(schema.optimizations).toBeDefined()
    expect(schema.pricing).toBeDefined()
    expect(schema.mechanisms).toBeDefined()
    expect(schema.timers).toBeDefined()
  })

  it('should connect and execute a query', () => {
    const db = getDb()
    const result = db.select().from(schema.mechanisms).all()
    expect(result.length).toBe(7)
    expect(result[0].id).toBe('lean_ctx')
    expect(result[0].measurable).toBe(true)
  })

  it('should have 7 pricing records', () => {
    const db = getDb()
    const result = db.select().from(schema.pricing).all()
    expect(result.length).toBe(7)
    const deepseek = result.find(r => r.modelId === 'deepseek-v4-pro')
    expect(deepseek).toBeDefined()
    expect(deepseek!.inputPerMtok).toBe(3.13)
    expect(deepseek!.currency).toBe('¥')
  })

  it('should allow session CRUD', () => {
    const db = getDb()
    const id = `test-session-${Date.now()}`

    // Insert
    db.insert(schema.sessions).values({ id }).run()
    let result = db.select().from(schema.sessions).where(
      eq(schema.sessions.id, id)
    ).all()
    expect(result.length).toBe(1)
    expect(result[0].turnCount).toBe(0)

    // Delete
    db.delete(schema.sessions).where(
      eq(schema.sessions.id, id)
    ).run()
    result = db.select().from(schema.sessions).where(
      eq(schema.sessions.id, id)
    ).all()
    expect(result.length).toBe(0)
  })
})
