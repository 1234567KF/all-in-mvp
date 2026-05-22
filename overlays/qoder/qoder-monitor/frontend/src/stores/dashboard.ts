import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchDashboardSummary, fetchSessions, type DashboardSummary } from '../api'

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref<DashboardSummary | null>(null)
  const connected = ref<boolean | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const sessionId = ref<string | undefined>(undefined)
  const sessions = ref<any[]>([])
  let pollingTimer: ReturnType<typeof setInterval> | null = null

  const summaryCards = computed(() => summary.value?.summary_cards ?? null)
  const modelDistribution = computed(() => summary.value?.model_distribution ?? [])
  const costBreakdown = computed(() => summary.value?.cost_breakdown ?? [])
  const savingsBreakdown = computed(() => summary.value?.savings_breakdown ?? null)
  const recentTurns = computed(() => summary.value?.recent_turns ?? [])

  async function loadData() {
    loading.value = true
    error.value = null
    try {
      const data = await fetchDashboardSummary(sessionId.value)
      summary.value = data
      connected.value = true
    } catch (e: any) {
      error.value = e?.error?.message || '加载数据失败'
      connected.value = false
    } finally {
      loading.value = false
    }
  }

  async function loadSessions() {
    try {
      sessions.value = await fetchSessions()
    } catch {
      // 静默失败，不影响主看板
    }
  }

  function setSession(id?: string) {
    sessionId.value = id
    loadData()
  }

  function startPolling() {
    stopPolling()
    loadData()
    loadSessions()
    pollingTimer = setInterval(() => {
      loadData()
    }, 5000)
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  return {
    summary, connected, loading, error, sessionId, sessions,
    summaryCards, modelDistribution, costBreakdown, savingsBreakdown, recentTurns,
    loadData, loadSessions, setSession, startPolling, stopPolling,
  }
})
