/**
 * Demo 消息数据 — 仅用于 starter 的组件展示与顶栏演示
 *
 * 这里刻意使用「通用业务场景」而不是 CRM 的审核/商机枚举，
 * 用来示范业务侧如何通过 typeRegistry / emphasis / href 完成自己的映射。
 */
import {
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  Megaphone,
  Settings,
  UserPlus,
  XCircle,
} from "lucide-react"

import type {
  NotificationEmphasis,
  NotificationItem,
  NotificationTypeRegistry,
} from "@/components/shared/notification-config"

const NOW = Date.now()

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString()
}

/** 业务类型 → 图标 / 色调映射示例 */
export const DEMO_NOTIFICATION_TYPES: NotificationTypeRegistry = {
  approval: { icon: ClipboardCheck, tone: "primary" },
  approved: { icon: CheckCircle2, tone: "success" },
  rejected: { icon: XCircle, tone: "danger" },
  assigned: { icon: FolderKanban, tone: "info" },
  announcement: { icon: Megaphone, tone: "warning" },
  account: { icon: UserPlus, tone: "info" },
  system: { icon: Settings, tone: "neutral" },
}

/** 业务动作词高亮示例（CRM 风格的“请及时审核 / 已通过 / 被驳回”） */
export const DEMO_NOTIFICATION_EMPHASIS: readonly NotificationEmphasis[] = [
  { words: ["请及时审核", "待审核"], tone: "primary" },
  { words: ["已通过"], tone: "success" },
  { words: ["被驳回"], tone: "danger" },
]

export const DEMO_NOTIFICATIONS: readonly NotificationItem[] = [
  {
    id: "demo-notification-1",
    type: "approval",
    title: "新的审批申请",
    content: "李四提交了审批「Q4 版本发布计划」，请及时审核",
    read: false,
    createdAt: minutesAgo(4),
    href: "/dashboard",
  },
  {
    id: "demo-notification-2",
    type: "approved",
    title: "审批已通过",
    content: "您提交的「Liquid Glass 2.0」已通过评审，可以开始实施",
    read: false,
    createdAt: minutesAgo(26),
    href: "/components",
  },
  {
    id: "demo-notification-3",
    type: "assigned",
    title: "任务已指派",
    content: "王五将「消息中心组件沉淀」指派给您跟进",
    read: false,
    createdAt: minutesAgo(75),
    href: "/components/notifications",
  },
  {
    id: "demo-notification-4",
    type: "rejected",
    title: "审批被驳回",
    content: "您的「数据迁移任务」被驳回，请检查依赖配置后重新提交",
    read: false,
    createdAt: minutesAgo(300),
    href: "/system-settings",
  },
  {
    id: "demo-notification-5",
    type: "announcement",
    title: "系统公告",
    content: "系统将于周六 02:00 进行维护，预计持续 30 分钟「周末维护窗口」",
    read: true,
    createdAt: minutesAgo(60 * 26),
    href: "/dashboard",
  },
  {
    id: "demo-notification-6",
    type: "account",
    title: "账号已创建",
    content: "您的账号已创建，请及时修改初始密码",
    read: true,
    createdAt: minutesAgo(60 * 48),
    href: "/settings",
  },
  {
    id: "demo-notification-7",
    type: "system",
    title: "安全提醒",
    content: "检测到您的账号在新设备登录，如非本人操作请及时修改密码",
    read: true,
    createdAt: minutesAgo(60 * 72),
    href: "/settings",
  },
]
