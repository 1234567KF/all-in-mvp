<template>
  <div class="turn-page">
    <TurnTable />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useDashboardStore } from '../../stores/dashboard'
import TurnTable from './TurnTable.vue'

const store = useDashboardStore()

onMounted(() => {
  store.startPolling()
})

onUnmounted(() => {
  store.stopPolling()
})
</script>

<style scoped>
.turn-page { max-width: 1400px; margin: 0 auto; }
</style>
