<template>
  <div class="empty-state">
    <el-empty :description="message" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<style scoped>
.empty-state {
  padding: 60px 0;
  text-align: center;
  color: #666;
}
</style>
