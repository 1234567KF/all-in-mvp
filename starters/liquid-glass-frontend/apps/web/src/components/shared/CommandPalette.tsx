import { useNavigate } from "react-router-dom"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { allMenuItems } from "@/lib/menu-config"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()

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
          {allMenuItems.map((item) => (
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
