import {
  AlertCircle,
  BarChart3,
  Eye,
  File,
  Folder,
  Info,
  Key,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  User,
} from "lucide-react"
import { useState } from "react"

import { PageHeader } from "@/components/layout/PageHeader"
import { DangerZone } from "@/components/shared/DangerZone"
import { FilterBar } from "@/components/shared/FilterBar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type TreeDataItem, TreeView } from "@/components/ui/tree-view"
import { showError, showInfo, showSuccess } from "@/lib/toast"
import { CodeLabel, Section } from "@/pages/sections/shared"

const permissionData: TreeDataItem[] = [
  {
    id: "system",
    name: "系统管理 (System Management)",
    icon: Shield,
    children: [
      {
        id: "system-users",
        name: "用户管理 (User Settings)",
        icon: Folder,
        children: [
          { id: "system-users-read", name: "查看用户 (Read Users)", icon: Eye },
          {
            id: "system-users-write",
            name: "编辑用户 (Write Users)",
            icon: Settings,
          },
          {
            id: "system-users-delete",
            name: "删除用户 (Delete Users)",
            icon: ShieldAlert,
          },
        ],
      },
      {
        id: "system-roles",
        name: "角色管理 (Role Settings)",
        icon: Folder,
        children: [
          { id: "system-roles-read", name: "查看角色 (Read Roles)", icon: Eye },
          {
            id: "system-roles-write",
            name: "编辑角色 (Write Roles)",
            icon: Settings,
          },
          {
            id: "system-roles-delete",
            name: "删除角色 (Delete Roles)",
            icon: ShieldAlert,
          },
        ],
      },
    ],
  },
  {
    id: "dashboard",
    name: "数据看板 (Dashboard)",
    icon: Folder,
    children: [
      { id: "dashboard-view", name: "查看看板 (View Dashboard)", icon: Eye },
      { id: "dashboard-export", name: "导出数据 (Export Reports)", icon: File },
    ],
  },
  {
    id: "security",
    name: "安全策略 (Security)",
    icon: Lock,
    children: [
      { id: "security-logs", name: "审计日志 (Audit Logs)", icon: File },
      {
        id: "security-keys-read",
        name: "查看 API 密钥 (Read Keys)",
        icon: Eye,
      },
      {
        id: "security-keys-write",
        name: "管理 API 密钥 (Manage Keys)",
        icon: Key,
      },
    ],
  },
]

