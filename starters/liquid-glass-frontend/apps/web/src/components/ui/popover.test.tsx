import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

describe("Popover", () => {
  afterEach(() => cleanup())

  it("wires Title/Description into the dialog accessible name", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>打开主题色</PopoverTrigger>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>主题色</PopoverTitle>
            <PopoverDescription>选择界面强调色</PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    )

    const dialog = screen.getByRole("dialog")

    expect(dialog).toHaveAccessibleName("主题色")
    expect(dialog).toHaveAccessibleDescription("选择界面强调色")
  })
})
