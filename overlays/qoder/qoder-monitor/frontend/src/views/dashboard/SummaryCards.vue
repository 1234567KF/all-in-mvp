<template>
  <div class="summary-cards">
    <el-row :gutter="16">
      <el-col :span="6" v-for="card in cards" :key="card.label">
        <el-card :class="['summary-card', card.class || '']" shadow="hover">
          <div class="card-label">{{ card.label }}</div>
          <div class="card-value" :style="{ color: card.color }">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDashboardStore } from '../../stores/dashboard'

const store = useDashboardStore()

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

const cards = computed(() => {
  const sc = store.summaryCards
  if (!sc) return []
  return [
    { label: '总调用次数', value: sc.total_calls.toLocaleString(), color: '#409eff' },
    { label: '总输入 Token', value: formatTokens(sc.total_input_tokens), color: '#67c23a' },
    { label: '缓存命中率', value: sc.cache_hit_rate.toFixed(1) + '%', color: sc.cache_hit_rate > 50 ? '#67c23a' : '#e6a23c', class: sc.cache_hit_rate > 50 ? 'card-highlight' : '' },
    { label: '总输出 Token', value: formatTokens(sc.total_output_tokens), color: '#67c23a' },
    { label: '模型切换次数', value: sc.model_switch_count.toString(), color: '#e6a23c' },
    { label: '模型数', value: sc.model_count.toString(), color: '#409eff' },
    { label: '估算总成本', value: sc.currency + sc.estimated_cost.toFixed(4), color: '#f56c6c' },
    { label: '优化节省 Token', value: formatTokens(sc.total_savings), color: '#67c23a', class: 'card-savings' },
  ]
})
</script>

<style scoped>
.summary-cards { margin-bottom: 16px; }
.summary-card { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; margin-bottom: 16px; }
.summary-card :deep(.el-card__body) { padding: 16px; }
.card-label { font-size: 0.75rem; color: #8888aa; margin-bottom: 8px; }
.card-value { font-size: 1.4rem; font-weight: bold; }
.card-highlight { border-color: #67c23a; }
.card-savings { border-color: #67c23a; }
</style>
