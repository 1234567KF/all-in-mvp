import {
  ArrowLeft,
  ChevronRight,
  Compass,
  LayoutDashboard,
  Palette,
  Settings,
  TableProperties,
} from "lucide-react"
import React, { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  const navigate = useNavigate()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e
    const { innerWidth, innerHeight } = window
    // Calculate normalized position between -1 and 1
    const x = (clientX - innerWidth / 2) / (innerWidth / 2)
    const y = (clientY - innerHeight / 2) / (innerHeight / 2)
    setMousePos({ x, y })
  }

  // Reset positioning when mouse leaves the screen
  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 })
  }

  // Quick navigation cards setup with 100% theme-adaptive CSS variables
  const quickLinks = [
    {
      title: "仪表盘",
      path: "/dashboard",
      icon: LayoutDashboard,
      desc: "查看核心数据与分析看板",
      color:
        "from-[var(--lg-primary-dim)] to-[var(--lg-primary-border)] hover:border-[var(--lg-primary-light)]/40 text-[var(--lg-primary-light)]",
    },
    {
      title: "组件库",
      path: "/components",
      icon: Palette,
      desc: "浏览 Liquid Glass 设计体系",
      color:
        "from-[var(--lg-accent-blue-dim)] to-[var(--lg-accent-blue-border)] hover:border-[var(--lg-accent-blue-light)]/40 text-[var(--lg-accent-blue-light)]",
    },
    {
      title: "虚拟滚动",
      path: "/virtual-table",
      icon: TableProperties,
      desc: "高吞吐量大数据表格性能测试",
      color:
        "from-[var(--lg-accent-yellow-dim)] to-[var(--lg-accent-yellow-border)] hover:border-[var(--lg-accent-yellow-light)]/40 text-[var(--lg-accent-yellow-light)]",
    },
    {
      title: "系统设置",
      path: "/settings",
      icon: Settings,
      desc: "个人信息配置与主题隔离偏好",
      color:
        "from-[var(--lg-accent-red-dim)] to-[var(--lg-accent-red-border)] hover:border-[var(--lg-accent-red-light)]/40 text-[var(--lg-accent-red-light)]",
    },
  ]

  return (
    <div
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

      {/* Background Interactive Blobs (Sized and centered to prevent top/bottom/side border clipping) */}
      <div
        className="pointer-events-none absolute top-[32%] left-[30%] h-[220px] w-[220px] rounded-full opacity-20 blur-[90px] transition-transform duration-1000 ease-out"
        style={{
          background: "var(--lg-primary)",
          transform: `translate(${mousePos.x * -40}px, ${mousePos.y * -40}px)`,
        }}
      />
      <div
        className="pointer-events-none absolute right-[30%] bottom-[30%] h-[200px] w-[200px] rounded-full opacity-20 blur-[80px] transition-transform duration-1000 ease-out"
        style={{
          background: "var(--lg-tertiary-accent)",
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
        <div className="animate-subtle-pulse pointer-events-none absolute -top-12 h-48 w-48 rounded-full bg-[var(--lg-primary-light)] blur-[60px]" />

        {/* 404 Floating Number (Green to Blue Theme-Adaptive Gradient) */}
        <div className="animate-float-number relative mb-2 text-center font-heading select-none">
          <span className="bg-gradient-to-r from-[var(--lg-primary-light)] to-[var(--lg-tertiary-accent)] bg-clip-text text-8xl font-black tracking-widest text-transparent drop-shadow-[0_0_20px_var(--lg-primary-glow)] filter md:text-9xl">
            404
          </span>
        </div>

        {/* Status Badge */}
        <div className="mb-6 flex items-center gap-1.5 rounded-full border border-[var(--lg-primary-border)] bg-[var(--lg-primary-dim)] px-3 py-1 text-xs font-semibold text-[var(--lg-primary-light)] backdrop-blur-md">
          <Compass
            className="h-3.5 w-3.5 animate-spin"
            style={{ animationDuration: "6s" }}
          />
          <span>ROUTE NOT FOUND</span>
        </div>

        {/* Card Header & Description */}
        <div className="mb-10 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            哦豁！你来到了未知的虚无之境
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            您访问的页面不存在、已被移除，或者该路由是一个未定义的空间。让我们带您回到安全的地带。
          </p>
        </div>

        {/* Call to Actions */}
        <div className="mb-12 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="btn-secondary group w-full min-w-[140px] justify-center gap-2 border border-border bg-background/50 hover:bg-background/80 sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>返回上一页</span>
          </Button>

          <Button
            onClick={() => navigate("/dashboard")}
            className="btn-primary group w-full min-w-[140px] justify-center gap-2 sm:w-auto"
          >
            <span>返回仪表盘</span>
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Button>
        </div>

        {/* Quick Links Grid */}
        <div className="w-full">
          <div className="mb-4 flex items-center justify-between px-1">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              快速探索常用模块
            </span>
            <span className="ml-4 h-px flex-1 bg-border/40"></span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quickLinks.map((link) => {
              const Icon = link.icon
              return (
                <button
                  type="button"
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="group relative w-full cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-card/30 p-4 text-left backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:bg-card/60 hover:shadow-lg focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {/* Subtle Gradient background on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${link.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  />

                  <div className="relative z-10 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground transition-all duration-300 group-hover:scale-110 group-hover:border-current/40 group-hover:text-current">
                      <Icon className="h-5 w-5 transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="flex items-center gap-1 font-heading text-sm font-semibold text-foreground transition-colors group-hover:text-current">
                        {link.title}
                        <ChevronRight className="h-3 w-3 -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                      </h3>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {link.desc}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
