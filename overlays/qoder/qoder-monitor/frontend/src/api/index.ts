import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const data = error.response?.data || { ok: false, error: { code: 'NETWORK_ERROR', message: '网络请求失败' } }
    return Promise.reject(data)
  }
)

export interface DashboardSummary {
  summary_cards: {
    total_calls: number
    total_input_tokens: number
    cache_hit_rate: number
    total_output_tokens: number
    model_switch_count: number
    model_count: number
    estimated_cost: number
    total_savings: number
    currency: string
  }
  model_distribution: Array<{ model: string; call_count: number; percentage: number }>
  cost_breakdown: Array<{ model: string; call_count: number; input_cost: number; output_cost: number; total_cost: number }>
  savings_breakdown: {
    mechanisms: Record<string, number>
    total_savings: number
  }
  recent_turns: Array<any>
  sessions: Array<any>
}

export async function fetchDashboardSummary(sessionId?: string): Promise<DashboardSummary> {
  const params = sessionId ? { session_id: sessionId } : {}
  const res: any = await api.get('/dashboard/summary', { params })
  return res.data
}

export async function fetchSessions(): Promise<any[]> {
  const res: any = await api.get('/sessions')
  return res.data.items
}

export async function fetchTurnStats(sessionId?: string): Promise<any> {
  const params = sessionId ? { session_id: sessionId } : {}
  const res: any = await api.get('/turns/stats', { params })
  return res.data
}

export { api }
