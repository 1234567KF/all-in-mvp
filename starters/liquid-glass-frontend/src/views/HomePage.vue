<script setup lang="ts">
/**
 * HomePage — Liquid Glass Starter 展示首页
 *
 * 演示: Hero 区域、特性卡片、KPI 指标、快速开始指南。
 * 作为脚手架落地页，展示设计系统的核心能力。
 */
import { Sun, Moon, Zap, Palette, Code, Layers, LayoutDashboard, LogIn, ArrowRight, Blocks } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const { theme, toggle: toggleTheme } = useTheme()

const features = [
  { icon: Palette, title: 'CSS 变量驱动', desc: '280+ 变量覆盖颜色/阴影/排版/圆角，改主色只需改一处' },
  { icon: Zap, title: 'Dark/Light 双主题', desc: '内置两套完整令牌，一行 class 切换，防闪烁直出' },
  { icon: Layers, title: '毛玻璃拟态', desc: 'backdrop-filter + 半透明背景 + 光泽渐变，深度光折射' },
  { icon: Code, title: 'Vue 3 + shadcn/vue', desc: '组合式 API + reka-ui 原语 + 无依赖复制组件' },
]

const demos = [
  { icon: LayoutDashboard, title: '仪表盘', desc: 'KPI卡片 + 数据表格 + 搜索筛选', path: '/dashboard', color: 'green' as const },
  { icon: Blocks, title: '组件展示', desc: '全部工具类可视化预览', path: '/components', color: 'purple' as const },
  { icon: LogIn, title: '登录页', desc: '表单验证 + loading + 错误态', path: '/login', color: 'blue' as const },
]
</script>

<template>
  <div class="min-h-screen relative overflow-hidden">

    <!-- ====== 背景装饰 (Blob 动画) ====== -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20 animate-blob"
           style="background: radial-gradient(circle, var(--lg-primary-dim), transparent 70%);" />
      <div class="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-15 animate-blob animation-delay-2000"
           style="background: radial-gradient(circle, var(--lg-accent-purple-dim), transparent 70%);" />
    </div>

    <!-- ====== 主题切换 ====== -->
    <button
      class="fixed top-4 right-4 btn-secondary !px-3 !py-2 z-20"
      @click="toggleTheme"
      :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
    >
      <Sun v-if="theme === 'dark'" class="w-4 h-4" />
      <Moon v-else class="w-4 h-4" />
    </button>

    <!-- ====== Hero ====== -->
    <section class="relative flex flex-col items-center justify-center min-h-screen px-6 py-20 text-center">
      <!-- 徽标 -->
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-[16px] mb-6"
           style="background: var(--lg-primary-dim); border: 1px solid var(--lg-primary-border);">
        <Zap class="w-8 h-8" style="color: var(--lg-primary-light);" />
      </div>

      <h1 class="font-h1 mb-3" style="font-size: 44px; letter-spacing: -0.03em;">
        Liquid Glass
        <span style="color: var(--lg-primary-light);"> Starter</span>
      </h1>
      <p class="text-lg mb-2" style="color: var(--lg-text-secondary); max-width: 600px;">
        Vue 3 + shadcn/vue + Tailwind CSS v4 前端脚手架
      </p>
      <p class="text-sm mb-10" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
        all-in-mvp 默认设计体系 · 企业级毛玻璃 UI · 开箱即用
      </p>

      <!-- 当前主题状态 -->
      <div class="glass-card inline-flex items-center gap-3 px-5 py-3 mb-12">
        <span class="w-2 h-2 rounded-full"
              :style="{ background: theme === 'dark' ? 'var(--lg-primary-light)' : 'var(--lg-accent-yellow)' }" />
        <span class="text-sm" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">
          当前主题: <strong style="color: var(--lg-text-primary);">{{ theme === 'dark' ? 'Dark (默认)' : 'Light' }}</strong>
        </span>
        <span class="text-xs" style="color: var(--lg-text-muted);">按 D 键切换</span>
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
          <p class="text-xs leading-relaxed" style="color: var(--lg-text-secondary);">{{ f.desc }}</p>
        </div>
      </div>

      <!-- KPI 数据 -->
      <div class="grid grid-cols-3 gap-4 w-full max-w-md mt-8">
        <div class="glass-card p-4">
          <div class="kpi-accent">
            <p class="data-label">CSS 变量</p>
            <p class="font-data-display" style="font-size: 24px; color: var(--lg-text-primary);">280+</p>
          </div>
        </div>
        <div class="glass-card p-4">
          <div class="kpi-accent">
            <p class="data-label">工具类</p>
            <p class="font-data-display" style="font-size: 24px; color: var(--lg-text-primary);">25+</p>
          </div>
        </div>
        <div class="glass-card p-4">
          <div class="kpi-accent">
            <p class="data-label">示例页面</p>
            <p class="font-data-display" style="font-size: 24px; color: var(--lg-text-primary);">5</p>
          </div>
        </div>
      </div>

      <!-- 演示页面入口 -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-8">
        <button
          v-for="demo in demos"
          :key="demo.path"
          @click="router.push(demo.path)"
          class="glass-card p-5 text-left cursor-pointer group transition-all duration-200 hover:scale-[1.02]"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-[8px] flex items-center justify-center"
                 :style="{ background: `var(--lg-accent-${demo.color}-dim)`, color: `var(--lg-accent-${demo.color})` }">
              <component :is="demo.icon" class="w-4 h-4" />
            </div>
            <span class="text-sm font-medium" style="color: var(--lg-text-primary);">{{ demo.title }}</span>
            <ArrowRight class="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                        style="color: var(--lg-primary-light);" />
          </div>
          <p class="text-xs pl-10" style="color: var(--lg-text-secondary);">{{ demo.desc }}</p>
        </button>
      </div>

      <!-- 快速开始 -->
      <div class="glass-card mt-10 p-6 w-full max-w-lg text-left space-y-3">
        <h2 class="font-h2" style="font-size: 18px;">快速开始</h2>
        <div class="space-y-2 text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">
          <p>1. 复制脚手架到目标项目目录</p>
          <p>2. <code style="color: var(--lg-primary-light);">npm install</code></p>
          <p>3. <code style="color: var(--lg-primary-light);">npm run dev</code></p>
          <p>4. 在 <code style="color: var(--lg-primary-light);">src/views/</code> 中创建新页面</p>
          <p>5. 在 <code style="color: var(--lg-primary-light);">src/router/index.ts</code> 中添加路由</p>
        </div>
      </div>

      <!-- 底部 -->
      <p class="mt-12 text-xs" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
        all-in-mvp · Liquid Glass Design System · Vue 3 + Vite + Tailwind CSS v4 + shadcn/vue
      </p>
    </section>
  </div>
</template>
