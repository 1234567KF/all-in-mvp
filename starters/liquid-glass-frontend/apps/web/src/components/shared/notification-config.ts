/**
 * 消息通知 — 业务无关的类型、色调与默认注册表
 *
 * 设计目标：
 * - 只描述「消息长什么样」，不包含任何业务类型枚举、路由或角色判断；
 * - 业务侧通过 `typeRegistry` / `emphasis` / `href` + `onItemClick` 注入自己的语义；
 * - 颜色全部复用 theme-tokens 里的 `--lg-*` 语义 token，不硬编码色值。
 */
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Megaphone,
  Settings,
  UserPlus,
  XCircle,
} from "lucide-react"
import type { ComponentType, ReactNode, SVGProps } from "react"

// ─── 数据模型（view model）────────────────────────────────────────────────────

/**
 * 语义色调。业务 type 通过注册表映射到 tone，决定图标/未读点/高亮文字颜色。
 */
export const NOTIFICATION_TONES = [
  "primary",
  "info",
  "success",
  "warning",
  "danger",
  "neutral",
] as const

export type NotificationTone = (typeof NOTIFICATION_TONES)[number]

/**
 * 组件消费的消息 view model。
 * 与后端 wire schema 解耦：`read: boolean` 而不是 0/1，`createdAt` 而不是 createTime。
 *
 * 契约：**可点击行内只做展示**。触发 `onItemClick` 的行会渲染一个覆盖整行的按钮承接
 * 点击/键盘激活，视觉内容区被 `aria-hidden` + `pointer-events-none`。因此行内容
 * （含 `content` / `renderContent` 的结果）里不能放 button / a / input 等交互元素——
 * 需要行内独立交互时，必须由业务在通知行之外（如面板 footer、列表行外操作区）实现。
 */
export interface NotificationItem {
  id: string
  title: string
  /**
   * 通知正文（纯文本）。
   * 默认渲染会把「…」/『…』包裹的文本渲染为实体 chip；正文若包含普通引号
   * 或需要完全自定义，请传 `renderContent` 关闭默认解析。
   * 正文只做展示：不要指望其中的控件可交互（见 `NotificationItem` 的契约说明）。
   */
  content: string
  /** ISO 8601 时间字符串 */
  createdAt: string
  /** 是否已读，缺省 false */
  read?: boolean
  /** 业务类型 key，仅用于查 typeRegistry；未知类型回退 Bell + neutral */
  type?: string
  /** 点击目标；组件不导航，仅由 onItemClick 消费（便于业务接自己的路由） */
  href?: string
  /** 业务附加数据，供 renderContent / onItemClick 读取，组件本身不消费 */
  meta?: Record<string, unknown>
}

/** 图标组件类型：不绑定 lucide，任何接受 SVG 属性的图标组件都可注入 */
export type NotificationIcon = ComponentType<SVGProps<SVGSVGElement>>

/** 单个业务类型的展示配置 */
export interface NotificationTypeConfig {
  icon?: NotificationIcon
  tone?: NotificationTone
}

/** 业务注册表：type key → 图标 / 色调 */
export type NotificationTypeRegistry = Record<string, NotificationTypeConfig>

/**
 * 正文强调词组：全局词表，按字面匹配（内部会转义），适合中文动作词，如
 * `{ words: ["请及时审核", "待审核"], tone: "primary" }`。
 * 需要按通知类型区分高亮时，用 `renderContent` 自行处理。
 */
export interface NotificationEmphasis {
  words: readonly string[]
  tone?: NotificationTone
}

// ─── 面板 Props ───────────────────────────────────────────────────────────────

export interface NotificationPanelProps {
  notifications: readonly NotificationItem[]
  /** 未读数；缺省由 notifications 中 read=false 的条数派生 */
  unreadCount?: number
  loading?: boolean
  error?: string | null
  title?: string
  emptyText?: string
  /** 最多渲染条数，默认 50 */
  maxItems?: number
  /** 列表最大高度，默认 400（number 会按 px 处理） */
  maxHeight?: number | string
  /** 业务类型注册表，会覆盖默认注册表中的同名 key */
  typeRegistry?: NotificationTypeRegistry
  /** 正文高亮词组（全局词表）；不传则只做「」/『』实体 chip 高亮 */
  emphasis?: readonly NotificationEmphasis[]
  /**
   * 完全自定义正文渲染，优先级高于 emphasis。
   *
   * 展示契约：可点击行会把内容区 `aria-hidden` + `pointer-events-none`，由覆盖层
   * 按钮承接整行点击/键盘激活，因此 `renderContent` 内**只能做展示**，不得放
   * button / a / input 等交互元素；需要交互时由业务在行外实现（如 footer / 行外操作栏）。
   */
  renderContent?: (notification: NotificationItem) => ReactNode
  /** 时间格式化，默认 formatRelativeTime */
  formatTime?: (iso: string) => string
  /** 点击条目时是否自动标记已读，默认 true */
  markReadOnClick?: boolean
  /** 面板容器 class（宽度/圆角等）；NotificationCenter 会与弹层默认宽度合并 */
  className?: string
  onItemClick?: (notification: NotificationItem) => void
  onMarkRead?: (notification: NotificationItem) => void
  onMarkAllRead?: () => void
  onDelete?: (notification: NotificationItem) => void
  onRetry?: () => void
  footer?: ReactNode
}

