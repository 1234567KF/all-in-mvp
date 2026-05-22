<template>
  <el-card class="section-card" shadow="hover">
    <template #header>
      <div class="turn-table-header">
        <span>轮次明细</span>
        <div class="turn-filters">
          <el-select v-model="modelFilter" placeholder="模型" size="small" clearable style="width: 160px;">
            <el-option v-for="m in modelOptions" :key="m" :label="m" :value="m" />
          </el-select>
          <el-select v-model="typeFilter" placeholder="类型" size="small" clearable style="width: 110px;">
            <el-option label="全部" value="" />
            <el-option label="轮次" value="turn" />
            <el-option label="A2A" value="a2a" />
          </el-select>
          <el-input v-model="keywordFilter" placeholder="搜索 ID/Agent/角色/阶段" size="small" clearable style="width: 200px;" />
        </div>
      </div>
    </template>
    <EmptyState v-if="!filteredTurns.length" message="暂无轮次数据 — 发送消息后自动出现" />
    <el-table v-else :data="filteredTurns" style="width: 100%" stripe size="small"
      :header-cell-style="{ background: '#0f3460', color: '#e0e0e0', borderColor: '#1a1a2e' }"
      :cell-style="{ background: '#16213e', color: '#ccc', borderColor: '#0f3460' }">
      <el-table-column prop="id" label="ID" min-width="120">
        <template #default="{ row }">
          <code style="font-size: 0.7rem; color: #8888aa;">{{ row.id?.substring(0, 8) }}...</code>
        </template>
      </el-table-column>
      <el-table-column prop="type" label="类型" width="70">
        <template #default="{ row }">
          <el-tag :type="row.type === 'a2a' ? 'warning' : 'primary'" size="small" effect="dark">
            {{ row.type === 'a2a' ? 'A2A' : '轮次' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="direction" label="方向" width="70">
        <template #default="{ row }">
          <span v-if="row.direction === 'input'">📤 输入</span>
          <span v-else>📥 输出</span>
        </template>
      </el-table-column>
      <el-table-column prop="modelUsed" label="模型" min-width="150">
        <template #default="{ row }">
          <el-tag size="small" effect="dark" color="#0f3460" style="color: #e94560;">
            {{ row.modelUsed || '-' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="phase" label="阶段" width="80">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" type="info">{{ row.phase || '-' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="输入未命中" width="100" align="right">
        <template #default="{ row }">{{ formatNum(row.inputTokensUncached) }}</template>
      </el-table-column>
      <el-table-column label="输入缓存" width="90" align="right">
        <template #default="{ row }">{{ formatNum(row.inputTokensCached) }}</template>
      </el-table-column>
      <el-table-column label="输出" width="90" align="right">
        <template #default="{ row }">{{ formatNum(row.outputTokens) }}</template>
      </el-table-column>
      <el-table-column label="估算成本" width="110" align="right">
        <template #default="{ row }">
          <span v-if="row.estimatedCost != null">{{ '¥' + row.estimatedCost.toFixed(4) }}</span>
          <span v-else style="color: #888">无定价</span>
        </template>
      </el-table-column>
      <el-table-column label="优化节省" width="100" align="right">
        <template #default="{ row }">
          <span v-if="row.savings && row.savings > 0" style="color: #67c23a;">{{ formatNum(row.savings) }}</span>
          <span v-else style="color: #555;">0</span>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDashboardStore } from '../../stores/dashboard'
import EmptyState from '../../components/EmptyState.vue'

const store = useDashboardStore()
const modelFilter = ref('')
const typeFilter = ref('')
const keywordFilter = ref('')

const modelOptions = computed(() => {
  const models = new Set(store.recentTurns.map((t: any) => t.modelUsed).filter(Boolean))
  return Array.from(models)
})

const filteredTurns = computed(() => {
  let list = store.recentTurns
  if (modelFilter.value) list = list.filter((t: any) => t.modelUsed === modelFilter.value)
  if (typeFilter.value) list = list.filter((t: any) => t.type === typeFilter.value)
  if (keywordFilter.value) {
    const kw = keywordFilter.value.toLowerCase()
    list = list.filter((t: any) =>
      (t.id && t.id.toLowerCase().includes(kw)) ||
      (t.agentName && t.agentName.toLowerCase().includes(kw)) ||
      (t.role && t.role.toLowerCase().includes(kw)) ||
      (t.phase && t.phase.toLowerCase().includes(kw))
    )
  }
  return list
})

function formatNum(n: number | null | undefined): string {
  if (n == null) return '-'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}
</script>

<style scoped>
.section-card { background: #16213e; border: 1px solid #0f3460; }
.section-card :deep(.el-card__header) { border-bottom: 1px solid #0f3460; color: #e0e0e0; font-size: 0.9rem; }
.turn-table-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.turn-filters { display: flex; gap: 8px; }
</style>
