import { describe, expect, it } from "vitest"

import {
  ALL_PERMISSIONS,
  buildPermissionTree,
  DEFAULT_ROLE,
  PERMISSION_REGISTRY,
  PERMISSIONS,
  permissionsForRole,
  ROLE_PERMISSIONS,
} from "./permissions.js"

describe("PERMISSION_REGISTRY", () => {
  it("权限码均为 resource:action 格式且无重复", () => {
    const codes = PERMISSION_REGISTRY.map((p) => p.code)
    for (const code of codes) {
      // resource 段允许数字（如 gen:module 生成的 `b2b:view`），action 段保持小写字母
      expect(code).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z-]*$/)
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

  it("permissionsForRole 按角色解析权限码", () => {
    expect(permissionsForRole("admin")).toEqual(ALL_PERMISSIONS)
    expect(permissionsForRole("user")).toEqual(ROLE_PERMISSIONS.user)
  })

  it("permissionsForRole：null / undefined → 按 DEFAULT_ROLE 解析（与 JWT 兜底一致）", () => {
    expect(permissionsForRole(null)).toEqual(ROLE_PERMISSIONS[DEFAULT_ROLE])
    expect(permissionsForRole(undefined)).toEqual(
      ROLE_PERMISSIONS[DEFAULT_ROLE]
    )
  })

  it("permissionsForRole：未知角色 / 空串 → 空数组（fail-closed）", () => {
    expect(permissionsForRole("ghost")).toEqual([])
    expect(permissionsForRole("")).toEqual([])
  })

  it("permissionsForRole：原型键名（toString / __proto__ / constructor）→ 空数组", () => {
    for (const role of [
      "toString",
      "__proto__",
      "constructor",
      "hasOwnProperty",
    ]) {
      expect(permissionsForRole(role), role).toEqual([])
    }
  })

  it("permissionsForRole：返回副本，修改结果不污染 ROLE_PERMISSIONS", () => {
    const codes = permissionsForRole(DEFAULT_ROLE)
    codes.push("tampered:code")
    expect(ROLE_PERMISSIONS[DEFAULT_ROLE]).not.toContain("tampered:code")
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

    // starter 基线：内置 user / audit 分组必须存在（防止注册表被误删后派生断言自证）
    expect(tree.map((group) => group.key)).toEqual(
      expect.arrayContaining(["user", "audit"])
    )
    expect(tree.find((group) => group.key === "user")?.children).toEqual([
      { key: "user:view", label: "用户列表", kind: "menu" },
      { key: "user:edit", label: "编辑用户", kind: "action" },
    ])

    // 期望值由注册表派生（不写死模块清单）：bun run gen:module 追加业务权限后
    // 该断言应继续成立，无需修改测试。
    const expectedGroupOrder = [
      ...new Set(PERMISSION_REGISTRY.map((def) => def.group)),
    ]
    expect(tree.map((group) => group.key)).toEqual(expectedGroupOrder)

    for (const group of tree) {
      const defs = PERMISSION_REGISTRY.filter((def) => def.group === group.key)
      expect(group.label).toBe(defs[0].groupLabel)
      expect(group.children).toEqual(
        defs.map((def) => ({
          key: def.code,
          label: def.label,
          kind: def.kind,
        }))
      )
    }
  })

  it("树中叶子节点总数等于注册表条目数", () => {
    const leafCount = buildPermissionTree().reduce(
      (sum, g) => sum + g.children.length,
      0
    )
    expect(leafCount).toBe(PERMISSION_REGISTRY.length)
  })
})
