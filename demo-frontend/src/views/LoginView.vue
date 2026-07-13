<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { LogIn, User, Lock, Eye, EyeOff, Sun, Moon } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const { theme, toggle: toggleTheme } = useTheme()

const username = ref('admin')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
/** 是否使用演示模式（后端不可达时降级） */
const demoFallback = ref(false)

const hintText = computed(() => {
  if (demoFallback.value) return '⚠️ 演示模式: admin / 任意密码'
  return '测试账号: admin / admin123 | sales1 / sales123'
})

async function handleLogin() {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      error.value = body.error || `登录失败 (${res.status})`
      loading.value = false
      return
    }

    const body = await res.json()
    // 存储 token 和用户信息
    localStorage.setItem('token', body.token)
    localStorage.setItem('user', JSON.stringify(body.user))
    loading.value = false
    router.push('/users')
  } catch (err: any) {
    // 后端不可达 → 降级到演示模式
    if (err.name === 'TypeError' || err.name === 'AbortError') {
      demoFallback.value = true
      // 演示模式：任意密码通过
      await new Promise(r => setTimeout(r, 500))
      error.value = ''
      loading.value = false
      router.push('/users')
    } else {
      error.value = '网络错误，请确认后端服务已启动'
      loading.value = false
    }
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 relative"
       style="
         background: radial-gradient(circle at 50% -10%, var(--lg-primary-dim) 0%, transparent 50%),
                     var(--lg-background);
         background-attachment: fixed;
       ">

    <!-- 主题切换按钮 (右上角) -->
    <button
      class="absolute top-4 right-4 btn-secondary !px-3 !py-2"
      @click="toggleTheme"
      :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
    >
      <Sun v-if="theme === 'dark'" class="w-4 h-4" />
      <Moon v-else class="w-4 h-4" />
    </button>

    <!-- 登录卡片 -->
    <div class="glass-card w-full max-w-md p-8 space-y-6">

      <!-- Logo / 标题区 -->
      <div class="text-center space-y-2">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-[12px] mb-2"
             style="background: var(--lg-primary-dim); border: 1px solid var(--lg-primary-border);">
          <LogIn class="w-6 h-6" style="color: var(--lg-primary-light);" />
        </div>
        <h1 class="font-h1" style="font-size:24px;">欢迎回来</h1>
        <p class="text-sm" style="color: var(--lg-text-secondary);">
          登录您的账户以继续
        </p>
      </div>

      <!-- 表单 -->
      <form class="space-y-4" @submit.prevent="handleLogin">
        <!-- 用户名 -->
        <div class="space-y-1.5">
          <label class="form-label">用户名</label>
          <div class="relative">
            <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style="color: var(--lg-text-muted);" />
            <input
              v-model="username"
              type="text"
              class="glass-input pl-10"
              placeholder="admin"
            />
          </div>
        </div>

        <!-- 密码 -->
        <div class="space-y-1.5">
          <label class="form-label">密码</label>
          <div class="relative">
            <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style="color: var(--lg-text-muted);" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="glass-input pl-10 pr-10"
              placeholder="输入密码"
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2"
              style="color: var(--lg-text-muted);"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- 错误提示 -->
        <div
          v-if="error"
          class="text-sm px-3 py-2 rounded-[8px]"
          style="background: var(--lg-accent-red-dim); color: var(--lg-accent-red); border: 1px solid var(--lg-accent-red-border);"
        >
          {{ error }}
        </div>

        <!-- 登录按钮 -->
        <button
          type="submit"
          class="btn-primary w-full justify-center"
          :disabled="loading"
        >
          <span v-if="loading" class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          <LogIn v-else class="w-4 h-4" />
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <!-- 底部提示 -->
      <p class="text-center text-xs" style="color: var(--lg-text-muted);">
        {{ hintText }}
      </p>
    </div>
  </div>
</template>
