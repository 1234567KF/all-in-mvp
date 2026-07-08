<script setup lang="ts">
/**
 * DashboardView — 仪表盘示例页
 *
 * 演示: KPI 卡片行 (KpiCard 组件)、搜索筛选、数据表格、空状态、分页。
 * 所有数据为 mock，展示设计系统在数据密集型页面的表现力。
 */
import { ref, computed } from 'vue'
import {
  DollarSign, Users, ShoppingCart, TrendingUp,
  Search, Mail, Calendar, Shield, User, Trash2, ChevronLeft, ChevronRight
} from 'lucide-vue-next'
import KpiCard from '@/components/shared/KpiCard.vue'

// ── KPI 数据 ──
const kpiLoading = ref(false)
const kpis = [
  { title: '总收入', value: '$42.5K', icon: DollarSign, accentColor: 'green' as const, trend: { value: '+12.5%', direction: 'up' as const, label: 'vs 上月' } },
  { title: '订单数', value: '1,284', icon: ShoppingCart, accentColor: 'blue' as const, trend: { value: '+8.2%', direction: 'up' as const, label: 'vs 上月' } },
  { title: '活跃用户', value: '3,421', icon: Users, accentColor: 'purple' as const, trend: { value: '+23.1%', direction: 'up' as const, label: 'vs 上月' } },
  { title: '转化率', value: '3.24%', icon: TrendingUp, accentColor: 'yellow' as const, trend: { value: '-0.4%', direction: 'down' as const, label: 'vs 上月' } },
]

// ── 表格数据 ──
interface Order {
  id: number
  customer: string
  email: string
  amount: number
  status: 'completed' | 'pending' | 'cancelled'
  date: string
}
const orders = ref<Order[]>([
  { id: 1, customer: '张三', email: 'zhangsan@demo.com', amount: 1280, status: 'completed', date: '2025-07-01' },
  { id: 2, customer: '李四', email: 'lisi@demo.com', amount: 2450, status: 'completed', date: '2025-07-02' },
  { id: 3, customer: '王五', email: 'wangwu@demo.com', amount: 890, status: 'pending', date: '2025-07-03' },
  { id: 4, customer: '赵六', email: 'zhaoliu@demo.com', amount: 3600, status: 'completed', date: '2025-07-04' },
  { id: 5, customer: '孙七', email: 'sunqi@demo.com', amount: 150, status: 'cancelled', date: '2025-07-05' },
  { id: 6, customer: '周八', email: 'zhouba@demo.com', amount: 5100, status: 'completed', date: '2025-07-06' },
])

const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = 5

const filteredOrders = computed(() => {
  if (!searchQuery.value) return orders.value
  const q = searchQuery.value.toLowerCase()
  return orders.value.filter(o =>
    o.customer.includes(q) || o.email.toLowerCase().includes(q)
  )
})

const totalPages = computed(() => Math.ceil(filteredOrders.value.length / pageSize))
const pagedOrders = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredOrders.value.slice(start, start + pageSize)
})

// ── 工具函数 ──
function statusLabel(s: string) {
  const map: Record<string, string> = { completed: '已完成', pending: '待处理', cancelled: '已取消' }
  return map[s] || s
}
function statusClass(s: string) {
  return s === 'completed' ? 'tag-green' : s === 'pending' ? 'tag-yellow' : 'tag-red'
}
function deleteOrder(id: number) {
  orders.value = orders.value.filter(o => o.id !== id)
}
</script>

