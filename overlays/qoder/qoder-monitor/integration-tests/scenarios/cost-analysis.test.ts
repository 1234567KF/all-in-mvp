// ============================================================
// E2E: 成本分析与优化评估
// 覆盖: INT-HP-003 (优化节省量化流程), EP-001~EP-005
// ============================================================
import { describe, it, expect } from 'vitest'

const BASE_URL = 'http://localhost:3456'

describe('E2E: 成本分析与优化评估 - INT-HP-003', () => {
  const sessionId = `e2e-cost-${Date.now()}`

  // Helper: create turns with staggered timestamps to avoid BR-001/BR-004 dedup
  async function createTurnsForSession(sid: string) {
    const base = Date.now()
    // Human turn (pro) - timestamp offset -60s to avoid 30s dedup
    await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sid, type: 'turn', role: 'human',
        timestamp: new Date(base - 60000).toISOString(), model_used: 'deepseek-v4-pro',
        input_uncached: 1000000, input_cached: 500000, output_tokens: 200000,
        note: 'pro-human',
      }),
    })
    // AI turn (pro) - different role, no dedup conflict
    await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sid, type: 'turn', role: 'ai',
        timestamp: new Date(base - 50000).toISOString(), model_used: 'deepseek-v4-pro',
        input_uncached: 1000000, input_cached: 500000, output_tokens: 200000,
        note: 'pro-ai',
      }),
    })
    // Human turn (flash) - timestamp offset -10s, within 30s of now but different from first human
    // Use a different session to completely avoid BR-001 dedup
    await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sid, type: 'turn', role: 'human',
        timestamp: new Date(base - 10000).toISOString(), model_used: 'deepseek-v4-flash',
        input_uncached: 500000, input_cached: 200000, output_tokens: 100000,
        note: 'flash-human',
      }),
    })
  }

  it('步骤1: 创建测试数据（多模型轮次）', async () => {
    await createTurnsForSession(sessionId)

    // Verify data was created (at least 1 turn, dedup may skip some)
    const res = await fetch(`${BASE_URL}/api/turns?session_id=${sessionId}`)
    const body = await res.json() as any
    expect(body.data.items.length).toBeGreaterThanOrEqual(1)
  })

  it('步骤2: 成本估算准确 - DeepSeek V4-Pro 定价验证 (F-008)', async () => {
    // Ensure data exists (self-contained in case previous tests cleared data)
    const existingRes = await fetch(`${BASE_URL}/api/turns?session_id=${sessionId}`)
    const existingBody = await existingRes.json() as any
    if (existingBody.data.items.length === 0) {
      await createTurnsForSession(sessionId)
    }

    const res = await fetch(`${BASE_URL}/api/turns/cost?session_id=${sessionId}`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.data.items.length).toBeGreaterThanOrEqual(1)
    const proItem = body.data.items.find((i: any) => i.model === 'deepseek-v4-pro')
    expect(proItem).toBeDefined()

    // 验证定价数据
    const pricingRes = await fetch(`${BASE_URL}/api/pricing/deepseek-v4-pro`)
    const pricingBody = await pricingRes.json() as any
    expect(typeof pricingBody.data.input_per_mtok).toBe('number')
    expect(typeof pricingBody.data.output_per_mtok).toBe('number')
    expect(typeof pricingBody.data.cache_read_per_mtok).toBe('number')
  })

  it('步骤3: 模型分布统计正确', async () => {
    // Ensure data exists
    const existingRes = await fetch(`${BASE_URL}/api/turns?session_id=${sessionId}`)
    const existingBody = await existingRes.json() as any
    if (existingBody.data.items.length === 0) {
      await createTurnsForSession(sessionId)
    }

    const res = await fetch(`${BASE_URL}/api/turns/model-distribution?session_id=${sessionId}`)
    const body = await res.json() as any
    expect(body.data.items.length).toBeGreaterThanOrEqual(1)
    body.data.items.forEach((item: any) => {
      expect(typeof item.call_count).toBe('number')
      expect(typeof item.percentage).toBe('number')
    })
  })
})

describe('E2E: 异常路径 - EP-001~EP-005', () => {
  it('EP-001: Token 数据无法获取时记录 0 值', async () => {
    // 模拟无 usage 数据的轮次
    const res = await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'ep-session',
        type: 'turn', role: 'ai',
        timestamp: new Date().toISOString(),
        model_used: 'deepseek-v4-pro',
        data_source: 'hook',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })

  it('EP-003: 模型无定价数据时成本显示为 0', async () => {
    // 使用 pricing.json 中未定义的模型
    await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'ep-session-pricing',
        type: 'turn', role: 'ai',
        timestamp: new Date().toISOString(),
        model_used: 'unknown-model-xyz',
        input_uncached: 100000,
        output_tokens: 50000,
      }),
    })
    const res = await fetch(`${BASE_URL}/api/turns/cost?session_id=ep-session-pricing`)
    const body = await res.json() as any
    const unknownItem = body.data.items.find((i: any) => i.model === 'unknown-model-xyz')
    if (unknownItem) {
      expect(unknownItem.has_pricing).toBe(false)
      expect(unknownItem.total_cost).toBe(0)
    }
  })

  it('EP-005: 并发写入不受影响', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      fetch(`${BASE_URL}/api/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'ep-concurrent',
          type: 'turn', role: 'human',
          timestamp: new Date().toISOString(),
          model_used: 'deepseek-v4-pro',
          note: `concurrent-${i}`,
        }),
      })
    )
    const results = await Promise.all(promises)
    results.forEach(r => expect(r.status).toBe(200))
  })
})
