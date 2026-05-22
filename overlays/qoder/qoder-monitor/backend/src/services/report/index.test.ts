import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getDb, closeDb, schema } from '../../db'
import { eq } from 'drizzle-orm'
import { generateMarkdownReport } from './markdown'
import { generateHtmlDashboard } from './html'

const TEST_SESSION = `test-report-${Date.now()}`

describe('M05: report-gen', () => {
  beforeAll(() => {
    const db = getDb()
    db.insert(schema.sessions).values({
      id: TEST_SESSION,
      created: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      turnCount: 3,
      totalInputUncached: 60000,
      totalInputCached: 20000,
      totalOutput: 15000,
    }).run()

    for (let i = 0; i < 3; i++) {
      db.insert(schema.turns).values({
        id: `rpt-turn-${i}`,
        sessionId: TEST_SESSION,
        type: i === 2 ? 'a2a' : 'turn',
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        role: i % 2 === 0 ? 'human' : 'ai',
        modelUsed: 'deepseek-v4-pro',
        inputUncached: 10000 + i * 1000,
        inputCached: 5000 + i * 500,
        outputTokens: 3000 + i * 200,
      }).run()
    }

    db.insert(schema.optimizations).values({
      optId: `rpt-opt-1`,
      sessionId: TEST_SESSION,
      timestamp: new Date().toISOString(),
      modelSwitched: false,
      mechanisms: JSON.stringify({ lean_ctx: 10000, l1_cache: 5000 }),
      savedTotal: 15000,
    }).run()
  })

  afterAll(() => {
    const db = getDb()
    db.delete(schema.optimizations).where(eq(schema.optimizations.sessionId, TEST_SESSION)).run()
    db.delete(schema.turns).where(eq(schema.turns.sessionId, TEST_SESSION)).run()
    db.delete(schema.sessions).where(eq(schema.sessions.id, TEST_SESSION)).run()
    closeDb()
  })

  it('AC-010: Markdown 报告包含所有 4 个章节', () => {
    const report = generateMarkdownReport({ sessionId: TEST_SESSION })

    expect(report).toContain('Overview')
    expect(report).toContain('Per-Turn Breakdown')
    expect(report).toContain('Token Savings')
    expect(report).toContain('Cost Estimate')
  })

  it('Markdown 报告包含统计数据', () => {
    const report = generateMarkdownReport({ sessionId: TEST_SESSION })

    expect(report).toContain('总调用次数')
    expect(report).toContain('预估成本')
    expect(report).toContain('总节省')
    expect(report).toContain('deepseek-v4-pro')
  })

  it('AC-011: HTML 看板包含核心元素', () => {
    const html = generateHtmlDashboard({ sessionId: TEST_SESSION })

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Qoder Monitor')
    expect(html).toContain('总调用次数')
    expect(html).toContain('modelFilter')
    expect(html).toContain('applyFilters')
  })

  it('HTML 看板包含筛选功能', () => {
    const html = generateHtmlDashboard({ sessionId: TEST_SESSION })

    expect(html).toContain('modelFilter')
    expect(html).toContain('typeFilter')
    expect(html).toContain('keywordFilter')
  })

  it('BR-021: 空态 - 无数据生成空态报告', () => {
    const report = generateMarkdownReport({ sessionId: 'non-existent-session' })
    expect(report).toContain('暂无数据')
  })

  it('BR-021: 空态 - 无数据生成空态 HTML', () => {
    const html = generateHtmlDashboard({ sessionId: 'non-existent-session' })
    expect(html).toContain('暂无数据')
  })
})
