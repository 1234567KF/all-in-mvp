<script setup lang="ts">
/**
 * NotFoundView — 404 页面
 *
 * 演示: 错误状态页面布局、倒计时自动跳转、毛玻璃卡片。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Home, ArrowLeft, FileQuestion } from 'lucide-vue-next'

const router = useRouter()
const countdown = ref(10)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      router.replace('/')
    }
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6"
       style="background: var(--lg-background);">

    <div class="glass-card w-full max-w-md p-8 text-center space-y-6">
      <!-- 图标 -->
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-[20px]"
           style="background: var(--lg-accent-purple-dim); border: 1px solid var(--lg-accent-purple-border);">
        <FileQuestion class="w-10 h-10" style="color: var(--lg-accent-purple);" />
      </div>

      <!-- 标题 -->
      <div>
        <h1 class="font-data-display mb-2" style="font-size: 64px; color: var(--lg-text-primary);">
          404
        </h1>
        <p class="text-lg font-medium" style="color: var(--lg-text-primary);">
          页面未找到
        </p>
        <p class="text-sm mt-1" style="color: var(--lg-text-secondary);">
          您访问的页面不存在或已被移除
        </p>
      </div>

      <!-- 倒计时 -->
      <p class="text-xs" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
        {{ countdown }} 秒后自动返回首页
      </p>

      <!-- 操作按钮 -->
      <div class="flex items-center justify-center gap-3">
        <button class="btn-secondary" @click="router.back()">
          <ArrowLeft class="w-4 h-4" />
          返回上页
        </button>
        <button class="btn-primary" @click="router.replace('/')">
          <Home class="w-4 h-4" />
          返回首页
        </button>
      </div>
    </div>
  </div>
</template>
