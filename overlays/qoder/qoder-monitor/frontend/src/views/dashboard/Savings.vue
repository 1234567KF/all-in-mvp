<template>
  <el-card class="section-card" shadow="hover">
    <template #header>优化节省</template>
    <div v-if="!hasMechanisms" class="no-data">暂无优化节省数据</div>
    <div v-else class="savings-list">
      <div v-for="(val, key) in store.savingsBreakdown?.mechanisms" :key="key"
        :class="['savings-item', { 'savings-empty': val === 0 }, key === 'model_switch' ? 'savings-divider' : '']">
        <span class="savings-label">{{ mechanismLabel(key) }}</span>
        <el-tag :type="val > 0 ? 'success' : 'info'" size="small" effect="dark">
          {{ formatTokens(val) }}
        </el-tag>
      </div>
      <div class="savings-total">
        <span>合计节省</span>
        <span class="savings-total-value">{{ formatTokens(store.savingsBreakdown?.total_savings || 0) }} Token</span>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDashboardStore } from '../../stores/dashboard'

const store = useDashboardStore()

const hasMechanisms = computed(() => {
  const m = store.savingsBreakdown?.mechanisms
  return m && Object.keys(m).length > 0
})

function mechanismLabel(key: string): string {
  const labels: Record<string, string> = {
    cache_hit: '缓存命中',
    lean_ctx: '精简上下文',
    l1_cache: 'L1 缓存',
    prompt_cache: '提示词缓存',
    token_compression: 'Token 压缩',
    model_switch: '模型切换',
  }
  return labels[key] || key
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}
</script>

<style scoped>
.section-card { background: #16213e; border: 1px solid #0f3460; margin-bottom: 16px; }
.section-card :deep(.el-card__header) { border-bottom: 1px solid #0f3460; color: #e0e0e0; font-size: 0.9rem; }
.no-data { text-align: center; padding: 30px; color: #666; }
.savings-list { display: flex; flex-direction: column; gap: 8px; }
.savings-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
.savings-empty { opacity: 0.4; }
.savings-divider { border-top: 1px dashed #0f3460; margin-top: 8px; padding-top: 8px; }
.savings-label { color: #ccc; font-size: 0.85rem; }
.savings-total { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #0f3460; margin-top: 8px; color: #67c23a; font-weight: bold; }
.savings-total-value { font-size: 1.1rem; }
</style>
