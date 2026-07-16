import { ArrowLeft, KeyRound, LayoutDashboard, ShieldAlert } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import CountdownRedirect from "@/components/shared/CountdownRedirect"
import { Button } from "@/components/ui/button"
import { showInfo } from "@/lib/toast"

export default function ForbiddenPage() {
  const navigate = useNavigate()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

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

  const handleRequestAccess = () => {
    showInfo(
      "权限申请已提交",
      "管理员正在处理您的请求，审批结果将以系统通知形式送达。"
    )
  }

  return (
    <main
      aria-labelledby="forbidden-title"
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
          50% { transform: translateY(-10px) rotate(-0.5deg); }
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

      {/* Background Interactive Blobs (Yellow/Warning Accent) */}
      <div
        className="pointer-events-none absolute top-[32%] left-[30%] h-[220px] w-[220px] rounded-full opacity-20 blur-[90px] transition-transform duration-1000 ease-out"
        style={{
          background: "var(--lg-accent-yellow-light)",
          transform: `translate(${mousePos.x * -40}px, ${mousePos.y * -40}px)`,
        }}
      />
      <div
        className="pointer-events-none absolute right-[30%] bottom-[30%] h-[200px] w-[200px] rounded-full opacity-20 blur-[80px] transition-transform duration-1000 ease-out"
        style={{
          background: "var(--lg-accent-red-light)",
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
        <div className="animate-subtle-pulse pointer-events-none absolute -top-12 h-48 w-48 rounded-full bg-[var(--lg-accent-yellow-dim)] blur-[60px]" />

        {/* 403 Floating Number (Red-to-Yellow Gradient) */}
        <div className="animate-float-number relative mb-2 text-center font-heading select-none">
          <span className="bg-gradient-to-r from-[var(--lg-accent-red-light)] to-[var(--lg-accent-yellow-light)] bg-clip-text text-8xl font-black tracking-widest text-transparent drop-shadow-[0_0_20px_var(--lg-accent-yellow-glow)] filter md:text-9xl">
            403
          </span>
        </div>

        {/* Status Badge */}
        <div className="mb-6 flex items-center gap-1.5 rounded-full border border-[var(--lg-accent-yellow-border)] bg-[var(--lg-accent-yellow-dim)] px-3 py-1 text-xs font-semibold text-[var(--lg-accent-yellow-light)] backdrop-blur-md">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>ACCESS FORBIDDEN</span>
        </div>

        {/* Card Header & Description */}
        <div className="mb-8 text-center">
          <h1
            id="forbidden-title"
            className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl"
          >
            您当前的帐户没有访问权限
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            对不起，您尚未获得进入此受保护区域的授权密钥。如确需访问，您可以向系统管理员提交访问特权申请。
          </p>
        </div>

        {/* Countdown Autonavigate */}
        <CountdownRedirect
          seconds={15}
          redirectTo="/dashboard"
          label="秒后将自动返回主控制台"
          className="mb-8"
        />

        {/* Call to Actions */}
        <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="btn-secondary group w-full min-w-[140px] justify-center gap-2 border border-border bg-background/50 hover:bg-background/80 sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>返回上一页</span>
          </Button>

          <Button
            onClick={handleRequestAccess}
            variant="outline"
            className="btn-secondary w-full min-w-[140px] justify-center gap-2 border-[var(--lg-accent-yellow-border)] bg-background/30 text-[var(--lg-accent-yellow-light)] hover:bg-[var(--lg-accent-yellow-dim)] sm:w-auto"
          >
            <KeyRound className="h-4 w-4" />
            <span>申请访问权限</span>
          </Button>

          <Button
            onClick={() => navigate("/dashboard")}
            className="btn-primary w-full min-w-[140px] justify-center gap-2 sm:w-auto"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>前往主面板</span>
          </Button>
        </div>
      </div>
    </main>
  )
}
