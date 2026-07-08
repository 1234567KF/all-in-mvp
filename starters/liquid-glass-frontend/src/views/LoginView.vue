<script setup lang="ts">
/**
 * LoginView — 登录页示例
 *
 * 演示: 毛玻璃表单卡片、输入框图标、密码显隐切换、
 *       loading 态、错误态、表单验证。
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { LogIn, Mail, Lock, Eye, EyeOff, Sun, Moon, ArrowLeft } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const router = useRouter()
const { theme, toggle: toggleTheme } = useTheme()

const email = ref('admin@demo.com')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''
  if (!email.value || !password.value) {
    error.value = '请输入邮箱和密码'
    return
  }
  loading.value = true
  // 模拟异步登录
  await new Promise(r => setTimeout(r, 800))
  loading.value = false
  router.push('/dashboard')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 relative"
       style="
         background: radial-gradient(circle at 50% -10%, var(--lg-primary-dim) 0%, transparent 50%),
                     var(--lg-background);
         background-attachment: fixed;
       ">

    <!-- ====== 背景装饰 ====== -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-32 right-1/4 w-[400px] h-[400px] rounded-full opacity-15 animate-blob"
           style="background: radial-gradient(circle, var(--lg-primary-dim), transparent 70%);" />
      <div class="absolute -bottom-32 left-1/4 w-[350px] h-[350px] rounded-full opacity-10 animate-blob animation-delay-2000"
           style="background: radial-gradient(circle, var(--lg-accent-purple-dim), transparent 70%);" />
    </div>

    <!-- 返回 + 主题切换 -->
    <div class="fixed top-4 left-4 right-4 flex items-center justify-between z-20">
      <button class="btn-secondary !px-3 !py-2" @click="router.push('/')">
        <ArrowLeft class="w-4 h-4" />
        <span class="hidden sm:inline ml-1">返回首页</span>
      </button>
      <button class="btn-secondary !px-3 !py-2" @click="toggleTheme"
              :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'">
        <Sun v-if="theme === 'dark'" class="w-4 h-4" />
        <Moon v-else class="w-4 h-4" />
      </button>
    </div>

    <!-- ====== 登录卡片 ====== -->
    <div class="glass-card w-full max-w-md p-8 space-y-6 relative z-10">
      <!-- 标题区 -->
      <div class="text-center space-y-2">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-[12px] mb-2"
             style="background: var(--lg-primary-dim); border: 1px solid var(--lg-primary-border);">
          <LogIn class="w-6 h-6" style="color: var(--lg-primary-light);" />
        </div>
        <h1 class="font-h1" style="font-size: 24px;">欢迎回来</h1>
        <p class="text-sm" style="color: var(--lg-text-secondary);">登录您的账户以继续</p>
      </div>

      <!-- 表单 -->
      <form class="space-y-4" @submit.prevent="handleLogin">
        <!-- 邮箱 -->
        <div class="space-y-1.5">
          <label class="form-label">邮箱地址</label>
          <div class="relative">
            <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style="color: var(--lg-text-muted);" />
            <input
              v-model="email"
              type="email"
              class="glass-input pl-10"
              placeholder="admin@demo.com"
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
          <span v-if="loading" class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <LogIn v-else class="w-4 h-4" />
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <!-- 底部提示 -->
      <p class="text-center text-xs" style="color: var(--lg-text-muted);">
        演示账户: admin@demo.com / 任意密码
      </p>
    </div>
  </div>
</template>
