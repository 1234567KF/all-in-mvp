import { describe, expect, it } from "vitest"

import {
  ALL_PERMISSIONS,
  buildPermissionTree,
  PERMISSION_REGISTRY,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "./permissions.js"

describe("PERMISSION_REGISTRY", () => {
  it("权限码均为 resource:action 格式且无重复", () => {
    const codes = PERMISSION_REGISTRY.map((p) => p.code)
    for (const code of codes) {
      expect(code).toMatch(/^[a-z-]+:[a-z-]+$/)
    }
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("PERMISSIONS 常量与注册表一一对应", () => {
    expect(Object.values(PERMISSIONS).sort()).toEqual(
      PERMISSION_REGISTRY.map((p) => p.code).sort()
    )
  })
})

describe("ALL_PERMISSIONS / ROLE_PERMISSIONS", () => {
  it("ALL_PERMISSIONS 覆盖注册表全量权限码", () => {
    expect(ALL_PERMISSIONS.sort()).toEqual(
      PERMISSION_REGISTRY.map((p) => p.code).sort()
    )
  })

  it("admin 持有全量权限", () => {
    expect(ROLE_PERMISSIONS.admin).toEqual(ALL_PERMISSIONS)
  })

  it("各角色权限码均在注册表值域内", () => {
    const valid = new Set(ALL_PERMISSIONS)
    for (const codes of Object.values(ROLE_PERMISSIONS)) {
      for (const code of codes) {
        expect(valid.has(code), `未登记的权限码 ${code}`).toBe(true)
      }
    }
  })
})

describe("buildPermissionTree", () => {
  it("按注册表声明顺序分组聚合", () => {
    const tree = buildPermissionTree()
    expect(tree).toEqual([
      {
        key: "user",
        label: "用户管理",
        children: [
          { key: "user:view", label: "用户列表", kind: "menu" },
          { key: "user:edit", label: "编辑用户", kind: "action" },
        ],
      },
    ])
  })

  it("树中叶子节点总数等于注册表条目数", () => {
    const leafCount = buildPermissionTree().reduce(
      (sum, g) => sum + g.children.length,
      0
    )
    expect(leafCount).toBe(PERMISSION_REGISTRY.length)
  })
})
