// ============================================================
// Dashboard API 集成测试
// 覆盖: F-005 (实时看板), F-006 (会话筛选)
// ============================================================
import { describe, it, expect } from 'vitest'

const BASE_URL = 'http://localhost:3456'

describe('Dashboard API - F-005/F-006', () => {
  // ========== Happy Path ==========

  it('AC-005: GET /api/dashboard/summary 返回完整看板数据', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/summary`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    // 检查汇总卡片
    const cards = body.data.summary_cards
    expect(typeof cards.total_calls).toBe('number')
    expect(typeof cards.total_input_tokens).toBe('number')
    expect(typeof cards.cache_hit_rate).toBe('number')
    expect(typeof cards.total_output_tokens).toBe('number')
    expect(typeof cards.model_switch_count).toBe('number')
    expect(typeof cards.model_count).toBe('number')
    expect(typeof cards.estimated_cost).toBe('number')
    expect(typeof cards.total_savings).toBe('number')
    expect(cards.currency).toBe('¥')

    // 检查模型分布
    expect(Array.isArray(body.data.model_distribution)).toBe(true)

    // 检查成本明细
    expect(Array.isArray(body.data.cost_breakdown)).toBe(true)
    if (body.data.cost_breakdown.length > 0) {
      expect(typeof body.data.cost_breakdown[0].total_cost).toBe('number')
    }

    // 检查优化节省
    expect(body.data.savings_breakdown.mechanisms).toBeDefined()
    expect(typeof body.data.savings_breakdown.total_savings).toBe('number')

    // 检查最近轮次
    expect(Array.isArray(body.data.recent_turns)).toBe(true)

    // 检查会话列表
    expect(Array.isArray(body.data.sessions)).toBe(true)
  })

  it('AC-006: GET /api/dashboard/summary 支持 session_id 筛选', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/summary?session_id=session-001`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    // 筛选后所有回合都应属于 session-001
    body.data.recent_turns.forEach((turn: any) => {
      expect(turn.sessionId).toBe('session-001')
    })
  })

  it('AC-005: 缓存率范围在 0-100 之间', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/summary`)
    const body = await res.json() as any
    const cacheRate = body.data.summary_cards.cache_hit_rate
    expect(cacheRate).toBeGreaterThanOrEqual(0)
    expect(cacheRate).toBeLessThanOrEqual(100)
  })

  // ========== Exception Path ==========

  it('BR-010: 无数据时显示空态', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/summary?session_id=nonexistent`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.data.summary_cards.total_calls).toBe(0)
    expect(body.data.summary_cards.total_input_tokens).toBe(0)
  })

  it('BR-011: 模型无定价时成本数据正确处理', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/summary`)
    const body = await res.json() as any
    // 确保 summary 不因为无定价而报错
    expect(body.ok).toBe(true)
  })
})
