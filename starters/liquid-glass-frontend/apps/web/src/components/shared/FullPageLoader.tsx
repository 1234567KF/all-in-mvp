interface FullPageLoaderProps {
  message?: string
  blur?: "sm" | "md" | "lg" | "xl"
}

export default function FullPageLoader({
  message = "正在加载资源，请稍候...",
  blur = "xl",
}: FullPageLoaderProps) {
  const blurClasses = {
    sm: "backdrop-blur-sm",
    md: "backdrop-blur-md",
    lg: "backdrop-blur-lg",
    xl: "backdrop-blur-xl",
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/40 ${blurClasses[blur]} transition-all duration-300 ease-in-out`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes float-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
        .animate-float-pulse {
          animation: float-pulse 2s ease-in-out infinite;
        }
      `,
        }}
      />

      <div className="relative flex items-center justify-center">
        {/* Outer glowing ring */}
        <div className="animate-spin-slow absolute h-16 w-16 rounded-full border-2 border-[var(--lg-primary-light)] border-t-transparent opacity-60" />
        {/* Inner reverse rotating ring */}
        <div
          className="animate-spin-slow absolute h-10 w-10 rounded-full border border-[var(--lg-tertiary-accent)] border-b-transparent opacity-80"
          style={{ animationDirection: "reverse", animationDuration: "1.2s" }}
        />
        {/* Center glass dot */}
        <div className="animate-float-pulse h-4 w-4 rounded-full bg-[var(--lg-primary)] shadow-[0_0_12px_var(--lg-primary-glow)]" />
      </div>

      {message && (
        <p className="mt-6 animate-pulse text-sm font-semibold tracking-wide text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  )
}
