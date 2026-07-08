<script setup lang="ts">
/**
 * AppLayout — 侧边栏 + 顶栏 + 内容区
 *
 * 侧边栏展示导航菜单，顶栏展示标题和主题切换。
 * 移动端侧边栏通过 overlay 展开。
 */
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  LayoutDashboard, Palette, LogIn, Home, Menu, X,
  Sun, Moon, ChevronLeft, ChevronRight
} from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const route = useRoute()
const { theme, toggle: toggleTheme } = useTheme()

// ── 侧边栏折叠 ──
const collapsed = ref(false)
const mobileOpen = ref(false)

// ── 导航菜单 ──
const navItems = [
  { path: '/', name: 'home', label: '首页', icon: Home },
  { path: '/dashboard', name: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { path: '/components', name: 'components', label: '组件展示', icon: Palette },
]

const isActive = (name: string) => route.name === name

function navigate(path: string) {
  router.push(path)
  mobileOpen.value = false
}
</script>

<template>
  <div class="flex h-screen overflow-hidden"
       style="background: var(--lg-background);">

    <!-- ====== 移动端遮罩 ====== -->
    <div
      v-if="mobileOpen"
      class="fixed inset-0 z-40 lg:hidden"
      style="background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);"
      @click="mobileOpen = false"
    />

    <!-- ====== 侧边栏 ====== -->
    <aside
      :class="[
        'fixed lg:relative z-50 h-full transition-all duration-300 flex flex-col',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        collapsed ? 'w-[72px]' : 'w-[256px]',
      ]"
      style="
        background: var(--sidebar);
        border-right: 1px solid var(--sidebar-border);
      "
    >
      <!-- Logo 区 -->
      <div
        class="flex items-center h-16 px-4 border-b shrink-0"
        :class="collapsed ? 'justify-center' : 'justify-between'"
        style="border-color: var(--sidebar-border);"
      >
        <div
          v-show="!collapsed"
          class="flex items-center gap-2 cursor-pointer"
          @click="navigate('/')"
        >
          <div class="w-8 h-8 rounded-[10px] flex items-center justify-center"
               style="background: var(--lg-primary-dim); border: 1px solid var(--lg-primary-border);">
            <span class="text-sm font-bold" style="color: var(--lg-primary-light); font-family: var(--font-mono);">LG</span>
          </div>
          <span class="font-semibold text-sm" style="color: var(--sidebar-foreground);">
            Liquid Glass
          </span>
        </div>
        <button
          class="hidden lg:flex items-center justify-center w-8 h-8 rounded-[8px] transition-colors"
          style="color: var(--lg-text-muted);"
          @click="collapsed = !collapsed"
        >
          <ChevronLeft v-if="!collapsed" class="w-4 h-4" />
          <ChevronRight v-else class="w-4 h-4" />
        </button>
        <button
          class="lg:hidden flex items-center justify-center w-8 h-8 rounded-[8px]"
          style="color: var(--lg-text-muted);"
          @click="mobileOpen = false"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- 导航菜单 -->
      <nav class="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <button
          v-for="item in navItems"
          :key="item.name"
          @click="navigate(item.path)"
          :class="[
            'w-full flex items-center rounded-[10px] transition-all duration-200 text-sm',
            collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5 gap-3',
          ]"
          :style="{
            background: isActive(item.name) ? 'var(--sidebar-active-hover-bg)' : 'transparent',
            color: isActive(item.name) ? 'var(--sidebar-primary)' : 'var(--lg-text-secondary)',
            border: isActive(item.name) ? '1px solid var(--sidebar-active-hover-border)' : '1px solid transparent',
          }"
          :title="collapsed ? item.label : ''"
        >
          <component :is="item.icon" class="w-4 h-4 shrink-0" />
          <span v-show="!collapsed">{{ item.label }}</span>
        </button>
      </nav>

      <!-- 底部操作区 -->
      <div class="px-3 py-4 border-t shrink-0" style="border-color: var(--sidebar-border);">
        <!-- 主题切换 -->
        <button
          @click="toggleTheme"
          :class="[
            'w-full flex items-center rounded-[10px] transition-all duration-200 text-sm',
            collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5 gap-3',
          ]"
          style="color: var(--lg-text-secondary);"
          :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
        >
          <Sun v-if="theme === 'dark'" class="w-4 h-4 shrink-0" />
          <Moon v-else class="w-4 h-4 shrink-0" />
          <span v-show="!collapsed">{{ theme === 'dark' ? '浅色模式' : '深色模式' }}</span>
        </button>

        <!-- 登录入口 -->
        <button
          @click="navigate('/login')"
          :class="[
            'w-full flex items-center rounded-[10px] transition-all duration-200 text-sm mt-1',
            collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5 gap-3',
          ]"
          style="color: var(--lg-text-muted);"
          :title="collapsed ? '登录页' : ''"
        >
          <LogIn class="w-4 h-4 shrink-0" />
          <span v-show="!collapsed">登录页</span>
        </button>
      </div>
    </aside>

    <!-- ====== 主区域 ====== -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶栏 -->
      <header
        class="flex items-center justify-between h-16 px-4 lg:px-6 shrink-0"
        style="
          background: var(--lg-surface-glass);
          backdrop-filter: blur(var(--glass-blur));
          border-bottom: 1px solid var(--lg-border);
        "
      >
        <div class="flex items-center gap-3">
          <button
            class="lg:hidden flex items-center justify-center w-8 h-8 rounded-[8px]"
            style="color: var(--lg-text-primary);"
            @click="mobileOpen = true"
          >
            <Menu class="w-5 h-5" />
          </button>
          <h1 class="font-h1" style="font-size: 18px;">
            {{ navItems.find(i => i.name === route.name)?.label || 'Liquid Glass Starter' }}
          </h1>
        </div>

        <div class="flex items-center gap-2">
          <!-- 移动端主题切换 -->
          <button
            class="lg:hidden btn-secondary !px-2.5 !py-2"
            @click="toggleTheme"
          >
            <Sun v-if="theme === 'dark'" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>
          <span class="text-xs hidden sm:inline" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
            Vue 3 · shadcn/vue · Tailwind v4
          </span>
        </div>
      </header>

      <!-- 内容区 -->
      <main class="flex-1 overflow-y-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>
