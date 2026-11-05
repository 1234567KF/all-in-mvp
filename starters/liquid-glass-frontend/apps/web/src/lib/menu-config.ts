import {
  BarChart3,
  Bell,
  CheckCircle2,
  CloudLightning,
  Cog,
  FileQuestion,
  FormInput,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  Palette,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TableProperties,
} from "lucide-react"
import { type PermissionCode, PERMISSIONS } from "shared"

export interface MenuItem {
  title: string
  path: string
  icon: LucideIcon
  keywords?: string // 用于全局 CommandDialog 搜索匹配的关键词
  englishSub?: string // 英文辅助标签，如 "Dashboard"
  /**
   * 可选权限码（PERMISSIONS.* 常量，禁止散落字符串字面量）：
   * 不填默认全员可见；填了由侧边栏与 ⌘K 通过 usePermission().can() 自动过滤。
   * 只控制导航可见性，页面/接口鉴权仍由后端路由中间件负责。
   */
  permission?: PermissionCode
}

export interface MenuGroup {
  label: string
  items: MenuItem[]
}

export const menuGroups: MenuGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "仪表盘",
        path: "/dashboard",
        icon: LayoutDashboard,
        keywords: "仪表盘 dashboard kpi cards chart",
        englishSub: "Dashboard",
      },
      {
        title: "个人设置",
        path: "/settings",
        icon: Settings,
        keywords: "个人设置 settings profile theme password 自动模式 跟随系统",
        englishSub: "Settings",
      },
      {
        title: "系统设置",
        path: "/system-settings",
        icon: Cog,
        keywords:
          "系统设置 system settings general notification security storage maintenance",
        englishSub: "System",
      },
    ],
  },
  {
    label: "Showcase",
    items: [
      {
        title: "概览",
        path: "/components",
        icon: Palette,
        keywords: "组件概览 components overview",
        englishSub: "Components",
      },
      {
        title: "基础元素",
        path: "/components/foundations",
        icon: Palette,
        keywords: "基础元素 foundations cards buttons badges",
        englishSub: "Foundations",
      },
      {
        title: "表单与输入",
        path: "/components/forms",
        icon: FormInput,
        keywords: "表单与输入 forms inputs select checkbox calendar",
        englishSub: "Forms",
      },
      {
        title: "数据展示",
        path: "/components/data",
        icon: BarChart3,
        keywords:
          "数据展示 data table kpi pagination progress empty skeleton 缺省 骨架屏",
        englishSub: "Data",
      },
      {
        title: "浮层与导航",
        path: "/components/overlays",
        icon: Layers,
        keywords:
          "浮层与导航 overlays tabs dialog sheet alerts toast treeview 弹出层",
        englishSub: "Overlays",
      },
      {
        title: "消息通知",
        path: "/components/notifications",
        icon: Bell,
        keywords:
          "消息通知 notification bell unread badge 消息中心 notification center",
        englishSub: "Notifications",
      },
      {
        title: "虚拟滚动表格",
        path: "/virtual-table",
        icon: TableProperties,
        keywords: "虚拟滚动 virtual table 大数据 性能 virtualized",
        englishSub: "Virtual Table",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        title: "审计日志",
        path: "/audit-log",
        icon: ShieldCheck,
        keywords: "审计日志 audit logs 操作记录 安全审计 变更明细 登录历史",
        englishSub: "Audit Log",
        permission: PERMISSIONS.AUDIT_VIEW,
      },
    ],
  },
  {
    label: "Templates",
    items: [
      {
        title: "403 无权限页",
        path: "/403-demo",
        icon: ShieldAlert,
        keywords: "403 访问受限 无权限 forbidden permission access denied",
        englishSub: "Forbidden",
      },
      {
        title: "404 页面",
        path: "/404-demo",
        icon: FileQuestion,
        keywords: "404 not found 缺省页 错误页",
        englishSub: "Not Found",
      },
      {
        title: "500 服务异常页",
        path: "/500-demo",
        icon: CloudLightning,
        keywords: "500 服务异常 崩溃 crash error server failure",
        englishSub: "Server Error",
      },
      {
        title: "操作结果页",
        path: "/result-demo",
        icon: CheckCircle2,
        keywords:
          "操作结果反馈 成功 失败 警告 信息 feedback success error result card",
        englishSub: "Result Feedback",
      },
    ],
  },
  // [gen:module:menu-groups] 由 bun run gen:module 追加业务模块菜单分组（勿手改本行）
]

// 扁平化的全量菜单列表（未过滤）；⌘K 使用前须经 filterMenuItems 按权限过滤
export const allMenuItems: MenuItem[] = menuGroups.flatMap((g) => g.items)

// ─── 权限过滤（纯函数，与 auth store 解耦）────────────────────────────────────

/**
 * 按权限过滤菜单项：item.permission 缺省视为全员可见
 *
 * can 由 usePermission().can 提供；纯函数便于单测，也让「过滤规则」与
 * 「权限来源」解耦（store / DB / 后端预计算均可注入）。
 * 仅控制导航可见性，不代替页面与接口鉴权。
 */
export function filterMenuItems(
  items: MenuItem[],
  can: (code: PermissionCode) => boolean
): MenuItem[] {
  return items.filter((item) => !item.permission || can(item.permission))
}

/** 按权限过滤分组，并把因此清空的分组整组移除 */
export function filterMenuGroups(
  groups: MenuGroup[],
  can: (code: PermissionCode) => boolean
): MenuGroup[] {
  return groups
    .map((group) => ({ ...group, items: filterMenuItems(group.items, can) }))
    .filter((group) => group.items.length > 0)
}

// ─── 面包屑派生（纯路径，与权限解耦）──────────────────────────────────────────

/** 面包屑节点：title 必填；path 仅可跳转的上级节点携带 */
export interface BreadcrumbItem {
  title: string
  path?: string
}

/**
 * 从菜单分组派生「路径 → 面包屑」映射（导航标题单一事实源）
 *
 * - 同路径多菜单项时以首个为准
 * - 单级：分组名与菜单标题同名时只显示页面
 * - 两级：[分组, 页面]；分组是纯标签，不带 path
 * - 不按权限过滤：面包屑描述路径在导航树中的位置，与菜单可见性解耦
 */
export function deriveBreadcrumbMap(
  groups: MenuGroup[]
): Map<string, BreadcrumbItem[]> {
  const map = new Map<string, BreadcrumbItem[]>()
  for (const group of groups) {
    for (const item of group.items) {
      if (map.has(item.path)) continue
      map.set(
        item.path,
        group.label === item.title
          ? [{ title: item.title }]
          : [{ title: group.label }, { title: item.title }]
      )
    }
  }
  return map
}

const BREADCRUMB_MAP = deriveBreadcrumbMap(menuGroups)

/**
 * 取路径对应的面包屑（未知路径回退品牌名，与页面标题兜底一致）
 *
 * 供页面头部 / 详情页按需消费；TopBar 当前只展示末级标题（getPageTitle）。
 */
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  return BREADCRUMB_MAP.get(pathname) ?? [{ title: "Liquid Glass" }]
}

/** 页面标题 = 面包屑末级标题（消除导航标题与页面标题双写） */
export function getPageTitle(pathname: string): string {
  const breadcrumbs = getBreadcrumbs(pathname)
  return breadcrumbs[breadcrumbs.length - 1].title
}
