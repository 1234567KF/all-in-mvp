<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft, Search, UserPlus, Shield, User, Trash2, Users,
  Mail, Calendar, Sun, Moon
} from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const { theme, toggle: toggleTheme } = useTheme()

// ------ 模拟用户数据 ------
interface UserItem {
  id: number
  name: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'active' | 'inactive'
  joinedAt: string
}

const users = ref<UserItem[]>([
  { id: 1, name: '张三', email: 'zhangsan@demo.com', role: 'admin', status: 'active', joinedAt: '2025-03-15' },
  { id: 2, name: '李四', email: 'lisi@demo.com', role: 'editor', status: 'active', joinedAt: '2025-04-02' },
  { id: 3, name: '王五', email: 'wangwu@demo.com', role: 'viewer', status: 'active', joinedAt: '2025-05-20' },
  { id: 4, name: '赵六', email: 'zhaoliu@demo.com', role: 'editor', status: 'inactive', joinedAt: '2025-06-10' },
  { id: 5, name: '孙七', email: 'sunqi@demo.com', role: 'viewer', status: 'active', joinedAt: '2025-07-01' },
])

const searchQuery = ref('')

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter(u =>
    u.name.includes(q) || u.email.toLowerCase().includes(q)
  )
})

// ------ KPI 统计 ------
const activeCount = computed(() => users.value.filter(u => u.status === 'active').length)
const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)

// ------ 角色/状态中文 ------
function roleLabel(role: string) {
  const map: Record<string, string> = { admin: '管理员', editor: '编辑者', viewer: '观察者' }
  return map[role] || role
}

function statusLabel(status: string) {
  return status === 'active' ? '启用' : '停用'
}

// ------ 操作 ------
function deleteUser(id: number) {
  users.value = users.value.filter(u => u.id !== id)
}
</script>

