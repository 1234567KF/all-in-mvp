<script setup lang="ts">
/**
 * ComponentsView — 设计系统组件展示页
 *
 * 可视化展示所有 design-utils.css 中定义的工具类和设计 Token。
 * 包括: 卡片变体、按钮、输入框、徽章/标签、排版、强调色等。
 */
import { ref } from 'vue'
import {
  Zap, Palette, Layers, Search, Mail, Shield, Sun, Moon,
  Check, AlertTriangle, Info
} from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const { theme, toggle: toggleTheme } = useTheme()
const activeTab = ref<'cards' | 'buttons' | 'inputs' | 'badges' | 'typography' | 'colors'>('cards')

const tabs = [
  { id: 'cards' as const, label: '卡片' },
  { id: 'buttons' as const, label: '按钮' },
  { id: 'inputs' as const, label: '输入框' },
  { id: 'badges' as const, label: '徽章' },
  { id: 'typography' as const, label: '排版' },
  { id: 'colors' as const, label: '颜色' },
]
</script>

<template>
  <div class="p-4 lg:p-6 space-y-6" style="max-width: 1280px; margin: 0 auto;">

    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-h1" style="font-size: 24px;">组件展示</h1>
        <p class="text-sm mt-1" style="color: var(--lg-text-secondary);">
          Liquid Glass 设计系统工具类可视化预览
        </p>
      </div>
      <button class="btn-secondary !px-3 !py-2" @click="toggleTheme">
        <Sun v-if="theme === 'dark'" class="w-4 h-4" />
        <Moon v-else class="w-4 h-4" />
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 p-1 rounded-[10px] w-fit"
         style="background: var(--lg-surface-container);">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-2 text-sm rounded-[8px] transition-all duration-200"
        :style="{
          background: activeTab === tab.id ? 'var(--lg-surface-glass)' : 'transparent',
          color: activeTab === tab.id ? 'var(--lg-text-primary)' : 'var(--lg-text-muted)',
          fontWeight: activeTab === tab.id ? '500' : '400',
          boxShadow: activeTab === tab.id ? 'var(--shadow-card)' : 'none',
        }"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ====== 卡片 (Cards) ====== -->
    <section v-if="activeTab === 'cards'" class="space-y-6">
      <div class="glass-card p-6">
        <h2 class="font-h2 mb-4" style="font-size: 18px;">Glass Card</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="glass-card p-5">
            <div class="flex items-center gap-2 mb-2">
              <Zap class="w-4 h-4" style="color: var(--lg-primary-light);" />
              <span class="font-medium text-sm" style="color: var(--lg-text-primary);">Glass Card</span>
            </div>
            <p class="text-xs" style="color: var(--lg-text-secondary);">
              毛玻璃卡片 (带阴影)。<br/>Class: <code class="text-xs" style="color: var(--lg-primary-light);">.glass-card</code>
            </p>
          </div>
          <div class="liquid-glass p-5">
            <div class="flex items-center gap-2 mb-2">
              <Layers class="w-4 h-4" style="color: var(--lg-primary-light);" />
              <span class="font-medium text-sm" style="color: var(--lg-text-primary);">Liquid Glass</span>
            </div>
            <p class="text-xs" style="color: var(--lg-text-secondary);">
              毛玻璃容器 (无阴影)。<br/>Class: <code class="text-xs" style="color: var(--lg-primary-light);">.liquid-glass</code>
            </p>
          </div>
          <div class="matte-card p-5">
            <div class="flex items-center gap-2 mb-2">
              <Palette class="w-4 h-4" style="color: var(--lg-text-secondary);" />
              <span class="font-medium text-sm" style="color: var(--lg-text-primary);">Matte Card</span>
            </div>
            <p class="text-xs" style="color: var(--lg-text-secondary);">
              平板玻璃 (无反射光泽)。<br/>Class: <code class="text-xs" style="color: var(--lg-primary-light);">.matte-card</code>
            </p>
          </div>
        </div>
      </div>

      <div class="glass-card p-6">
        <h2 class="font-h2 mb-4" style="font-size: 18px;">KPI 强调卡片</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="glass-card p-5">
            <div class="kpi-accent">
              <p class="data-label">用户数</p>
              <p class="font-data-display" style="font-size: 28px; color: var(--lg-text-primary);">3,421</p>
            </div>
          </div>
          <div class="glass-card p-5">
            <div class="liquid-accent">
              <p class="text-sm font-medium" style="color: var(--lg-text-primary);">普通强调条</p>
              <p class="text-xs mt-1" style="color: var(--lg-text-secondary);">Class: <code>.liquid-accent</code></p>
            </div>
          </div>
          <div class="glass-card p-5 skeleton-glass" style="height: 96px;" />
        </div>
      </div>
    </section>

    <!-- ====== 按钮 (Buttons) ====== -->
    <section v-if="activeTab === 'buttons'" class="space-y-6">
      <div class="glass-card p-6">
        <h2 class="font-h2 mb-4" style="font-size: 18px;">按钮变体</h2>
        <div class="flex flex-wrap gap-3 items-center">
          <button class="btn-primary">
            <Zap class="w-4 h-4" />
            主色按钮
          </button>
          <button class="btn-secondary">
            <Layers class="w-4 h-4" />
            次要按钮
          </button>
          <button class="btn-primary" disabled>禁用态</button>
          <button class="btn-secondary" disabled>禁用态</button>
        </div>
        <p class="text-xs mt-4" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
          .btn-primary / .btn-secondary · hover 主色 glow · active scale · focus ring
        </p>
      </div>
    </section>

    <!-- ====== 输入框 (Inputs) ====== -->
    <section v-if="activeTab === 'inputs'" class="space-y-6">
      <div class="glass-card p-6 space-y-4">
        <h2 class="font-h2 mb-2" style="font-size: 18px;">毛玻璃输入框</h2>
        <div class="space-y-3 max-w-md">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style="color: var(--lg-text-muted);" />
            <input class="glass-input pl-10" placeholder="搜索..." />
          </div>
          <div class="relative">
            <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style="color: var(--lg-text-muted);" />
            <input class="glass-input pl-10" placeholder="邮箱地址" type="email" />
          </div>
          <input class="glass-input" placeholder="禁用状态" disabled />
        </div>
        <p class="text-xs" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
          .glass-input · focus 主色辉光 · 8px 圆角
        </p>
      </div>
    </section>

    <!-- ====== 徽章/标签 (Badges & Tags) ====== -->
    <section v-if="activeTab === 'badges'" class="space-y-6">
      <div class="glass-card p-6 space-y-6">
        <div>
          <h2 class="font-h2 mb-4" style="font-size: 18px;">状态徽章</h2>
          <div class="flex flex-wrap gap-3">
            <span class="badge-active">启用</span>
            <span class="badge-inactive">停用</span>
          </div>
          <p class="text-xs mt-2" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
            .badge-active / .badge-inactive
          </p>
        </div>
        <div>
          <h2 class="font-h2 mb-4" style="font-size: 18px;">彩色标签</h2>
          <div class="flex flex-wrap gap-3">
            <span class="tag-green">绿色</span>
            <span class="tag-blue">蓝色</span>
            <span class="tag-purple">紫色</span>
            <span class="tag-red">红色</span>
          </div>
          <p class="text-xs mt-2" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
            .tag-green / .tag-blue / .tag-purple / .tag-red
          </p>
        </div>
      </div>
    </section>

    <!-- ====== 排版 (Typography) ====== -->
    <section v-if="activeTab === 'typography'" class="space-y-6">
      <div class="glass-card p-6 space-y-6">
        <div>
          <h2 class="font-h2 mb-4" style="font-size: 18px;">标题字体 (Manrope)</h2>
          <div class="space-y-3">
            <p class="font-h1" style="font-size: 36px;">H1 · 标题一 · 36px / 700</p>
            <p class="font-h2" style="font-size: 24px;">H2 · 标题二 · 24px / 600</p>
            <p class="section-title">section-title · 20px / 700</p>
          </div>
        </div>
        <div>
          <h2 class="font-h2 mb-4" style="font-size: 18px;">正文 (Inter)</h2>
          <p class="mb-2" style="color: var(--lg-text-primary);">正文文字 14px / 400 — 用于段落和描述内容。</p>
          <p style="color: var(--lg-text-secondary);">—— 次要文字 (--lg-text-secondary)</p>
          <p style="color: var(--lg-text-muted);">—— 弱化文字 (--lg-text-muted)</p>
        </div>
        <div>
          <h2 class="font-h2 mb-4" style="font-size: 18px;">等宽字体 (JetBrains Mono)</h2>
          <p class="font-data-display" style="font-size: 28px; color: var(--lg-text-primary);">42,195</p>
          <p class="data-label mt-2">.font-data-display / .data-label</p>
          <p class="text-xs mt-1" style="font-family: var(--font-mono); color: var(--lg-text-muted);">
            font-mono · 代码/数据/KPI 专用
          </p>
        </div>
      </div>
    </section>

    <!-- ====== 颜色 (Colors) ====== -->
    <section v-if="activeTab === 'colors'" class="space-y-6">
      <div class="glass-card p-6">
        <h2 class="font-h2 mb-4" style="font-size: 18px;">主色系</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="text-center">
            <div class="h-16 rounded-[10px] mb-2" style="background: var(--lg-primary);" />
            <span class="text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">Primary</span>
          </div>
          <div class="text-center">
            <div class="h-16 rounded-[10px] mb-2" style="background: var(--lg-primary-light);" />
            <span class="text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">Primary Light</span>
          </div>
          <div class="text-center">
            <div class="h-16 rounded-[10px] mb-2" style="background: var(--lg-surface-glass);" />
            <span class="text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">Glass Surface</span>
          </div>
          <div class="text-center">
            <div class="h-16 rounded-[10px] mb-2" style="background: var(--lg-surface-container);" />
            <span class="text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">Container</span>
          </div>
        </div>
      </div>
      <div class="glass-card p-6">
        <h2 class="font-h2 mb-4" style="font-size: 18px;">强调色</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="text-center">
            <div class="h-16 rounded-[10px] mb-2 flex items-center justify-center"
                 style="background: var(--lg-accent-blue-dim);">
              <div class="w-8 h-8 rounded-full" style="background: var(--lg-accent-blue);" />
            </div>
            <span class="text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">Blue</span>
          </div>
          <div class="text-center">
            <div class="h-16 rounded-[10px] mb-2 flex items-center justify-center"
                 style="background: var(--lg-accent-purple-dim);">
              <div class="w-8 h-8 rounded-full" style="background: var(--lg-accent-purple);" />
            </div>
            <span class="text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">Purple</span>
          </div>
          <div class="text-center">
            <div class="h-16 rounded-[10px] mb-2 flex items-center justify-center"
                 style="background: var(--lg-accent-red-dim);">
              <div class="w-8 h-8 rounded-full" style="background: var(--lg-accent-red);" />
            </div>
            <span class="text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">Red</span>
          </div>
          <div class="text-center">
            <div class="h-16 rounded-[10px] mb-2 flex items-center justify-center"
                 style="background: var(--lg-accent-yellow-dim);">
              <div class="w-8 h-8 rounded-full" style="background: var(--lg-accent-yellow);" />
            </div>
            <span class="text-xs" style="font-family: var(--font-mono); color: var(--lg-text-secondary);">Yellow</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
