// ============================================================
// Pricing API 集成测试
// 覆盖: F-008 (成本估算)
// ============================================================
import { describe, it, expect, afterAll } from 'vitest'

const BASE_URL = 'http://localhost:3456'

describe('Pricing API - F-008', () => {
  // ========== Happy Path ==========

  it('GET /api/pricing 返回所有模型定价', async () => {
    const res = await fetch(`${BASE_URL}/api/pricing`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data.items)).toBe(true)
    body.data.items.forEach((item: any) => {
      expect(typeof item.model_id).toBe('string')
      expect(typeof item.input_per_mtok).toBe('number')
      expect(typeof item.output_per_mtok).toBe('number')
      expect(typeof item.cache_read_per_mtok).toBe('number')
    })
  })

  it('GET /api/pricing/:modelId 返回单个模型定价', async () => {
    const res = await fetch(`${BASE_URL}/api/pricing/deepseek-v4-pro`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.model_id).toBe('deepseek-v4-pro')
    expect(body.data.input_per_mtok).toBe(3.13)
    expect(body.data.output_per_mtok).toBe(6.26)
  })

  it('PUT /api/pricing/:modelId 更新定价成功', async () => {
    const res = await fetch(`${BASE_URL}/api/pricing/deepseek-v4-pro`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_per_mtok: 3.50 }),
    })
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    // Verify the update took effect
    const verifyRes = await fetch(`${BASE_URL}/api/pricing/deepseek-v4-pro`)
    const verifyBody = await verifyRes.json() as any
    expect(verifyBody.data.input_per_mtok).toBe(3.50)
  })

  // Restore original pricing after all tests
  afterAll(async () => {
    await fetch(`${BASE_URL}/api/pricing/deepseek-v4-pro`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_per_mtok: 3.13 }),
    })
  })

  // ========== Exception Path ==========

  it('GET /api/pricing/:modelId 不存在的模型返回 404', async () => {
    const res = await fetch(`${BASE_URL}/api/pricing/unknown-model`)
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('PUT /api/pricing/:modelId 不存在的模型返回 404', async () => {
    const res = await fetch(`${BASE_URL}/api/pricing/unknown-model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_per_mtok: 1.0 }),
    })
    expect(res.status).toBe(404)
  })

  it('BR-016: 模型无定价时成本显示"无定价"', async () => {
    const res = await fetch(`${BASE_URL}/api/turns/cost`)
    const body = await res.json() as any
    body.data.items.forEach((item: any) => {
      if (item.has_pricing === false) {
        expect(item.total_cost).toBe(0)
      }
    })
  })

  it('BR-017: currency 默认使用 ¥', async () => {
    const res = await fetch(`${BASE_URL}/api/pricing`)
    const body = await res.json() as any
    body.data.items.forEach((item: any) => {
      expect(item.currency).toBe('¥')
    })
  })
})
