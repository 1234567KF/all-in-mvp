import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

export interface CountdownRedirectProps {
  seconds?: number
  redirectTo: string
  label?: string
  className?: string
}

export default function CountdownRedirect({
  seconds = 5,
  redirectTo,
  label = "秒后将自动跳转",
  className = "",
}: CountdownRedirectProps) {
  const navigate = useNavigate()
  const [timeLeft, setTimeLeft] = useState(seconds)

  useEffect(() => {
    if (timeLeft <= 0) {
      navigate(redirectTo)
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, navigate, redirectTo])

  // Circular SVG ring settings
  const radius = 13
  const strokeWidth = 2.5
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    timeLeft > 0
      ? circumference - (timeLeft / seconds) * circumference
      : circumference

  return (
    <div
      className={`flex items-center gap-2.5 text-xs font-medium text-muted-foreground ${className}`}
    >
      {/* Ticking Progress Circle */}
      <div
        className="relative flex size-9 items-center justify-center"
        aria-hidden="true"
      >
        <svg className="size-full -rotate-90" viewBox="0 0 36 36">
          {/* Base track circle */}
          <circle
            cx="18"
            cy="18"
            r={radius}
            className="fill-none stroke-border/20"
            strokeWidth={strokeWidth}
          />
          {/* Active progress circle */}
          <circle
            cx="18"
            cy="18"
            r={radius}
            className="fill-none stroke-[var(--lg-primary-light)] transition-all duration-1000 ease-linear"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Remaining Seconds Text */}
        <span className="absolute font-mono text-[10px] font-bold text-foreground">
          {timeLeft}
        </span>
      </div>

      <span aria-live="polite">
        {timeLeft} {label}
      </span>
    </div>
  )
}