// ─── 派生工具（Panel / Center / Bell / demo hook 共用）────────────────────────

/** 统计未读数；仅统计已加载的列表，服务端全量未读数请显式传 unreadCount */
export function getUnreadCount(
  notifications: readonly NotificationItem[]
): number {
  return notifications.reduce(
    (count, notification) => count + (notification.read ? 0 : 1),
    0
  )
}

/** 未读角标格式化：超过上限显示 `${max}+`，默认 99+ */
export function formatUnreadCount(count: number, max = 99): string {
  return count > max ? `${max}+` : String(count)
}

// ─── 色调样式（语义 token）────────────────────────────────────────────────────

export interface NotificationToneStyle {
  /** 未读时类型图标颜色 */
  iconColor: string
  /** 未读时图标容器背景 */
  iconBackground: string
  /** 未读圆点颜色 */
  dotColor: string
  /** emphasis 高亮文字颜色 */
  textColor: string
}

export const NOTIFICATION_TONE_STYLES: Record<
  NotificationTone,
  NotificationToneStyle
> = {
  primary: {
    iconColor: "var(--lg-primary-light)",
    iconBackground: "var(--lg-primary-dim)",
    dotColor: "var(--lg-primary)",
    textColor: "var(--lg-primary-emphasis-text)",
  },
  info: {
    iconColor: "var(--lg-info-accent)",
    iconBackground: "var(--data-link-bg)",
    dotColor: "var(--lg-info)",
    textColor: "var(--lg-info-accent)",
  },
  success: {
    iconColor: "var(--lg-success-light)",
    iconBackground: "var(--lg-success-dim)",
    dotColor: "var(--lg-success)",
    textColor: "var(--lg-success-text)",
  },
  warning: {
    iconColor: "var(--lg-warning-accent)",
    iconBackground: "var(--data-warning-bg)",
    dotColor: "var(--lg-warning)",
    textColor: "var(--lg-warning-text)",
  },
  danger: {
    iconColor: "var(--lg-danger)",
    iconBackground: "var(--lg-accent-red-dim)",
    dotColor: "var(--lg-danger)",
    textColor: "var(--lg-danger)",
  },
  neutral: {
    iconColor: "var(--lg-text-muted)",
    iconBackground: "var(--lg-surface-bright)",
    dotColor: "var(--lg-text-muted)",
    textColor: "var(--lg-text-secondary)",
  },
}

// ─── 实体 chip 调色板（低饱和 DJB2 离散配色）──────────────────────────────────

export interface EntityChipPalette {
  background: string
  color: string
  border: string
}

export const ENTITY_CHIP_PALETTES: readonly EntityChipPalette[] = [
  {
    background: "var(--lg-accent-blue-dim)",
    color: "var(--lg-accent-blue-light)",
    border: "var(--lg-accent-blue-border)",
  },
  {
    background: "var(--lg-accent-purple-dim)",
    color: "var(--lg-accent-purple-light)",
    border: "var(--lg-accent-purple-border)",
  },
  {
    background: "var(--lg-primary-dim)",
    color: "var(--lg-primary-emphasis-text)",
    border: "var(--lg-primary-border)",
  },
  {
    background: "var(--lg-accent-yellow-dim)",
    color: "var(--lg-chip-yellow-text)",
    border: "var(--lg-accent-yellow-border)",
  },
  {
    background: "var(--data-link-bg)",
    color: "var(--lg-chip-tertiary-text)",
    border: "var(--data-link-border)",
  },
  {
    background: "var(--lg-accent-red-dim)",
    color: "var(--lg-accent-red-light)",
    border: "var(--lg-accent-red-border)",
  },
]

// ─── 默认业务类型注册表（通用语义，不含任何业务域专有类型）────────────────────

export const DEFAULT_NOTIFICATION_TYPE_REGISTRY: NotificationTypeRegistry = {
  info: { icon: Info, tone: "info" },
  success: { icon: CheckCircle2, tone: "success" },
  warning: { icon: AlertTriangle, tone: "warning" },
  danger: { icon: XCircle, tone: "danger" },
  task: { icon: ClipboardCheck, tone: "primary" },
  announcement: { icon: Megaphone, tone: "primary" },
  system: { icon: Settings, tone: "neutral" },
  mention: { icon: AtSign, tone: "info" },
  account: { icon: UserPlus, tone: "info" },
}