export default function OverlaysPage() {
  const [activeTab, setActiveTab] = useState("overview")

  // 新增：级联下拉与弹窗嵌套示例状态
  const [demoDept, setDemoDept] = useState("")
  const [demoUser, setDemoUser] = useState("")

  // 模拟部门下的人员数据
  const deptUsersMap: Record<string, string[]> = {
    tech: ["张三 (前端开发)", "李四 (后端开发)", "赵六 (测试工程师)"],
    design: ["王五 (UI/UX 设计师)", "孙七 (视觉设计师)"],
    market: [], // 市场部下暂无人员，用于测试空数据状态
  }
  const demoUsers = demoDept ? (deptUsersMap[demoDept] ?? []) : []

  // Permission selection state
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    new Set(["system-users-read", "dashboard-view", "security-keys-read"])
  )

  const getAllChildIds = (item: TreeDataItem): string[] => {
    const ids = [item.id]
    if (item.children) {
      item.children.forEach((child) => {
        ids.push(...getAllChildIds(child))
      })
    }
    return ids
  }

  const handleCheckChange = (item: TreeDataItem, isChecked: boolean) => {
    const newCheckedIds = new Set(checkedIds)
    const affectedIds = getAllChildIds(item)
    if (isChecked) {
      affectedIds.forEach((id) => newCheckedIds.add(id))
    } else {
      affectedIds.forEach((id) => newCheckedIds.delete(id))
    }
    setCheckedIds(newCheckedIds)
  }

  const getIndeterminateState = (item: TreeDataItem): boolean => {
    if (!item.children || item.children.length === 0) return false
    const childIds = getAllChildIds(item).filter((id) => id !== item.id)
    const checkedChildren = childIds.filter((id) => checkedIds.has(id))
    return (
      checkedChildren.length > 0 && checkedChildren.length < childIds.length
    )
  }

  const isNodeChecked = (item: TreeDataItem): boolean => {
    if (!item.children || item.children.length === 0) {
      return checkedIds.has(item.id)
    }
    const childIds = getAllChildIds(item).filter((id) => id !== item.id)
    return childIds.every((id) => checkedIds.has(id))
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <PageHeader
        title="浮层与导航"
        description="Tabs, Dialog, Sheet, Alerts, Toast & TreeView"
      />

      {/* =================== Tabs =================== */}
      <Section title="Tabs">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-3 border border-border bg-card">
            <TabsTrigger value="overview">
              <LayoutDashboard data-icon="inline-start" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 data-icon="inline-start" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings data-icon="inline-start" />
              Settings
            </TabsTrigger>
          </TabsList>
          <Card className="glass-card">
            <CardContent className="p-6">
              <TabsContent value="overview" className="m-0">
                <p className="text-sm text-on-surface-variant">
                  Overview Tab — 展示业务概览，使用{" "}
                  <CodeLabel text="&lt;Tabs&gt;" /> 组件管理激活态。
                </p>
              </TabsContent>
              <TabsContent value="analytics" className="m-0">
                <p className="text-sm text-on-surface-variant">
                  Analytics Tab — 展示用量趋势，切换时自动隐藏/显示内容。
                </p>
              </TabsContent>
              <TabsContent value="settings" className="m-0">
                <p className="text-sm text-on-surface-variant">
                  Settings Tab — 配置项区域，可嵌套表单。
                </p>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </Section>

      {/* =================== Dropdown & Dialog =================== */}
      <Section title="Dropdown & Dialog">
        <Card className="glass-card">
          <CardContent className="flex flex-wrap items-center gap-3 p-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <User data-icon="inline-start" /> 成员操作
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <User data-icon="inline-start" /> 查看详情
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Mail data-icon="inline-start" /> 发送通知
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-400">
                    <LogOut data-icon="inline-start" /> 移除成员
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <LogOut data-icon="inline-start" /> 删除确认
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>确认删除？</DialogTitle>
                  <DialogDescription>
                    该操作不可撤销，删除后数据将永久丢失。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">取消</Button>
                  </DialogClose>
                  <Button variant="destructive">确认删除</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 新增：弹窗级联下拉与空兜底防穿透示例 */}
            <Dialog
              onOpenChange={(open) => {
                if (!open) {
                  setDemoDept("")
                  setDemoUser("")
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus data-icon="inline-start" /> 表单级联下拉
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles
                      className="size-4 text-primary"
                      style={{ color: "var(--lg-primary)" }}
                    />
                    新建任务分配
                  </DialogTitle>
                  <DialogDescription>
                    选择分配部门及负责人。选择“市场部”可测试无数据时的禁用兜底与防点击穿透拦截。
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-on-surface-variant">
                      分配部门 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={demoDept}
                      onValueChange={(v) => {
                        setDemoDept(v)
                        setDemoUser("")
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="请选择分配部门" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tech">技术部</SelectItem>
                        <SelectItem value="design">设计部</SelectItem>
                        <SelectItem value="market">
                          市场部 (暂无人员)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-on-surface-variant">
                      负责人 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={demoUser}
                      onValueChange={(v) => {
                        if (v === "none") return
                        setDemoUser(v)
                      }}
                      disabled={!demoDept}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            demoDept ? "请选择负责人" : "请先选择分配部门"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {demoUsers.length === 0 ? (
                          <SelectItem
                            value="none"
                            className="cursor-not-allowed text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                          >
                            该部门下暂无启用人员
                          </SelectItem>
                        ) : (
                          demoUsers.map((user) => (
                            <SelectItem key={user} value={user}>
                              {user}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">取消</Button>
                  </DialogClose>
                  <Button
                    variant="default"
                    onClick={() => {
                      if (!demoDept || !demoUser) {
                        showError("请完整填写分配表单")
                        return
                      }
                      showSuccess(
                        `分配成功: ${demoDept === "tech" ? "技术部" : "设计部"} -> ${demoUser}`
                      )
                    }}
                  >
                    确认分配
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">打开侧滑面板</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>侧滑面板</SheetTitle>
                  <SheetDescription>
                    从右侧滑出的面板，适合详情展示或表单编辑。
                  </SheetDescription>
                </SheetHeader>
                <div className="p-6">
                  <p className="text-sm text-on-surface-variant">
                    Sheet 内容区域
                  </p>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback>AC</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-sm">
                <span className="text-on-surface">Alice Chen</span>
                <span className="text-outline">alice@example.com</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* =================== FilterBar =================== */}
      <Section title="FilterBar">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">筛选栏容器</CardTitle>
            <CardDescription>
              水平排列 Select、Input 等筛选控件，支持自动换行
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 p-6">
            <div>
              <p className="mb-3 text-xs tracking-wider text-muted-foreground uppercase">
                纯布局模式（无标签）
              </p>
              <FilterBar>
                <Select>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="active">活跃</SelectItem>
                      <SelectItem value="inactive">停用</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="选择部门" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">全部部门</SelectItem>
                      <SelectItem value="eng">工程</SelectItem>
                      <SelectItem value="design">设计</SelectItem>
                      <SelectItem value="product">产品</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input placeholder="搜索成员..." className="w-[200px]" />
                <Button variant="outline" size="sm">
                  <Search data-icon="inline-start" /> 筛选
                </Button>
              </FilterBar>
            </div>
            <Separator />
            <div>
              <p className="mb-3 text-xs tracking-wider text-muted-foreground uppercase">
                带标签模式
              </p>
              <FilterBar labels={["状态", "时间范围", "关键词", ""]}>
                <Select>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="success">成功</SelectItem>
                      <SelectItem value="error">失败</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="近 7 天" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="7d">近 7 天</SelectItem>
                      <SelectItem value="30d">近 30 天</SelectItem>
                      <SelectItem value="90d">近 90 天</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input placeholder="搜索..." className="w-[160px]" />
                <Button variant="outline" size="sm">
                  重置
                </Button>
              </FilterBar>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* =================== PageHeader =================== */}
      <Section title="PageHeader">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">PageHeader 页面头部</CardTitle>
            <CardDescription>
              统一页面标题 + 描述 + 操作按钮布局
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <PageHeader
              title="成员用量看板"
              description="实时查看团队成员的 AI 代码使用配额与消耗情况"
              actions={
                <>
                  <Button variant="outline" size="sm">
                    <RefreshCw data-icon="inline-start" /> 刷新
                  </Button>
                  <Button size="sm">
                    <Plus data-icon="inline-start" /> 新增成员
                  </Button>
                </>
              }
            />
          </CardContent>
        </Card>
      </Section>

      {/* =================== Breadcrumb =================== */}
      <Section title="Breadcrumb">
        <div className="flex flex-col gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Components</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </Section>

      {/* =================== Alerts & Alert Dialogs =================== */}
      <Section title="Alerts & Dialogs">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Alerts Panel */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">
                Alerts (提示信息)
              </CardTitle>
              <CardDescription>
                用于呈现警告、成功、普通通知等状态
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Alert>
                <Info className="size-4 shrink-0 text-muted-foreground" />
                <AlertTitle>系统更新</AlertTitle>
                <AlertDescription>
                  全新 Liquid Glass V4 设计系统现已发布，完全支持 CSS 变量。
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertCircle className="size-4 shrink-0" />
                <AlertTitle>错误提示</AlertTitle>
                <AlertDescription>
                  您的 API Key 额度已耗尽，请及时前往设置面板进行充值。
                </AlertDescription>
              </Alert>

              <Alert className="border-[var(--lg-primary-border)] bg-[var(--lg-primary-dim)] text-[var(--lg-primary-light)]">
                <Sparkles className="size-4 shrink-0 text-[var(--lg-primary-light)]" />
                <AlertTitle className="text-[var(--lg-primary-light)]">
                  合规通过
                </AlertTitle>
                <AlertDescription className="text-[var(--lg-text-secondary)]">
                  您的 AI 辅助代码合规率已达到 standard，未检测到任何安全隐患。
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* AlertDialog Panel */}
          <Card className="glass-card flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">
                  AlertDialog (二次确认弹窗)
                </CardTitle>
                <CardDescription>用于关键破坏性动作的确认提示</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-on-surface-variant">
                  通过 Radix UI
                  构建的遮罩阻断确认框。背景支持磨砂毛玻璃滤镜（backdrop-blur），确保核心警告聚焦。
                </p>
              </CardContent>
            </div>
            <CardFooter className="pb-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    触发敏感危险操作 (清除缓存)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">
                      确认要清除全局缓存吗？
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作是不可逆的。清除后所有本地代理指标数据将需重新生成，这可能需要花费几分钟的时间。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                      <Button variant="outline">取消</Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        variant="destructive"
                        onClick={() => alert("缓存已清空 (Demo)")}
                      >
                        确认清空
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        </div>
      </Section>

      {/* =================== Toast 通知 =================== */}
      <Section title="Toast 通知">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Toast 通知 (sonner)</CardTitle>
            <CardDescription>点击按钮触发不同类型的提示通知</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 p-6">
            <Button
              variant="outline"
              onClick={() => showSuccess("操作成功", "数据已保存到服务器")}
            >
              成功提示
            </Button>
            <Button
              variant="outline"
              onClick={() => showError("操作失败", "网络连接超时，请重试")}
            >
              错误提示
            </Button>
            <Button
              variant="outline"
              onClick={() => showInfo("提示信息", "系统将于 30 分钟后维护")}
            >
              信息提示
            </Button>
          </CardContent>
        </Card>
      </Section>

      {/* =================== DangerZone =================== */}
      <Section title="DangerZone">
        <div className="grid gap-6 md:grid-cols-2">
          <DangerZone
            title="清除缓存"
            description="清除后所有本地代理指标数据将需要重新生成。"
            buttonText="清除缓存"
            confirmDescription="此操作不可逆，确认后所有缓存数据将被永久删除。"
            onConfirm={() => {
              showSuccess("缓存已清除 (Demo)")
            }}
          />
          <DangerZone
            title="删除账户"
            description="删除后该账户所有数据将永久丢失，无法恢复。"
            buttonText="删除账户"
            requirePassword
            confirmDescription={
              <>
                <p className="mb-2">该操作将永久删除以下内容：</p>
                <ul className="flex list-inside list-disc flex-col gap-1 text-sm">
                  <li>账户信息和配置</li>
                  <li>历史使用数据</li>
                  <li>API 密钥和权限</li>
                </ul>
              </>
            }
            onConfirm={() => {
              showSuccess("账户已删除 (Demo)")
            }}
          />
        </div>
      </Section>

      {/* =================== TreeView & Permissions =================== */}
      <Section title="TreeView & Permission Selection">
        <div className="grid gap-6 md:grid-cols-2">
          {/* TreeView Panel */}
          <Card className="glass-card flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Shield className="size-4 text-[var(--lg-primary-light)]" />
                  <span>权限配置树 (Permission Tree)</span>
                </CardTitle>
                <CardDescription>
                  使用 shadcn-extension TreeView 进行多级细粒度权限勾选
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="max-h-[360px] overflow-y-auto rounded-xl border border-[var(--lg-border-subtle)] bg-[var(--lg-surface-container)]/40 p-3">
                  <TreeView
                    data={permissionData}
                    expandAll
                    renderItem={({ item }) => {
                      const checked = isNodeChecked(item)
                      const indeterminate = getIndeterminateState(item)
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex w-full cursor-pointer items-center gap-2 py-0.5 select-none"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCheckChange(item, !checked)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              e.stopPropagation()
                              handleCheckChange(item, !checked)
                            }
                          }}
                        >
                          <Checkbox
                            id={`chk-${item.id}`}
                            className="after:inset-0"
                            checked={indeterminate ? "indeterminate" : checked}
                            onCheckedChange={(v) => {
                              handleCheckChange(
                                item,
                                v === true || v === "indeterminate"
                              )
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {item.icon && (
                            <item.icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                          )}
                          <span className="text-sm font-medium text-foreground transition-colors hover:text-[var(--lg-primary-light)]">
                            {item.name}
                          </span>
                        </div>
                      )
                    }}
                  />
                </div>
              </CardContent>
            </div>
            <CardFooter className="flex items-center justify-between border-t border-[var(--lg-border-subtle)] bg-muted/20 pt-4 pb-6">
              <span className="text-xs text-muted-foreground">
                支持节点级联选择及折叠动画
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setCheckedIds(new Set())}
              >
                清空选择
              </Button>
            </CardFooter>
          </Card>

          {/* Config Preview Panel */}
          <Card className="glass-card flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Key className="size-4 text-[var(--lg-primary-light)]" />
                  <span>已选权限令牌 (Selected Scopes)</span>
                </CardTitle>
                <CardDescription>
                  实时输出已选中的权限唯一标识符（Key）集
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex max-h-[180px] flex-wrap gap-1.5 overflow-y-auto p-1">
                  {Array.from(checkedIds).length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      未勾选任何权限
                    </span>
                  ) : (
                    Array.from(checkedIds).map((id) => (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="flex items-center gap-1 rounded-md border border-[var(--lg-primary-light)]/20 bg-[var(--lg-primary-dim)] px-2 py-0.5 font-mono text-xs text-[var(--lg-primary-light)] transition-all hover:bg-[var(--lg-primary-dim)]"
                      >
                        <span>{id}</span>
                      </Badge>
                    ))
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    API Payload Preview (JSON):
                  </div>
                  <pre className="max-h-[140px] overflow-x-auto overflow-y-auto rounded-lg border border-[var(--lg-border-subtle)] bg-[var(--lg-surface-container)] p-3 font-mono text-[10px] text-[var(--lg-text-secondary)] select-all">
                    {JSON.stringify(
                      {
                        role: "custom-admin",
                        permissions: Array.from(checkedIds),
                        updatedAt: new Date().toISOString().split("T")[0],
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </CardContent>
            </div>
            <CardFooter className="pb-6">
              <Button
                className="w-full"
                onClick={() => {
                  alert(`成功保存 ${checkedIds.size} 项权限配置！`)
                }}
                disabled={checkedIds.size === 0}
              >
                保存配置并应用
              </Button>
            </CardFooter>
          </Card>
        </div>
      </Section>
    </div>
  )
}
