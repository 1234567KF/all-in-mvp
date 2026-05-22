import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchSessionsList, type SessionItem } from '../api/sessions'

export const useSessionStore = defineStore('session', () => {
  const sessions = ref<SessionItem[]>([])
  const currentSessionId = ref<string | undefined>(undefined)
  const loading = ref(false)

  async function loadSessions() {
    loading.value = true
    try {
      sessions.value = await fetchSessionsList()
    } catch {
      // 静默失败
    } finally {
      loading.value = false
    }
  }

  function selectSession(id?: string) {
    currentSessionId.value = id
  }

  function clearSelection() {
    currentSessionId.value = undefined
  }

  return { sessions, currentSessionId, loading, loadSessions, selectSession, clearSelection }
})
