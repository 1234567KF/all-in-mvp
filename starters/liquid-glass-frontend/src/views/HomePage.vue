<script setup lang="ts">
import { Sun, Moon, Zap, Palette, Code, Layers } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'

const { theme, toggle: toggleTheme } = useTheme()

const features = [
  { icon: Palette, title: 'CSS 变量驱动', desc: '所有颜色通过 --lg-* 变量控制，改一处全局生效' },
  { icon: Zap, title: 'Dark/Light 双主题', desc: 'theme-tokens.css 内置两套完整令牌，一键切换' },
  { icon: Layers, title: '毛玻璃拟态', desc: 'backdrop-filter + 半透明背景，深度与光折射' },
  { icon: Code, title: 'Vue 3 + shadcn/vue', desc: '组合式 API + 无依赖复制组件' },
]
</script>

<template>
  <div class="min-h-screen"
       style="background: var(--lg-background);">

    <!-- ====== 主题切换 ====== -->
    <button
      class="absolute top-4 right-4 btn-secondary !px-3 !py-2 z-10"
      @click="toggleTheme"
      :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
    >
      <Sun v-if="theme === 'dark'" class="w-4 h-4" />
      <Moon v-else class="w-4 h-4" />
    </button>

    <!-- ====== Hero ====== -->
    <section class="flex flex-col items-center justify-center min-h-screen px-6 py-20 text-center"
             style="background: radial-gradient(circle at 50% -20%, var(--lg-primary-dim) 0%, transparent 60%), var(--lg-background);">
      <!-- 徽标 -->
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-[16px] mb-6"
           style="background: var(--lg-primary-dim); border: 1px solid var(--lg-primary-border);">
        <Zap class="w-8 h-8" style="color: var(--lg-primary-light);" />
      </div>

      <h1 class="font-h1 mb-3" style="font-size: 40px;">
        Liquid Glass
        <span style="color: var(--lg-primary-light);"> Starter</span>
      </h1>
      <p class="text-lg mb-2" style="color: var(--lg-text-secondary); max-width: 560px;">
        Vue 3 + shadcn/vue + Tailwind CSS v4 前端脚手架
      </p>
      <p class="text-sm mb-10" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
        all-in-mvp 默认设计体系 · 开箱即用
      </p>

      <!-- 当前主题状态卡片 -->
      <div class="glass-card inline-flex items-center gap-3 px-5 py-3 mb-12">
        <span class="w-2 h-2 rounded-full"
              :style="{ background: theme === 'dark' ? 'var(--lg-primary-light)' : 'var(--lg-accent-yellow)' }"></span>
        <span class="text-sm" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">
          当前主题: <strong style="color: var(--lg-text-primary);">{{ theme === 'dark' ? 'Dark (默认)' : 'Light' }}</strong>
        </span>
      </div>

      <!-- 特性卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
        <div
          v-for="f in features"
          :key="f.title"
          class="glass-card p-5 text-left"
        >
          <div class="flex items-center gap-2 mb-2">
            <component :is="f.icon" class="w-4 h-4" style="color: var(--lg-primary-light);" />
            <span class="text-sm font-medium" style="color: var(--lg-text-primary);">{{ f.title }}</span>
          </div>
          <p class="text-xs" style="color: var(--lg-text-secondary);">{{ f.desc }}</p>
        </div>
      </div>

      <!-- KPI 示例 -->
      <div class="grid grid-cols-3 gap-4 w-full max-w-md mt-8">
        <div class="glass-card p-4">
          <div class="kpi-accent">
            <p class="data-label">CSS 变量</p>
            <p class="font-data-display" style="font-size: 24px;">280+</p>
          </div>
        </div>
        <div class="glass-card p-4">
          <div class="kpi-accent">
            <p class="data-label">工具类</p>
            <p class="font-data-display" style="font-size: 24px;">20+</p>
          </div>
        </div>
        <div class="glass-card p-4">
          <div class="kpi-accent">
            <p class="data-label">依赖</p>
            <p class="font-data-display" style="font-size: 24px;">6</p>
          </div>
        </div>
      </div>

      <!-- 快速开始 -->
      <div class="glass-card mt-10 p-6 w-full max-w-lg text-left space-y-3">
        <h2 class="font-h2" style="font-size: 18px;">快速开始</h2>
        <div class="space-y-2 text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">
          <p>1. 复制脚手架到目标项目</p>
          <p>2. <code style="color: var(--lg-primary-light);">npm install</code></p>
          <p>3. <code style="color: var(--lg-primary-light);">npm run dev</code></p>
          <p>4. 在 <code style="color: var(--lg-primary-light);">src/main.ts</code> 中添加路由</p>
          <p>5. 在 <code style="color: var(--lg-primary-light);">src/views/</code> 中创建页面</p>
        </div>
      </div>

      <!-- 底部 -->
      <p class="mt-12 text-xs" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
        all-in-mvp · Liquid Glass Design System · Vue 3 + Vite + Tailwind CSS v4
      </p>
    </section>
  </div>
</template>
