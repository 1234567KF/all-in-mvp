import { Bell, Search, User, Users } from "lucide-react"
import { useState } from "react"
import { type DateRange } from "react-day-picker"

import { PageHeader } from "@/components/layout/PageHeader"
import { PasswordToggleInput } from "@/components/shared/PasswordToggleInput"
import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CodeLabel, Section } from "@/pages/sections/shared"

const memberOptions = [
  { value: "usr-001", label: "Alice Chen", subLabel: "alice.chen@example.com" },
  { value: "usr-002", label: "Bob Wang", subLabel: "bob.wang@example.com" },
  { value: "usr-003", label: "Carol Li", subLabel: "carol.li@example.com" },
  {
    value: "usr-004",
    label: "David Zhang",
    subLabel: "david.zhang@example.com",
  },
  { value: "usr-005", label: "Eva Liu", subLabel: "eva.liu@example.com" },
]

export default function FormsPage() {
  const [inputVal, setInputVal] = useState("")
  const [checked, setChecked] = useState(true)
  const [demoPassword, setDemoPassword] = useState("")
  const [demoPasswordError, setDemoPasswordError] = useState("")
  const [singleDate, setSingleDate] = useState<Date | undefined>(new Date())
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
  })
  const [singleMember, setSingleMember] = useState<string>("")
  const [multipleMembers, setMultipleMembers] = useState<string[]>([])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <PageHeader
        title="表单与输入"
        description="Inputs, Select, Checkbox, Calendar, DatePicker & InputGroup"
      />

      {/* =================== Inputs =================== */}
      <Section title="Inputs">
        <Card className="glass-card">
          <CardContent className="p-6">
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="input-normal">普通输入</FieldLabel>
                <Input
                  id="input-normal"
                  placeholder="请输入内容..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="input-search">带图标输入</FieldLabel>
                <InputGroup>
                  <InputGroupAddon
                    align="inline-start"
                    variant="ghost"
                    className="pr-0"
                  >
                    <Search className="text-[var(--lg-text-muted)]" />
                  </InputGroupAddon>
                  <InputGroupInput id="input-search" placeholder="搜索..." />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel>Select</FieldLabel>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择一个选项" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="alpha">Project Alpha</SelectItem>
                      <SelectItem value="beta">Project Beta</SelectItem>
                      <SelectItem value="gamma">Project Gamma</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-disabled>
                <FieldLabel htmlFor="input-disabled">禁用输入</FieldLabel>
                <Input id="input-disabled" placeholder="不可编辑" disabled />
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="input-textarea">Textarea</FieldLabel>
                <Textarea
                  id="input-textarea"
                  placeholder="请输入备注..."
                  rows={3}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </Section>

      {/* =================== Form Controls =================== */}
      <Section title="Form Controls">
        <Card className="glass-card">
          <CardContent className="flex flex-wrap items-center gap-6 p-6">
            <Field orientation="horizontal" className="w-auto">
              <Checkbox
                id="chk-1"
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
              />
              <FieldLabel
                htmlFor="chk-1"
                className="cursor-pointer text-sm font-normal text-on-surface"
              >
                已选中
              </FieldLabel>
            </Field>
            <Field orientation="horizontal" className="w-auto">
              <Checkbox id="chk-2" />
              <FieldLabel
                htmlFor="chk-2"
                className="cursor-pointer text-sm font-normal text-on-surface"
              >
                未选中
              </FieldLabel>
            </Field>
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-on-surface-variant" />
              <span className="text-sm text-on-surface-variant">
                通知图标示例
              </span>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* =================== PasswordToggleInput =================== */}
      <Section title="PasswordToggleInput">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">密码切换输入框</CardTitle>
            <CardDescription>内置显隐切换按钮的密码输入组件</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>普通密码输入</FieldLabel>
                <PasswordToggleInput
                  value={demoPassword}
                  onChange={(v) => {
                    setDemoPassword(v)
                    if (v) setDemoPasswordError("")
                  }}
                  placeholder="请输入密码..."
                />
              </Field>
              <Field data-invalid={!!demoPasswordError}>
                <FieldLabel htmlFor="password-error">带错误提示</FieldLabel>
                <PasswordToggleInput
                  value={demoPasswordError ? "wrong" : ""}
                  onChange={(_v) => {
                    setDemoPasswordError("")
                  }}
                  error={demoPasswordError}
                  placeholder="请输入密码..."
                  id="password-error"
                />
                <FieldError>{demoPasswordError}</FieldError>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-fit"
                  onClick={() =>
                    setDemoPasswordError(
                      demoPasswordError ? "" : "密码不能为空，请重新输入"
                    )
                  }
                >
                  {demoPasswordError ? "清除错误" : "触发错误"}
                </Button>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </Section>

      {/* =================== Calendar & DatePicker =================== */}
      <Section title="Calendar & DatePicker">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Calendar Card */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">
                Calendar (日历组件)
              </CardTitle>
              <CardDescription>
                底层基于 react-day-picker 的日历显示
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <UiCalendar
                mode="single"
                selected={singleDate}
                onSelect={setSingleDate}
                className="rounded-xl border border-[var(--lg-border)] bg-[var(--lg-surface-glass)] p-3 shadow-lg"
              />
            </CardContent>
          </Card>

          {/* DatePickers Card */}
          <Card className="glass-card flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">
                  DatePicker & DateRangePicker
                </CardTitle>
                <CardDescription>用于选择单天或日期跨度范围</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-on-surface-variant">
                  结合 Popover、Calendar 和
                  Date-fns，提供中文友好的单日期选择与双日期范围选择，完全适配玻璃高光主题样式并支持一键清除。
                </p>

                {/* Single Date Picker */}
                <Field>
                  <FieldLabel className="text-xs">
                    单日期选择 (DatePicker)：
                  </FieldLabel>
                  <DatePicker date={singleDate} onDateChange={setSingleDate} />
                </Field>

                {/* Date Range Picker */}
                <Field>
                  <FieldLabel className="text-xs">
                    日期范围选择 (DateRangePicker)：
                  </FieldLabel>
                  <DateRangePicker
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                  />
                </Field>
              </CardContent>
            </div>
            <CardFooter className="flex flex-col items-start gap-1 pb-6 font-mono text-xs text-muted-foreground">
              <div>
                单选值:{" "}
                {singleDate ? singleDate.toLocaleDateString("zh-CN") : "未选择"}
              </div>
              <div>
                范围开始:{" "}
                {dateRange?.from
                  ? dateRange.from.toLocaleDateString("zh-CN")
                  : "未选择"}
              </div>
              <div>
                范围结束:{" "}
                {dateRange?.to
                  ? dateRange.to.toLocaleDateString("zh-CN")
                  : "未选择"}
              </div>
            </CardFooter>
          </Card>
        </div>
      </Section>

      {/* =================== InputGroups =================== */}
      <Section title="InputGroups (复合输入框)">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Glass Style */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">
                磨砂玻璃风格 (Glassmorphism)
              </CardTitle>
              <CardDescription>
                结合毛玻璃材质效果与半透明发光的现代视觉样式
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              <Field>
                <FieldLabel className="text-xs">
                  带前置/后置 Addon 的复合输入：
                </FieldLabel>
                <InputGroup variant="glass" className="h-10 p-0">
                  <InputGroupAddon align="inline-start" className="text-xs">
                    https://
                  </InputGroupAddon>
                  <InputGroupInput
                    className="h-full text-sm"
                    placeholder="example.com"
                  />
                  <InputGroupAddon
                    variant="ghost"
                    align="inline-end"
                    className="pr-1.5"
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary/90"
                      onClick={() => alert("Verifying...")}
                    >
                      Verify
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel className="text-xs">
                  带搜索及快捷键提示：
                </FieldLabel>
                <InputGroup variant="glass" className="h-10">
                  <InputGroupAddon
                    variant="ghost"
                    align="inline-start"
                    className="pr-0"
                  >
                    <Search className="size-4 text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput
                    className="h-full text-sm"
                    placeholder="快速搜索..."
                  />
                  <InputGroupAddon
                    variant="ghost"
                    align="inline-end"
                    className="pl-0"
                  >
                    <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-[var(--lg-border-subtle)] bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 select-none">
                      <span className="text-xs leading-none">⌘</span>
                      <span className="leading-none">K</span>
                    </kbd>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </CardContent>
            <CardFooter className="pb-6">
              <p className="text-xs text-outline">
                结合 <CodeLabel text="InputGroup" /> 与各种{" "}
                <CodeLabel text="InputGroupAddon" />{" "}
                容器，支持在保留毛玻璃效果的同时做复杂的复合拼接。
              </p>
            </CardFooter>
          </Card>

          {/* Default Style */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">
                扁平边框风格 (Default Border)
              </CardTitle>
              <CardDescription>
                使用传统的表单描边与浅色背景，适用于高对比度或极简场景
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              <Field>
                <FieldLabel className="text-xs">
                  带前置/后置 Addon 的复合输入：
                </FieldLabel>
                <InputGroup variant="default" className="h-10 p-0">
                  <InputGroupAddon align="inline-start" className="text-xs">
                    https://
                  </InputGroupAddon>
                  <InputGroupInput
                    className="h-full text-sm"
                    placeholder="example.com"
                  />
                  <InputGroupAddon
                    variant="ghost"
                    align="inline-end"
                    className="pr-1.5"
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary/90"
                      onClick={() => alert("Verifying...")}
                    >
                      Verify
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel className="text-xs">
                  带搜索及快捷键提示：
                </FieldLabel>
                <InputGroup variant="default" className="h-10">
                  <InputGroupAddon
                    variant="ghost"
                    align="inline-start"
                    className="pr-0"
                  >
                    <Search className="size-4 text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput
                    className="h-full text-sm"
                    placeholder="快速搜索..."
                  />
                  <InputGroupAddon
                    variant="ghost"
                    align="inline-end"
                    className="pl-0"
                  >
                    <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-[var(--lg-border-subtle)] bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 select-none">
                      <span className="text-xs leading-none">⌘</span>
                      <span className="leading-none">K</span>
                    </kbd>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </CardContent>
            <CardFooter className="pb-6">
              <p className="text-xs text-outline">
                默认扁平风格继承项目基础的 <CodeLabel text="border-input" />{" "}
                及背景配置，能够完美适应各种基础明暗配色方案。
              </p>
            </CardFooter>
          </Card>
        </div>
      </Section>

      {/* =================== Combobox =================== */}
      <Section title="Combobox (带搜索的下拉选择)">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Single Select */}
          <Card className="glass-card flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">
                  单选模式 (Single Select)
                </CardTitle>
                <CardDescription>带搜索和清除功能的单选下拉框</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-on-surface-variant">
                  适用于需要快速过滤搜索的单个对象选择。支持一键快速清空当前值。
                </p>
                <Field>
                  <FieldLabel className="text-xs">
                    选择负责人 (单选)：
                  </FieldLabel>
                  <Combobox
                    data={memberOptions}
                    value={singleMember}
                    onValueChange={setSingleMember}
                    placeholder="所有人员"
                    icon={<User className="size-4" />}
                  />
                </Field>
              </CardContent>
            </div>
            <CardFooter className="pb-6 font-mono text-xs text-outline">
              已选人员 ID: {singleMember || "所有人员"}
            </CardFooter>
          </Card>

          {/* Multiple Select */}
          <Card className="glass-card flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">
                  多选模式 (Multiple Select)
                </CardTitle>
                <CardDescription>内置复选框及计数的多选下拉框</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-on-surface-variant">
                  适用于批量过滤，触发器会自动汇总显示已选择的条目总数。
                </p>
                <Field>
                  <FieldLabel className="text-xs">多选人员 (多选)：</FieldLabel>
                  <Combobox
                    data={memberOptions}
                    value={multipleMembers}
                    onValueChange={setMultipleMembers}
                    type="multiple"
                    prefix="人员："
                    placeholder="全部"
                    icon={<Users className="size-4" />}
                  />
                </Field>
              </CardContent>
            </div>
            <CardFooter className="pb-6 font-mono text-xs text-outline">
              已选人员 ID 列表:{" "}
              {multipleMembers.length > 0 ? multipleMembers.join(", ") : "全部"}
            </CardFooter>
          </Card>
        </div>
      </Section>
    </div>
  )
}
