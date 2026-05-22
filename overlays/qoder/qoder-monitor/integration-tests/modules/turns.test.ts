// ============================================================
// Turns API 集成测试
// 覆盖: F-001 (用户输入), F-002 (AI回复), F-003 (A2A)
// ============================================================
import { describe, it, expect } from 'vitest'

const BASE_URL = 'http://localhost:3456'

describe('Turns API - F-001/F-002/F-003', () => {
  // ========== Happy Path ==========

  it('AC-001: POST /api/turns 创建用户输入 (role=human) 成功', async () => {
    const uniqueSession = `test-session-001-${Date.now()}`
    const res = await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: uniqueSession,
        type: 'turn',
        role: 'human',
        timestamp: new Date().toISOString(),
        model_used: 'deepseek-v4-pro',
        message_size_bytes: 256,
      }),
    })
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.id).toBeDefined()
    expect(body.data.session_id).toBe(uniqueSession)
  })

  it('AC-002: POST /api/turns 创建 AI 回复 (role=ai) 含 Token 数据成功', async () => {
    const uniqueSession = `test-session-002-${Date.now()}`
    const res = await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: uniqueSession,
        type: 'turn',
        role: 'ai',
        timestamp: new Date().toISOString(),
        model_used: 'deepseek-v4-pro',
        input_uncached: 15000,
        input_cached: 5000,
        output_tokens: 2000,
      }),
    })
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.id).toBeDefined()
  })

  it('AC-003: POST /api/turns 创建 A2A 消息 (type=a2a) 成功', async () => {
    const res = await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'test-session-001',
        type: 'a2a',
        timestamp: new Date().toISOString(),
        from_agent: 'coordinator',
        to_agent: 'backend-1',
        skill: 'kf-mvp-backend-tdd',
        protocol: 'native',
      }),
    })
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.id).toBeDefined()
  })

  it('GET /api/turns 返回轮次列表', async () => {
    const res = await fetch(`${BASE_URL}/api/turns?page=1&page_size=10`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data.items)).toBe(true)
    expect(typeof body.data.total).toBe('number')
  })

  it('GET /api/turns 支持 type 筛选', async () => {
    const res = await fetch(`${BASE_URL}/api/turns?type=turn`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    body.data.items.forEach((item: any) => expect(item.type).toBe('turn'))
  })

  it('GET /api/turns 支持 session_id 筛选', async () => {
    const res = await fetch(`${BASE_URL}/api/turns?session_id=session-001`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    body.data.items.forEach((item: any) => expect(item.sessionId).toBe('session-001'))
  })

  it('GET /api/turns/:id 返回单条轮次详情', async () => {
    // 先创建一条有确定 ID 的轮次
    const knownId = `turn-test-${Date.now()}`
    await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'test-session-001',
        type: 'turn',
        role: 'human',
        timestamp: new Date().toISOString(),
        model_used: 'deepseek-v4-pro',
        note: knownId,
      }),
    })

    // 查询刚创建的轮次（通过列表找到 ID）
    const listRes = await fetch(`${BASE_URL}/api/turns?session_id=test-session-001`)
    const listBody = await listRes.json() as any
    const turn = listBody.data.items.find((t: any) => t.note === knownId)
    expect(turn).toBeDefined()

    const res = await fetch(`${BASE_URL}/api/turns/${turn.id}`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.id).toBe(turn.id)
  })

  // ========== Exception Path ==========

  it('GET /api/turns/:id 不存在的 ID 返回 404', async () => {
    const res = await fetch(`${BASE_URL}/api/turns/nonexistent-id`)
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('POST /api/turns 缺少必填字段返回 400', async () => {
    const res = await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // 缺失 session_id, type, timestamp
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('BAD_REQUEST')
  })
})

describe('Turns API - F-007/F-008/F-009 (统计)', () => {
  it('GET /api/turns/stats 返回统计数据', async () => {
    const res = await fetch(`${BASE_URL}/api/turns/stats`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(typeof body.data.total_calls).toBe('number')
    expect(typeof body.data.total_input_tokens).toBe('number')
    expect(typeof body.data.cache_hit_rate).toBe('number')
    expect(body.data.cache_hit_rate).toBeGreaterThanOrEqual(0)
    expect(body.data.cache_hit_rate).toBeLessThanOrEqual(100)
  })

  it('GET /api/turns/stats 空数据时缓存率为 0 (BR-014)', async () => {
    const res = await fetch(`${BASE_URL}/api/turns/stats?session_id=nonexistent`)
    const body = await res.json() as any
    expect(body.data.cache_hit_rate).toBe(0)
  })

  it('GET /api/turns/cost 返回成本估算', async () => {
    const res = await fetch(`${BASE_URL}/api/turns/cost`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data.items)).toBe(true)
    expect(typeof body.data.total_cost).toBe('number')
  })

  it('GET /api/turns/savings 返回优化节省', async () => {
    const res = await fetch(`${BASE_URL}/api/turns/savings`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(typeof body.data.total_savings).toBe('number')
    expect(body.data.mechanisms).toBeDefined()
    expect(body.data.model_switch_savings).toBeDefined()
  })

  it('GET /api/turns/model-distribution 返回模型分布', async () => {
    const res = await fetch(`${BASE_URL}/api/turns/model-distribution`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(Array.isArray(body.data.items)).toBe(true)
    body.data.items.forEach((item: any) => {
      expect(typeof item.model).toBe('string')
      expect(typeof item.call_count).toBe('number')
      expect(typeof item.percentage).toBe('number')
    })
  })
})
