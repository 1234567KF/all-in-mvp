// ============================================================
// System API 集成测试
// 覆盖: F-012 (数据重置), F-013 (健康检查)
// ============================================================
import { describe, it, expect } from 'vitest'

const BASE_URL = 'http://localhost:3456'

describe('System API - F-012/F-013', () => {
  // ========== Happy Path ==========

  it('AC-013: GET /api/health 返回健康状态', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.status).toBe('healthy')
    expect(typeof body.data.timestamp).toBe('string')
    expect(typeof body.data.db_connected).toBe('boolean')
    expect(typeof body.data.turn_count).toBe('number')
  })

  it('AC-012: DELETE /api/data 清空数据成功', async () => {
    const res = await fetch(`${BASE_URL}/api/data`, { method: 'DELETE' })
    const body = await res.json() as any
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.message).toBeDefined()
    expect(body.data.cleared_tables).toBeDefined()
    expect(Array.isArray(body.data.cleared_tables)).toBe(true)
  })

  // ========== Exception Path ==========

  it('BR-022: 文件不存在时静默跳过', async () => {
    // 连续两次 DELETE 不应报错
    const res1 = await fetch(`${BASE_URL}/api/data`, { method: 'DELETE' })
    const res2 = await fetch(`${BASE_URL}/api/data`, { method: 'DELETE' })
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
  })

  it('F-013: 健康检查包含数据库连接状态', async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    const body = await res.json() as any
    expect(body.data.db_connected).toBe(true)
    expect(typeof body.data.db_size).toBe('number')
  })
})
