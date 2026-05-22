<template>
  <el-container style="min-height: 100vh; background: #1a1a2e;">
    <el-header style="background: #16213e; border-bottom: 1px solid #0f3460; display: flex; align-items: center; padding: 0 20px;">
      <h1 style="color: #e94560; font-size: 1.2rem; margin: 0;">📊 Qoder Monitor</h1>
      <span style="color: #8888aa; font-size: 0.8rem; margin-left: 12px;">AI 执行追踪与性能监控</span>
      <el-menu mode="horizontal" :ellipsis="false" style="margin-left: 24px; background: transparent; border-bottom: none;"
        :default-active="$route.path" router>
        <el-menu-item index="/dashboard" style="color: #e0e0e0; font-size: 0.85rem;">看板</el-menu-item>
        <el-menu-item index="/sessions" style="color: #e0e0e0; font-size: 0.85rem;">会话</el-menu-item>
      </el-menu>
      <div style="flex: 1;"></div>
      <el-tag size="small" type="danger" effect="dark" v-if="dashboardStore.connected === false">离线</el-tag>
      <el-tag size="small" type="success" effect="dark" v-else>在线</el-tag>
    </el-header>
    <el-main style="padding: 20px; color: #e0e0e0;">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { useDashboardStore } from './stores/dashboard'
const dashboardStore = useDashboardStore()
</script>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
}
.el-main, .el-header {
  --el-bg-color: #16213e;
  --el-border-color: #0f3460;
  --el-text-color-primary: #e0e0e0;
}
</style>