<template>
  <div class="min-h-screen flex flex-col"
       style="background: var(--lg-background);">

    <!-- ====== Top Bar ====== -->
    <header class="flex items-center justify-between px-6 py-4"
            style="
              background: var(--lg-surface-glass);
              backdrop-filter: blur(var(--glass-blur));
              border-bottom: 1px solid var(--lg-border);
            ">
      <div class="flex items-center gap-3">
        <button
          class="btn-secondary"
          @click="router.push('/')"
        >
          <ArrowLeft class="w-4 h-4" />
          返回登录
        </button>
        <h1 class="font-h1" style="font-size:20px;">用户管理</h1>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="btn-secondary !px-2.5 !py-2"
          @click="toggleTheme"
          :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
        >
          <Sun v-if="theme === 'dark'" class="w-4 h-4" />
          <Moon v-else class="w-4 h-4" />
        </button>

        <button class="btn-primary">
          <UserPlus class="w-4 h-4" />
          添加用户
        </button>
      </div>
    </header>

    <!-- ====== 主区域 ====== -->
    <main class="flex-1 p-6 space-y-6" style="max-width:1280px; margin:0 auto; width:100%;">

      <!-- KPI 卡片行 -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="glass-card p-5">
          <div class="kpi-accent">
            <p class="data-label">用户总数</p>
            <p class="font-data-display" style="font-size:32px;">
              {{ users.length }}
            </p>
          </div>
        </div>
        <div class="glass-card p-5">
          <div class="kpi-accent">
            <p class="data-label">活跃用户</p>
            <p class="font-data-display" style="font-size:32px;">
              {{ activeCount }}
            </p>
          </div>
        </div>
        <div class="glass-card p-5">
          <div class="kpi-accent">
            <p class="data-label">管理员</p>
            <p class="font-data-display" style="font-size:32px;">
              {{ adminCount }}
            </p>
          </div>
        </div>
      </div>

      <!-- 搜索 + 表格卡片 -->
      <div class="glass-card p-6 space-y-4">

        <!-- 搜索栏 -->
        <div class="relative max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style="color: var(--lg-text-muted);" />
          <input
            v-model="searchQuery"
            class="glass-input pl-10"
            placeholder="搜索用户名或邮箱..."
          />
        </div>

        <!-- 用户表格 -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr style="border-bottom: 1px solid var(--lg-border);">
                <th class="text-left py-3 px-4" style="color: var(--lg-text-muted); font-weight:500;">用户</th>
                <th class="text-left py-3 px-4 hidden sm:table-cell" style="color: var(--lg-text-muted); font-weight:500;">邮箱</th>
                <th class="text-left py-3 px-4" style="color: var(--lg-text-muted); font-weight:500;">角色</th>
                <th class="text-left py-3 px-4 hidden md:table-cell" style="color: var(--lg-text-muted); font-weight:500;">加入日期</th>
                <th class="text-center py-3 px-4" style="color: var(--lg-text-muted); font-weight:500;">状态</th>
                <th class="text-right py-3 px-4" style="color: var(--lg-text-muted); font-weight:500;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in filteredUsers"
                :key="user.id"
                class="glass-row"
              >
                <!-- 用户名 + 头像 -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                         :style="{
                           background: user.role === 'admin' ? 'var(--lg-primary-dim)' : 'var(--lg-secondary-dim)',
                           color: user.role === 'admin' ? 'var(--lg-primary-light)' : 'var(--lg-secondary-accent)',
                         }">
                      <Shield v-if="user.role === 'admin'" class="w-3.5 h-3.5" />
                      <User v-else class="w-3.5 h-3.5" />
                    </div>
                    <span style="color: var(--lg-text-primary); font-weight:500;">{{ user.name }}</span>
                  </div>
                </td>
                <!-- 邮箱 -->
                <td class="py-3 px-4 hidden sm:table-cell" style="color: var(--lg-text-secondary);">
                  <div class="flex items-center gap-1.5">
                    <Mail class="w-3.5 h-3.5" />
                    {{ user.email }}
                  </div>
                </td>
                <!-- 角色 -->
                <td class="py-3 px-4">
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :style="{
                          background: user.role === 'admin'
                            ? 'var(--lg-primary-dim)'
                            : user.role === 'editor'
                            ? 'var(--lg-accent-blue-dim)'
                            : 'var(--lg-secondary-dim)',
                          color: user.role === 'admin'
                            ? 'var(--lg-primary-light)'
                            : user.role === 'editor'
                            ? 'var(--lg-accent-blue-light)'
                            : 'var(--lg-secondary-accent)',
                        }">
                    {{ roleLabel(user.role) }}
                  </span>
                </td>
                <!-- 日期 -->
                <td class="py-3 px-4 hidden md:table-cell" style="color: var(--lg-text-secondary); font-family: var(--font-mono); font-size:12px;">
                  <div class="flex items-center gap-1.5">
                    <Calendar class="w-3.5 h-3.5" />
                    {{ user.joinedAt }}
                  </div>
                </td>
                <!-- 状态 -->
                <td class="py-3 px-4 text-center">
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :style="{
                          background: user.status === 'active' ? 'var(--lg-primary-dim)' : 'var(--lg-accent-red-dim)',
                          color: user.status === 'active' ? 'var(--lg-primary-light)' : 'var(--lg-accent-red-light)',
                        }">
                    <span class="w-1.5 h-1.5 rounded-full"
                          :style="{ background: user.status === 'active' ? 'var(--lg-primary-light)' : 'var(--lg-accent-red-light)' }">
                    </span>
                    {{ statusLabel(user.status) }}
                  </span>
                </td>
                <!-- 操作 -->
                <td class="py-3 px-4 text-right">
                  <button
                    class="btn-secondary !text-xs !px-3 !py-1.5"
                    @click="deleteUser(user.id)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                    删除
                  </button>
                </td>
              </tr>

              <!-- 空状态 -->
              <tr v-if="filteredUsers.length === 0">
                <td colspan="6" class="py-12 text-center" style="color: var(--lg-text-muted);">
                  <Users class="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p class="text-sm">无匹配用户</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 表底统计 -->
        <div class="flex items-center justify-between pt-2 text-xs"
             style="color: var(--lg-text-muted); font-family: var(--font-mono);">
          <span>共 {{ filteredUsers.length }} / {{ users.length }} 条</span>
          <span>Liquid Glass Design System</span>
        </div>

      </div>
    </main>
  </div>
</template>
