// ============================================================
// E2E: 完整人机对话监控流程
// 覆盖: INT-HP-001 (完整人机对话监控)
// ============================================================
import { describe, it, expect } from 'vitest'

const BASE_URL = 'http://localhost:3456'

describe('E2E: 完整人机对话监控流程 - INT-HP-001', () => {
  const sessionId = `e2e-session-${Date.now()}`

  it('步骤1: PreToolUse Hook 记录用户输入 (role=human)', async () => {
    const res = await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        type: 'turn',
        role: 'human',
        timestamp: new Date().toISOString(),
        model_used: 'deepseek-v4-pro',
        message_size_bytes: 128,
        data_source: 'hook',
      }),
    })
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.id).toBeDefined()
    expect(body.data.session_id).toBe(sessionId)
  })

  it('步骤2: AI IDE 调用大模型 API (模拟 AI 回复数据)', async () => {
    const res = await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        type: 'turn',
        role: 'ai',
        timestamp: new Date().toISOString(),
        model_used: 'deepseek-v4-pro',
        input_uncached: 15000,
        input_cached: 5000,
        output_tokens: 2000,
        latency_ms: 3500,
        data_source: 'hook',
      }),
    })
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('步骤3: 多轮对话后查看看板，统计数据正确', async () => {
    // 模拟多轮对话
    for (let i = 0; i < 3; i++) {
      await fetch(`${BASE_URL}/api/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          type: 'turn',
          role: i % 2 === 0 ? 'human' : 'ai',
          timestamp: new Date().toISOString(),
          model_used: 'deepseek-v4-pro',
          input_uncached: 10000 + i * 1000,
          input_cached: 3000 + i * 500,
          output_tokens: 1500 + i * 200,
        }),
      })
    }

    // 验证看板统计
    const res = await fetch(`${BASE_URL}/api/dashboard/summary?session_id=${sessionId}`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.summary_cards.total_calls).toBeGreaterThanOrEqual(2)
  })

  it('步骤4: 数据在各模块间正确传递，无丢失', async () => {
    // 验证 turns
    const turnsRes = await fetch(`${BASE_URL}/api/turns?session_id=${sessionId}`)
    const turnsBody = await turnsRes.json() as any
    expect(turnsBody.data.items.length).toBeGreaterThanOrEqual(2)

    // 验证 sessions
    const sessionsRes = await fetch(`${BASE_URL}/api/sessions`)
    const sessionsBody = await sessionsRes.json() as any
    const session = sessionsBody.data.items.find((s: any) => s.id === sessionId)
    expect(session).toBeDefined()
  })
})

describe('E2E: A2A 多 Agent 协作监控 - INT-HP-002', () => {
  const sessionId = `e2e-a2a-${Date.now()}`

  it('步骤1: Coordinator 分配任务时触发 A2A 消息', async () => {
    const res = await fetch(`${BASE_URL}/api/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
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

  it('步骤2: A2A 消息在 Dashboard 中正确展示', async () => {
    const res = await fetch(`${BASE_URL}/api/turns?session_id=${sessionId}&type=a2a`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.data.items.length).toBeGreaterThanOrEqual(1)
    body.data.items.forEach((item: any) => {
      expect(item.type).toBe('a2a')
      expect(item.fromAgent).toBeDefined()
      expect(item.toAgent).toBeDefined()
    })
  })
})
