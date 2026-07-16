import {
  CloudLightning,
  LayoutDashboard,
  RefreshCw,
  Terminal,
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { showSuccess, showWarning } from "@/lib/toast"

export default function ServerErrorPage() {
  const navigate = useNavigate()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isRetrying, setIsRetrying] = useState(false)
  const [diagnosticsTime] = useState(() => new Date().toISOString())

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e
    const { innerWidth, innerHeight } = window
    const x = (clientX - innerWidth / 2) / (innerWidth / 2)
    const y = (clientY - innerHeight / 2) / (innerHeight / 2)
    setMousePos({ x, y })
  }

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 })
  }

  const handleRetry = () => {
    setIsRetrying(true)
    setTimeout(() => {
      setIsRetrying(false)
      showSuccess("重新连接成功", "API 网关连接已恢复，数据同步就绪。")
      navigate("/dashboard")
    }, 1500)
  }

  const handleCheckStatus = () => {
    showWarning(
      "系统运行报告",
      "API 服务当前负载较高，数据库写入延迟较高，正在通过负载均衡分流。"
    )
  }

  return (
    <main
      aria-labelledby="server-error-title"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex min-h-[80vh] w-full flex-col items-center justify-center overflow-hidden bg-transparent px-4 py-8 transition-all duration-300 ease-out md:px-8"
    >
      {/* Self-contained CSS Animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes float-number {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(0.5deg); }
        }
        .animate-float-number {
          animation: float-number 6s ease-in-out infinite;
        }
        @keyframes subtle-pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.05); }
        }
        .animate-subtle-pulse {
          animation: subtle-pulse 10s ease-in-out infinite;
        }
        @keyframes grid-glow {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.25; }
        }
        .animate-grid-glow {
          animation: grid-glow 8s ease-in-out infinite;
        }
      `,
        }}
      />

      {/* Background Cyber Grid */}
      <div
        className="animate-grid-glow pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] bg-[size:4rem_4rem]"
        style={{
          transform: `translate(${mousePos.x * 10}px, ${mousePos.y * 10}px)`,
        }}
      />

      {/* Background Interactive Blobs (Red & Purple Warning Theme) */}
      <div
        className="pointer-events-none absolute top-[32%] left-[30%] h-[220px] w-[220px] rounded-full opacity-20 blur-[90px] transition-transform duration-1000 ease-out"
        style={{
          background: "var(--lg-accent-red-light)",
          transform: `translate(${mousePos.x * -40}px, ${mousePos.y * -40}px)`,
        }}
      />
      <div
        className="pointer-events-none absolute right-[30%] bottom-[30%] h-[200px] w-[200px] rounded-full opacity-20 blur-[80px] transition-transform duration-1000 ease-out"
        style={{
          background: "var(--lg-accent-purple-light)",
          transform: `translate(${mousePos.x * -30}px, ${mousePos.y * -30}px)`,
        }}
      />

      {/* Main Container with 3D Rotate Parallax */}
      <div
        className="relative z-10 flex w-full max-w-2xl flex-col items-center transition-all duration-200 ease-out"
        style={{
          transform: `perspective(1000px) rotateX(${-mousePos.y * 6}deg) rotateY(${mousePos.x * 6}deg) translateY(${mousePos.y * -5}px)`,
        }}
      >
        {/* Glow behind the number */}
        <div className="animate-subtle-pulse pointer-events-none absolute -top-12 h-48 w-48 rounded-full bg-[var(--lg-accent-red-dim)] blur-[60px]" />

        {/* 500 Floating Number (Red to Purple Gradient) */}
        <div className="animate-float-number relative mb-2 text-center font-heading select-none">
          <span className="bg-gradient-to-r from-[var(--lg-accent-red-light)] to-[var(--lg-accent-purple-light)] bg-clip-text text-8xl font-black tracking-widest text-transparent drop-shadow-[0_0_20px_var(--lg-accent-red-glow)] filter md:text-9xl">
            500
          </span>
        </div>

        {/* Status Badge */}
        <div className="mb-6 flex items-center gap-1.5 rounded-full border border-[var(--lg-accent-red-border)] bg-[var(--lg-accent-red-dim)] px-3 py-1 text-xs font-semibold text-[var(--lg-accent-red-light)] backdrop-blur-md">
          <CloudLightning className="h-3.5 w-3.5" />
          <span>SERVER ERROR</span>
        </div>

        {/* Card Header & Description */}
        <div className="mb-8 text-center">
          <h1
            id="server-error-title"
            className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl"
          >
            服务器遇到了点麻烦
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            API
            服务端处理该资源请求时引发了未捕获的运行时异常。我们的运维监控系统已经接警，工程人员正在紧急排查。
          </p>
        </div>

        {/* Collapsible Diagnostics Panel */}
        <div className="mb-10 w-full max-w-md overflow-hidden rounded-xl border border-border/40 bg-card/20 backdrop-blur-md">
          <details className="group">
            <summary className="flex cursor-pointer items-center justify-between p-4 font-mono text-xs tracking-wider text-muted-foreground uppercase select-none hover:text-foreground">
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" />
                诊断遥测数据 (Diagnostics)
              </span>
              <span className="transition-transform duration-200 group-open:rotate-180">
                ▼
              </span>
            </summary>
            <div className="space-y-1.5 border-t border-border/30 bg-background/30 p-4 text-left font-mono text-[10px] leading-relaxed text-muted-foreground/80 select-text">
              <div>
                <span className="text-foreground">Error Code:</span>{" "}
                HTTP_500_INTERNAL_SERVER_ERROR
              </div>
              <div>
                <span className="text-foreground">Exception:</span>{" "}
                NullPointerException inside Controller layer
              </div>
              <div>
                <span className="text-foreground">Target Service:</span>{" "}
                web-api-gateway-v2
              </div>
              <div>
                <span className="text-foreground">Telemetry Time:</span>{" "}
                {diagnosticsTime}
              </div>
            </div>
          </details>
        </div>

        {/* Call to Actions */}
        <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            onClick={handleCheckStatus}
            variant="outline"
            className="btn-secondary group w-full min-w-[140px] justify-center gap-2 border border-border bg-background/50 hover:bg-background/80 sm:w-auto"
          >
            <span>系统健康监控</span>
          </Button>

          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            className="btn-primary w-full min-w-[140px] justify-center gap-2 sm:w-auto"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
            />
            <span>{isRetrying ? "重新连接中..." : "重新连接服务器"}</span>
          </Button>

          <Button
            onClick={() => navigate("/dashboard")}
            variant="outline"
            className="btn-secondary w-full min-w-[140px] justify-center gap-2 border-[var(--lg-primary-border)] bg-background/30 text-[var(--lg-primary-light)] hover:bg-[var(--lg-primary-dim)] sm:w-auto"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>返回主面板</span>
          </Button>
        </div>
      </div>
    </main>
  )
}
