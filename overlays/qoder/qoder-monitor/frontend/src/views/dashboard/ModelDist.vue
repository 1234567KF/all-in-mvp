<template>
  <el-card class="section-card" shadow="hover">
    <template #header>模型分布</template>
    <div v-if="!store.modelDistribution.length" class="no-data">暂无数据</div>
    <div v-else class="model-grid">
      <div v-for="m in store.modelDistribution" :key="m.model" class="model-item">
        <div class="model-name">{{ m.model }}</div>
        <div class="model-bar-wrap">
          <div class="model-bar" :style="{ width: m.percentage + '%' }"></div>
        </div>
        <div class="model-stat">
          <span class="model-count">{{ m.call_count }} 次</span>
          <span class="model-pct">{{ m.percentage.toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { useDashboardStore } from '../../stores/dashboard'
const store = useDashboardStore()
</script>

<style scoped>
.section-card { background: #16213e; border: 1px solid #0f3460; margin-bottom: 16px; }
.section-card :deep(.el-card__header) { border-bottom: 1px solid #0f3460; color: #e0e0e0; font-size: 0.9rem; }
.no-data { text-align: center; padding: 30px; color: #666; }
.model-grid { display: flex; flex-direction: column; gap: 12px; }
.model-item { display: flex; align-items: center; gap: 12px; }
.model-name { width: 160px; font-size: 0.8rem; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.model-bar-wrap { flex: 1; height: 20px; background: #0f3460; border-radius: 10px; overflow: hidden; }
.model-bar { height: 100%; background: linear-gradient(90deg, #e94560, #ff6b6b); border-radius: 10px; transition: width 0.3s; }
.model-stat { width: 100px; text-align: right; font-size: 0.75rem; }
.model-count { color: #aaa; margin-right: 8px; }
.model-pct { color: #e94560; font-weight: bold; }
</style>
