/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import {
  DEFAULT_THEME_COLOR,
  isThemeColor,
  THEME_COLOR_STORAGE_KEY,
  type ThemeColorId,
} from "@/lib/theme-colors"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  defaultThemeColor?: ThemeColorId
  themeColorStorageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  themeColor: ThemeColorId
  setThemeColor: (themeColor: ThemeColorId) => void
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const THEME_VALUES: Theme[] = ["dark", "light", "system"]

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isTheme(value: string | null): value is Theme {
  if (value === null) {
    return false
  }

  return THEME_VALUES.includes(value as Theme)
}

function getSystemTheme(): ResolvedTheme {
  if (window.matchMedia(COLOR_SCHEME_QUERY).matches) {
    return "dark"
  }

  return "light"
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const editableParent = target.closest(
    "input, textarea, select, [contenteditable='true']"
  )
  if (editableParent) {
    return true
  }

  return false
}

/** localStorage 在隐私模式/受限 WebView 下可能抛异常；失败时降级为内存态 */
function readStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 忽略：偏好仍在当前会话的 React state 中生效
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  defaultThemeColor = DEFAULT_THEME_COLOR,
  themeColorStorageKey = THEME_COLOR_STORAGE_KEY,
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const storedTheme = readStoredValue(storageKey)
    if (isTheme(storedTheme)) {
      return storedTheme
    }

    return defaultTheme
  })

  const [themeColor, setThemeColorState] = React.useState<ThemeColorId>(() => {
    const storedThemeColor = readStoredValue(themeColorStorageKey)
    if (isThemeColor(storedThemeColor)) {
      return storedThemeColor
    }

    return defaultThemeColor
  })

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      setThemeState(nextTheme)
      writeStoredValue(storageKey, nextTheme)
    },
    [storageKey]
  )

  const setThemeColor = React.useCallback(
    (nextThemeColor: ThemeColorId) => {
      setThemeColorState(nextThemeColor)
      writeStoredValue(themeColorStorageKey, nextThemeColor)
    },
    [themeColorStorageKey]
  )

  const applyThemeColor = React.useCallback((nextThemeColor: ThemeColorId) => {
    document.documentElement.dataset.themeColor = nextThemeColor
  }, [])

  const applyTheme = React.useCallback(
    (nextTheme: Theme) => {
      const root = document.documentElement
      const resolvedTheme =
        nextTheme === "system" ? getSystemTheme() : nextTheme
      const restoreTransitions = disableTransitionOnChange
        ? disableTransitionsTemporarily()
        : null

      root.classList.remove("light", "dark")
      root.classList.add(resolvedTheme)

      if (restoreTransitions) {
        restoreTransitions()
      }
    },
    [disableTransitionOnChange]
  )

  React.useEffect(() => {
    applyTheme(theme)

    if (theme !== "system") {
      return undefined
    }

    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      applyTheme("system")
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, applyTheme])

  React.useEffect(() => {
    applyThemeColor(themeColor)
  }, [themeColor, applyThemeColor])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      setThemeState((currentTheme) => {
        const nextTheme =
          currentTheme === "dark"
            ? "light"
            : currentTheme === "light"
              ? "dark"
              : getSystemTheme() === "dark"
                ? "light"
                : "dark"

        writeStoredValue(storageKey, nextTheme)
        return nextTheme
      })
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [storageKey])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return
      }

      // 另一标签页 localStorage.clear()：两个 key 都回退默认值
      if (event.key === null) {
        setThemeState(defaultTheme)
        setThemeColorState(defaultThemeColor)
        return
      }

      if (event.key === storageKey) {
        if (isTheme(event.newValue)) {
          setThemeState(event.newValue)
          return
        }

        setThemeState(defaultTheme)
        return
      }

      if (event.key === themeColorStorageKey) {
        setThemeColorState(
          isThemeColor(event.newValue) ? event.newValue : defaultThemeColor
        )
      }
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultTheme, defaultThemeColor, storageKey, themeColorStorageKey])

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      themeColor,
      setThemeColor,
    }),
    [theme, setTheme, themeColor, setThemeColor]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
