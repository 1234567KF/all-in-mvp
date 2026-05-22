// ============================================================
// Optimizations API 集成测试
// 覆盖: F-004 (优化记录), F-009 (优化节省汇总)
// ============================================================
import { describe, it, expect } from 'vitest'

const BASE_URL = 'http://localhost:3456'

describe('Optimizations API - F-004/F-009', () => {
  // ========== Happy Path ==========

  it('AC-004: POST /api/optimizations 创建优化节省记录成功', async () => {
    const res = await fetch(`${BASE_URL}/api/optimizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opt_id: 'test-opt-001',
        session_id: 'session-001',
        timestamp: new Date().toISOString(),
        mechanisms: { lean_ctx: 10000, l1_cache: 5000 },
        turn_ids: ['turn-001'],
      }),
    })
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.opt_id).toBe('test-opt-001')
    expect(typeof body.data.saved_total).toBe('number')
  })

  it('GET /api/optimizations 返回优化记录列表', async () => {
    const res = await fetch(`${BASE_URL}/api/optimizations`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data.items)).toBe(true)
  })

  it('GET /api/optimizations 支持 session_id 筛选', async () => {
    const res = await fetch(`${BASE_URL}/api/optimizations?session_id=session-001`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    body.data.items.forEach((item: any) => expect(item.session_id).toBe('session-001'))
  })

  it('GET /api/optimizations/summary 返回优化节省汇总', async () => {
    const res = await fetch(`${BASE_URL}/api/optimizations/summary`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(typeof body.data.total_savings).toBe('number')
    expect(body.data.mechanisms.lean_ctx).toBeDefined()
    expect(body.data.mechanisms.l1_cache).toBeDefined()
    expect(body.data.model_switch_count).toBeDefined()
  })

  // ========== Exception Path ==========

  it('POST /api/optimizations 校验 opt_id 必填', async () => {
    const res = await fetch(`${BASE_URL}/api/optimizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mechanisms: { lean_ctx: 5000 },
      }),
    })
    expect(res.status).toBe(400)
  })

  it('BR-008: model_switched=true 不计入总节省', async () => {
    const res = await fetch(`${BASE_URL}/api/optimizations/summary`)
    const body = await res.json() as any
    // model_switch_count > 0 时，model_switch_savings 单独展示
    expect(body.data.model_switch_savings).toBeDefined()
    // model_switch_savings 不应计入 total_savings
    expect(body.data.total_savings).toBeLessThanOrEqual(body.data.mechanisms.lean_ctx + body.data.mechanisms.l1_cache)
  })
})
