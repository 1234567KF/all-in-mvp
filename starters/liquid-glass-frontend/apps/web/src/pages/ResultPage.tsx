import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronRight,
  CornerDownLeft,
  ExternalLink,
  Info,
  Printer,
} from "lucide-react"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import ResultCard from "@/components/shared/ResultCard"
import { Button } from "@/components/ui/button"
import { showInfo } from "@/lib/toast"

type ResultType = "success" | "error" | "warning" | "info"

export default function ResultPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialType = (searchParams.get("status") ?? "success") as ResultType
  const [activeTab, setActiveTab] = useState<ResultType>(initialType)

  const handleActionClick = (actionName: string) => {
    showInfo("操作触发", `您点击了动作：${actionName}`)
  }

  // Define details structure for each state's "extra" panel
  const renderExtraContent = () => {
    switch (activeTab) {
      case "success":
        return (
          <div className="space-y-2 font-sans text-xs text-muted-foreground">
            <div className="flex justify-between border-b border-border/20 pb-1.5">
              <span>付款交易 ID:</span>
              <span className="font-mono font-semibold text-foreground">
                TX_993021873091
              </span>
            </div>
            <div className="flex justify-between border-b border-border/20 pb-1.5">
              <span>收款账户:</span>
              <span className="text-foreground">
                billing@liquid-glass.design
              </span>
            </div>
            <div className="flex justify-between">
              <span>实付金额:</span>
              <span className="font-mono font-bold text-[var(--lg-primary-light)]">
                $199.00 USD
              </span>
            </div>
          </div>
        )
      case "error":
        return (
          <div className="space-y-2 font-sans text-xs text-muted-foreground">
            <div className="flex justify-between border-b border-border/20 pb-1.5">
              <span>错误接口:</span>
              <span className="font-mono text-[var(--lg-error-accent)]">
                /api/v1/billing/checkout
              </span>
            </div>
            <div className="flex justify-between border-b border-border/20 pb-1.5">
              <span>服务器响应码:</span>
              <span className="font-mono text-foreground">
                ERR_INSUFFICIENT_FUNDS (402)
              </span>
            </div>
            <div className="mt-1 flex flex-col gap-1 text-[11px] leading-relaxed">
              <span>建议解决方案:</span>
              <span className="text-foreground">
                • 确认您绑定的信用卡额度是否充足。
              </span>
              <span className="text-foreground">
                • 尝试更换其他支付渠道或银行卡重试。
              </span>
            </div>
          </div>
        )
      case "warning":
        return (
          <div className="space-y-2 font-sans text-xs text-muted-foreground">
            <div className="flex justify-between border-b border-border/20 pb-1.5">
              <span>当前配置状态:</span>
              <span className="font-semibold text-[var(--lg-warning-accent)]">
                半同步就绪 (Unsynced Metadata)
              </span>
            </div>
            <div className="mt-1 flex flex-col gap-1 text-[11px] leading-relaxed">
              <span>潜在隐患:</span>
              <span className="text-foreground">
                • 数据已写入内存缓冲，但尚未刷入物理磁盘。
              </span>
              <span className="text-foreground">
                • 此时断电或强行关闭服务可能导致最近 5 秒的数据丢失。
              </span>
            </div>
          </div>
        )
      case "info":
        return (
          <div className="space-y-2 font-sans text-xs text-muted-foreground">
            <div className="flex justify-between border-b border-border/20 pb-1.5">
              <span>系统运行版本:</span>
              <span className="font-mono font-semibold text-foreground">
                v0.1.0-alpha.5
              </span>
            </div>
            <div className="flex justify-between">
              <span>沙箱节点:</span>
              <span className="text-foreground">
                Sandbox-Cluster-Node-03 (Singapore)
              </span>
            </div>
          </div>
        )
    }
  }

  // Define action buttons for each state
  const renderActions = () => {
    switch (activeTab) {
      case "success":
        return (
          <>
            <Button
              onClick={() => handleActionClick("打印收据")}
              variant="outline"
              className="btn-secondary w-full justify-center gap-1.5 border-border bg-background/40 sm:w-auto"
            >
              <Printer className="size-4" />
              <span>打印收据</span>
            </Button>
            <Button
              onClick={() => handleActionClick("查看交易详情")}
              variant="outline"
              className="btn-secondary w-full justify-center gap-1.5 border-border bg-background/40 sm:w-auto"
            >
              <span>查看交易详情</span>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              onClick={() => navigate("/dashboard")}
              className="btn-primary w-full justify-center gap-1.5 sm:w-auto"
            >
              <span>返回控制台</span>
            </Button>
          </>
        )
      case "error":
        return (
          <>
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="btn-secondary w-full justify-center gap-1.5 border-border bg-background/40 sm:w-auto"
            >
              <CornerDownLeft className="size-4" />
              <span>返回修改表单</span>
            </Button>
            <Button
              onClick={() => handleActionClick("联系技术支持")}
              className="btn-primary text-destructive-foreground w-full justify-center gap-1.5 border-none bg-destructive hover:bg-destructive/90 sm:w-auto"
              style={{
                background: "var(--lg-error-container)",
                color: "var(--lg-error-accent)",
              }}
            >
              <span>联系技术支持</span>
            </Button>
          </>
        )
      case "warning":
        return (
          <>
            <Button
              onClick={() => handleActionClick("重新配置参数")}
              variant="outline"
              className="btn-secondary w-full justify-center gap-1.5 border-border bg-background/40 sm:w-auto"
            >
              <span>重新配置参数</span>
            </Button>
            <Button
              onClick={() => handleActionClick("强制刷盘写入")}
              className="btn-primary w-full justify-center gap-1.5 sm:w-auto"
            >
              <span>强制刷盘写入</span>
            </Button>
          </>
        )
      case "info":
        return (
          <>
            <Button
              onClick={() => handleActionClick("查看配置指南")}
              variant="outline"
              className="btn-secondary w-full justify-center gap-1.5 border-border bg-background/40 sm:w-auto"
            >
              <ExternalLink className="size-4" />
              <span>查看配置指南</span>
            </Button>
            <Button
              onClick={() => navigate("/dashboard")}
              className="btn-primary w-full justify-center gap-1.5 sm:w-auto"
            >
              <span>我知道了</span>
            </Button>
          </>
        )
    }
  }

  // Card text definitions
  const titles = {
    success: "支付交易已成功提交",
    error: "支付交易处理失败",
    warning: "系统部分元数据未完全同步",
    info: "关于沙箱环境节点的提示",
  }

  const descriptions = {
    success:
      "我们已成功收到您的付款！系统已实时激活了专业版（Pro）席位，发票电子凭证已同步发送至您的注册邮箱，请注意查收。",
    error:
      "由于网关扣款模块出现异常，这笔交易被拒绝。请参考下方的排查建议，确认您的扣款渠道正常后再尝试重新支付。",
    warning:
      "系统检测到部分数据仍在写入内存缓冲中，尚未完全归档至物理磁盘。强行拔除节点或断开物理连接可能会导致微量元数据丢失。",
    info: "您当前正处于亚太地区（新加坡）的测试沙箱集群中。该集群的数据将定期在每周日 02:00 进行清空重置，请勿存放生产业务数据。",
  }

  const tabItems = [
    {
      id: "success",
      label: "成功反馈",
      icon: Check,
      activeClass:
        "border-[var(--lg-primary-border)] bg-[var(--lg-primary-dim)] text-[var(--lg-primary-light)]",
    },
    {
      id: "error",
      label: "失败反馈",
      icon: AlertCircle,
      activeClass:
        "border-[var(--lg-error-container)] bg-[var(--lg-error-container)]/10 text-[var(--lg-error-accent)]",
    },
    {
      id: "warning",
      label: "警告反馈",
      icon: AlertTriangle,
      activeClass:
        "border-[var(--lg-warning-accent)]/30 bg-[var(--lg-warning-accent)]/10 text-[var(--lg-warning-accent)]",
    },
    {
      id: "info",
      label: "常规信息",
      icon: Info,
      activeClass:
        "border-[var(--lg-info-accent)]/30 bg-[var(--lg-info-accent)]/10 text-[var(--lg-info-accent)]",
    },
  ] as const

  return (
    <div className="flex w-full flex-col items-center justify-center py-6">
      {/* Switch Tabs Panel */}
      <div
        role="tablist"
        aria-label="操作结果状态切换"
        className="mb-10 flex flex-wrap justify-center gap-2.5 rounded-2xl border border-border/40 bg-card/25 p-2 backdrop-blur-md"
      >
        {tabItems.map((item) => {
          const TabIcon = item.icon
          const isSelected = activeTab === item.id
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`result-panel-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border border-transparent px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                isSelected
                  ? item.activeClass
                  : "text-muted-foreground hover:bg-card/40 hover:text-foreground"
              }`}
            >
              <TabIcon className="size-4" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Render Dynamic Result Card */}
      <div role="tabpanel" id={`result-panel-${activeTab}`}>
        <ResultCard
          type={activeTab}
          title={titles[activeTab]}
          description={descriptions[activeTab]}
          extra={renderExtraContent()}
          actions={renderActions()}
        />
      </div>
    </div>
  )
}
