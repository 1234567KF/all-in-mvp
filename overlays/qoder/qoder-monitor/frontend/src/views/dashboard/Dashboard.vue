<template>
  <div class="dashboard">
    <div v-if="store.loading && !store.summaryCards" class="loading-wrap">
      <el-skeleton :rows="6" animated />
    </div>
    <el-alert v-else-if="store.error" :title="store.error" type="error" show-icon closable />
    <template v-else-if="!store.summaryCards">
      <EmptyState message="暂无数据 — 发送消息后自动出现" />
    </template>
    <template v-else>
      <SummaryCards />
      <el-row :gutter="16">
        <el-col :span="12"><ModelDist /></el-col>
        <el-col :span="12"><Savings /></el-col>
      </el-row>
      <TurnTable />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useDashboardStore } from '../../stores/dashboard'
import SummaryCards from './SummaryCards.vue'
import ModelDist from './ModelDist.vue'
import Savings from './Savings.vue'
import TurnTable from './TurnTable.vue'
import EmptyState from '../../components/EmptyState.vue'

const store = useDashboardStore()

onMounted(() => {
  store.startPolling()
})

onUnmounted(() => {
  store.stopPolling()
})
</script>

<style scoped>
.dashboard { max-width: 1400px; margin: 0 auto; }
.loading-wrap { padding: 40px; background: #16213e; border-radius: 8px; }
</style>