<template>
  <div class="p-4 lg:p-6 space-y-6" style="max-width: 1280px; margin: 0 auto;">

    <!-- ====== 页面标题 ====== -->
    <div>
      <h1 class="font-h1" style="font-size: 24px;">仪表盘</h1>
      <p class="text-sm mt-1" style="color: var(--lg-text-secondary);">数据概览与订单管理示例</p>
    </div>

    <!-- ====== KPI 卡片行 ====== -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        v-for="kpi in kpis"
        :key="kpi.title"
        :title="kpi.title"
        :value="kpi.value"
        :icon="kpi.icon"
        :accent-color="kpi.accentColor"
        :trend="kpi.trend"
        :loading="kpiLoading"
      />
    </div>

    <!-- ====== 数据表格卡片 ====== -->
    <div class="glass-card p-6 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 class="font-h2" style="font-size: 18px;">最近订单</h2>

        <!-- 搜索 -->
        <div class="relative w-full sm:w-64">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style="color: var(--lg-text-muted);" />
          <input
            v-model="searchQuery"
            class="glass-input pl-10 !py-2"
            placeholder="搜索客户或邮箱..."
          />
        </div>
      </div>

      <!-- 表格 -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr style="border-bottom: 1px solid var(--lg-border);">
              <th class="text-left py-3 px-4 font-medium" style="color: var(--lg-text-muted);">客户</th>
              <th class="text-left py-3 px-4 font-medium hidden sm:table-cell" style="color: var(--lg-text-muted);">邮箱</th>
              <th class="text-right py-3 px-4 font-medium" style="color: var(--lg-text-muted);">金额</th>
              <th class="text-center py-3 px-4 font-medium" style="color: var(--lg-text-muted);">状态</th>
              <th class="text-right py-3 px-4 font-medium hidden md:table-cell" style="color: var(--lg-text-muted);">日期</th>
              <th class="text-right py-3 px-4 font-medium" style="color: var(--lg-text-muted);">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in pagedOrders"
              :key="order.id"
              class="glass-row"
            >
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center"
                       :style="{
                         background: order.status === 'completed' ? 'var(--lg-primary-dim)' : 'var(--lg-secondary-dim)',
                         color: order.status === 'completed' ? 'var(--lg-primary-light)' : 'var(--lg-secondary-accent)',
                       }">
                    <User class="w-3 h-3" />
                  </div>
                  <span style="color: var(--lg-text-primary); font-weight: 500;">{{ order.customer }}</span>
                </div>
              </td>
              <td class="py-3 px-4 hidden sm:table-cell" style="color: var(--lg-text-secondary);">
                <div class="flex items-center gap-1">
                  <Mail class="w-3 h-3" />
                  {{ order.email }}
                </div>
              </td>
              <td class="py-3 px-4 text-right" style="font-family: var(--font-mono); color: var(--lg-text-primary); font-weight: 500;">
                ¥{{ order.amount.toLocaleString() }}
              </td>
              <td class="py-3 px-4 text-center">
                <span :class="['inline-block px-2 py-0.5 rounded text-xs font-medium', statusClass(order.status)]">
                  {{ statusLabel(order.status) }}
                </span>
              </td>
              <td class="py-3 px-4 text-right hidden md:table-cell"
                  style="color: var(--lg-text-secondary); font-family: var(--font-mono); font-size: 12px;">
                <div class="flex items-center justify-end gap-1">
                  <Calendar class="w-3 h-3" />
                  {{ order.date }}
                </div>
              </td>
              <td class="py-3 px-4 text-right">
                <button
                  class="btn-secondary !text-xs !px-2.5 !py-1.5"
                  @click="deleteOrder(order.id)"
                >
                  <Trash2 class="w-3 h-3" />
                </button>
              </td>
            </tr>

            <!-- 空状态 -->
            <tr v-if="pagedOrders.length === 0">
              <td colspan="6" class="py-16 text-center">
                <Search class="w-8 h-8 mx-auto mb-2 opacity-30" style="color: var(--lg-text-muted);" />
                <p class="text-sm" style="color: var(--lg-text-muted);">无匹配订单</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="flex items-center justify-between pt-2">
        <span class="text-xs" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
          共 {{ filteredOrders.length }} 条
        </span>
        <div class="flex items-center gap-1">
          <button
            class="btn-secondary !px-2 !py-1.5"
            :disabled="currentPage <= 1"
            @click="currentPage--"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
          </button>
          <span class="text-xs px-3" style="color: var(--lg-text-muted); font-family: var(--font-mono);">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            class="btn-secondary !px-2 !py-1.5"
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          >
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
