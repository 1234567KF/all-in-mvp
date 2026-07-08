<script setup lang="ts">
/**
 * KpiCard — 通用 KPI 指标卡片
 *
 * 展示单个关键指标，左侧带主色发光竖条。
 * 支持: accentColor (颜色变体)、trend (趋势箭头)、loading 骨架态。
 *
 * 使用示例:
 *   <KpiCard title="总收入" value="$42.5K" :icon="DollarSign" accent-color="green"
 *            :trend="{ value: '+12.5%', direction: 'up', label: 'vs 上月' }" />
 */
import { computed } from 'vue'
import type { Component } from 'vue'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  title: string
  value: string | number
  icon?: Component
  /** 强调色: green | blue | red | purple | yellow */
  accentColor?: 'green' | 'blue' | 'red' | 'purple' | 'yellow'
  trend?: { value: string; direction: 'up' | 'down'; label?: string }
  loading?: boolean
}>(), {
  accentColor: 'green',
  loading: false,
})

const accentVars = computed(() => {
  const prefix = `--lg-accent-${props.accentColor}`
  return {
    '--kpi-accent': `var(${prefix})`,
    '--kpi-accent-dim': `var(${prefix}-dim)`,
    '--kpi-accent-border': `var(${prefix}-border)`,
    '--kpi-accent-glow': `var(${prefix}-glow)`,
  } as Record<string, string>
})
</script>

<template>
  <div
    class="glass-card p-5 relative overflow-hidden"
    :style="{ ...accentVars }"
  >
    <!-- 背景光晕 -->
    <div
      class="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 pointer-events-none"
      :style="{ background: `radial-gradient(circle, var(--kpi-accent-dim), transparent 70%)` }"
    />

    <!-- Loading 骨架 -->
    <template v-if="loading">
      <div class="space-y-3">
        <div class="skeleton-glass h-3 w-16" />
        <div class="skeleton-glass h-7 w-24" />
        <div class="skeleton-glass h-3 w-20" />
      </div>
    </template>

    <template v-else>
      <div class="kpi-accent">
        <!-- 标题行 -->
        <div class="flex items-center gap-2 mb-2">
          <component
            v-if="icon"
            :is="icon"
            class="w-4 h-4"
            style="color: var(--kpi-accent);"
          />
          <p class="data-label" style="color: var(--lg-text-secondary);">{{ title }}</p>
        </div>

        <!-- 数值 -->
        <p class="font-data-display" style="font-size: 28px; color: var(--lg-text-primary);">
          {{ value }}
        </p>

        <!-- 趋势 -->
        <div v-if="trend" class="flex items-center gap-1.5 mt-1.5">
          <TrendingUp
            v-if="trend.direction === 'up'"
            class="w-3.5 h-3.5"
            style="color: var(--lg-primary-light);"
          />
          <TrendingDown
            v-else
            class="w-3.5 h-3.5"
            style="color: var(--lg-accent-red);"
          />
          <span
            class="text-xs font-medium"
            :style="{ color: trend.direction === 'up' ? 'var(--lg-primary-light)' : 'var(--lg-accent-red)' }"
          >
            {{ trend.value }}
          </span>
          <span v-if="trend.label" class="text-xs" style="color: var(--lg-text-muted);">
            {{ trend.label }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
