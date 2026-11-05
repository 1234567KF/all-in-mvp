import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { usePermission } from "@/hooks/usePermission"
import { allMenuItems, filterMenuItems } from "@/lib/menu-config"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { can } = usePermission()
  // ⌘K 与侧边栏同源过滤：无权限的菜单项不进入搜索结果
  const visibleItems = useMemo(() => filterMenuItems(allMenuItems, can), [can])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="全局搜索"
      description="快捷搜索页面及组件展示"
    >
      <CommandInput placeholder="搜索页面或组件..." />
      <CommandList>
        <CommandEmpty>未找到匹配结果</CommandEmpty>
        <CommandGroup heading="导航">
          {visibleItems.map((item) => (
            <CommandItem
              key={item.path}
              value={`${item.title} ${item.keywords || ""}`}
              onSelect={() => {
                onOpenChange(false)
                navigate(item.path, { viewTransition: true })
              }}
            >
              <item.icon className="size-4" />
              <span>
                {item.title}
                {item.englishSub && ` (${item.englishSub})`}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
