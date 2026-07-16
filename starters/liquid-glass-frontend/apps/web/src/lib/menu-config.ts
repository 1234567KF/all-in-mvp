import {
  BarChart3,
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
  TableProperties,
} from "lucide-react"

export interface MenuItem {
  title: string
  path: string
  icon: LucideIcon
  keywords?: string // 用于全局 CommandDialog 搜索匹配的关键词
  englishSub?: string // 英文辅助标签，如 "Dashboard"
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
        title: "虚拟滚动表格",
        path: "/virtual-table",
        icon: TableProperties,
        keywords: "虚拟滚动 virtual table 大数据 性能 virtualized",
        englishSub: "Virtual Table",
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
]

// 扁平化的菜单列表，便于搜索和直接查询
export const allMenuItems: MenuItem[] = menuGroups.flatMap((g) => g.items)

export function getPageTitle(pathname: string): string {
  const item = allMenuItems.find((menu) => menu.path === pathname)
  return item?.title ?? "Liquid Glass"
}
