// 提取自 frontend/src/pages/Login.tsx 密码切换逻辑

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface PasswordToggleInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  name?: string
  autoComplete?: string
  error?: string
  className?: string
}

export function PasswordToggleInput({
  value,
  onChange,
  placeholder = "请输入密码",
  id = "password",
  name = "password",
  autoComplete = "current-password",
  error,
  className,
}: PasswordToggleInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        name={name}
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </button>
    </div>
  )
}
