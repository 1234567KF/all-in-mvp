/**
 * menu-config 单测
 *
 * 覆盖：按权限过滤菜单项 / 分组（纯函数，与 store 解耦）、
 * 纯路径面包屑派生（两级 / 单级 / 同路径首项 / 未知路径），
 * 以及 getPageTitle 相对旧行为的回归（每个菜单页标题不变）。
 */
import { Settings } from "lucide-react"
import { type PermissionCode, PERMISSIONS } from "shared"
import { describe, expect, it } from "vitest"

import {
  allMenuItems,
  deriveBreadcrumbMap,
  filterMenuGroups,
  filterMenuItems,
  getBreadcrumbs,
  getPageTitle,
  type MenuGroup,
  menuGroups,
} from "@/lib/menu-config"

// ── 权限过滤 ──────────────────────────────────────────────────────────────────

/** 测试用菜单树：公开项 + 两个带权限的项（其中一个会整组被过滤掉） */
const TEST_GROUPS: MenuGroup[] = [
  {
    label: "管理",
    items: [
      { title: "公开页", path: "/public", icon: Settings },
      {
        title: "仅编辑",
        path: "/edit-only",
        icon: Settings,
        permission: PERMISSIONS.USER_EDIT,
      },
    ],
  },
  {
    label: "只读组",
    items: [
      {
        title: "仅查看",
        path: "/view-only",
        icon: Settings,
        permission: PERMISSIONS.USER_VIEW,
      },
    ],
  },
]

const canEditOnly = (code: PermissionCode) => code === PERMISSIONS.USER_EDIT

describe("filterMenuItems", () => {
  it("permission 缺省视为全员可见", () => {
    const items = filterMenuItems(TEST_GROUPS[0].items, canEditOnly)
    expect(items.map((item) => item.title)).toEqual(["公开页", "仅编辑"])
  })

  it("can 返回 false 的带权限项被过滤", () => {
    const items = filterMenuItems(TEST_GROUPS[1].items, canEditOnly)
    expect(items).toEqual([])
  })
})

describe("审计日志菜单项", () => {
  it("声明 audit:view 权限（admin 可见、普通 user 隐藏）", () => {
    const item = allMenuItems.find((menu) => menu.path === "/audit-log")
    expect(item?.permission).toBe(PERMISSIONS.AUDIT_VIEW)
  })

  it("无 audit:view 权限的用户看不到审计日志菜单", () => {
    const canUserOnly = (code: PermissionCode) => code === PERMISSIONS.USER_VIEW
    const paths = filterMenuGroups(menuGroups, canUserOnly).flatMap((group) =>
      group.items.map((item) => item.path)
    )
    expect(paths).not.toContain("/audit-log")
  })
})

describe("filterMenuGroups", () => {
  it("过滤后清空的分组整组移除", () => {
    const groups = filterMenuGroups(TEST_GROUPS, canEditOnly)
    expect(groups.map((group) => group.label)).toEqual(["管理"])
    expect(groups[0].items.map((item) => item.title)).toEqual([
      "公开页",
      "仅编辑",
    ])
  })

  it("不修改原始分组数据（纯函数）", () => {
    const groups = filterMenuGroups(TEST_GROUPS, canEditOnly)
    expect(groups[0]).not.toBe(TEST_GROUPS[0])
    expect(TEST_GROUPS).toHaveLength(2)
    expect(TEST_GROUPS[1].items).toHaveLength(1)
  })
})

// ── 面包屑派生 ────────────────────────────────────────────────────────────────

describe("deriveBreadcrumbMap", () => {
  it("两级导航：分组 / 页面", () => {
    const map = deriveBreadcrumbMap(menuGroups)
    expect(map.get("/dashboard")).toEqual([
      { title: "Overview" },
      { title: "仪表盘" },
    ])
    expect(map.get("/components")).toEqual([
      { title: "Showcase" },
      { title: "概览" },
    ])
  })

  it("分组名与菜单标题同名时为单级", () => {
    const map = deriveBreadcrumbMap([
      {
        label: "仪表盘",
        items: [{ title: "仪表盘", path: "/dashboard", icon: Settings }],
      },
    ])
    expect(map.get("/dashboard")).toEqual([{ title: "仪表盘" }])
  })

  it("同路径多菜单项以首个为准", () => {
    const map = deriveBreadcrumbMap([
      {
        label: "甲组",
        items: [{ title: "首个", path: "/dup", icon: Settings }],
      },
      {
        label: "乙组",
        items: [{ title: "重复", path: "/dup", icon: Settings }],
      },
    ])
    expect(map.get("/dup")).toEqual([{ title: "甲组" }, { title: "首个" }])
  })

  it("每个菜单路径都有唯一派生结果（覆盖全量导航）", () => {
    const map = deriveBreadcrumbMap(menuGroups)
    expect(map.size).toBe(allMenuItems.length)
  })
})

describe("getBreadcrumbs / getPageTitle", () => {
  it("命中菜单路径 → 返回派生面包屑", () => {
    expect(getBreadcrumbs("/dashboard")).toEqual([
      { title: "Overview" },
      { title: "仪表盘" },
    ])
  })

  it("未知路径 → 回退品牌名", () => {
    expect(getBreadcrumbs("/not-exist")).toEqual([{ title: "Liquid Glass" }])
    expect(getPageTitle("/not-exist")).toBe("Liquid Glass")
  })

  it("getPageTitle 回归：每个菜单页仍返回原菜单标题", () => {
    for (const item of allMenuItems) {
      expect(getPageTitle(item.path), `路径 ${item.path}`).toBe(item.title)
    }
  })
})
