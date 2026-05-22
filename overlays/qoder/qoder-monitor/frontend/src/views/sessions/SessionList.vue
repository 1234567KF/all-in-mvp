<template>
  <div class="session-manager">
    <el-card class="section-card" shadow="hover">
      <template #header>
        <div class="session-header">
          <span>会话管理</span>
          <el-button size="small" type="primary" text @click="refreshSessions" :loading="store.loading">
            刷新
          </el-button>
        </div>
      </template>
      <div v-if="!store.sessions.length" class="no-data">
        <EmptyState message="暂无会话记录 — 发送消息后自动出现" />
      </div>
      <el-table v-else :data="store.sessions" style="width: 100%" stripe size="small"
        highlight-current-row
        @row-click="handleRowClick"
        :header-cell-style="{ background: '#0f3460', color: '#e0e0e0', borderColor: '#1a1a2e' }"
        :cell-style="{ background: '#16213e', color: '#ccc', borderColor: '#0f3460' }">
        <el-table-column prop="id" label="会话 ID" min-width="200">
          <template #default="{ row }">
            <a class="session-link" :class="{ active: dashboardStore.sessionId === row.id }">
              {{ row.id.substring(0, 12) }}...
            </a>
          </template>
        </el-table-column>
        <el-table-column prop="turnCount" label="轮次数量" width="100" align="right">
          <template #default="{ row }">{{ row.turnCount }}</template>
        </el-table-column>
        <el-table-column prop="a2aCount" label="A2A 数量" width="100" align="right">
          <template #default="{ row }">{{ row.a2aCount }}</template>
        </el-table-column>
        <el-table-column prop="created" label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created) }}</template>
        </el-table-column>
        <el-table-column prop="lastActivity" label="最后活跃" width="170">
          <template #default="{ row }">{{ formatTime(row.lastActivity) }}</template>
        </el-table-column>
      </el-table>
      <div class="session-actions" v-if="dashboardStore.sessionId">
        <el-tag size="small" type="info" effect="dark">
          当前会话: {{ dashboardStore.sessionId.substring(0, 12) }}...
        </el-tag>
        <el-button size="small" type="warning" text @click="clearFilter">清除筛选</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSessionStore } from '../../stores/session'
import { useDashboardStore } from '../../stores/dashboard'
import EmptyState from '../../components/EmptyState.vue'

const store = useSessionStore()
const dashboardStore = useDashboardStore()

onMounted(() => {
  store.loadSessions()
})

function handleRowClick(row: any) {
  dashboardStore.setSession(row.id)
  store.selectSession(row.id)
}

function clearFilter() {
  dashboardStore.setSession(undefined)
  store.clearSelection()
}

function refreshSessions() {
  store.loadSessions()
}

function formatTime(t: string): string {
  if (!t) return '-'
  try {
    return t.replace('T', ' ').substring(0, 19)
  } catch {
    return t
  }
}
</script>

<style scoped>
.section-card { background: #16213e; border: 1px solid #0f3460; }
.section-card :deep(.el-card__header) { border-bottom: 1px solid #0f3460; color: #e0e0e0; font-size: 0.9rem; }
.session-header { display: flex; justify-content: space-between; align-items: center; }
.no-data { text-align: center; padding: 30px; color: #666; }
.session-link { cursor: pointer; color: #409eff; text-decoration: none; }
.session-link:hover { color: #e94560; }
.session-link.active { color: #e94560; font-weight: bold; }
.session-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid #0f3460; }
</style>
