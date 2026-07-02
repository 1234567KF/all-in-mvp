import { ref, watchEffect } from 'vue'

const STORAGE_KEY = 'lg-theme'

// 初始化：localStorage > 系统偏好 > dark
function getInitial(): 'dark' | 'light' {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

const theme = ref<'dark' | 'light'>(getInitial())

// 同步 class 到 <html>
watchEffect(() => {
  const root = document.documentElement
  if (theme.value === 'light') {
    root.classList.add('light')
    root.classList.remove('dark')
  } else {
    root.classList.add('dark')
    root.classList.remove('light')
  }
  localStorage.setItem(STORAGE_KEY, theme.value)
})

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggle }
}
