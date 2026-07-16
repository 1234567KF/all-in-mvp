import { Moon, Sun, SunMoon } from "lucide-react"

import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === "dark") {
      setTheme("light")
    } else if (theme === "light") {
      setTheme("system")
    } else {
      setTheme("dark")
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="size-10 rounded-full text-[var(--lg-text-secondary)] hover:bg-[var(--lg-surface-high)] hover:text-[var(--lg-text-primary)]"
    >
      {theme === "system" ? (
        <SunMoon className="size-5" />
      ) : theme === "dark" ? (
        <Moon className="size-5" />
      ) : (
        <Sun className="size-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
