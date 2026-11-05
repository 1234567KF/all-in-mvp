/**
 * gen:module 单测 — 命名派生 / CLI 解析 / 模板渲染 / 注册点接线
 *
 * 生成器本身不改运行时代码，验证重点：
 * 1. 命名派生与参数校验（决定文件路径、标识符、权限码，错一个字就是坏模块）；
 * 2. 锚点插入的纯函数行为（锚点缺失必须报错而不是静默写坏文件）；
 * 3. 生成文件清单与关键契约（crud / sortable 两种模式各 9 个文件）；
 * 4. 注册点幂等（同一模块重复注册必须跳过，不能重复追加权限/路由/菜单）。
 *
 * 端到端验收（生成后跑 typecheck/lint/arch:check/test）见 README「业务模块生成器」。
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "bun:test"

import {
  addLucideIcon,
  appendSection,
  assertIconExists,
  buildSpec,
  detectExistingModuleState,
  ensurePermissionsValueImport,
  GenModuleError,
  getLucideIconNames,
  hasLineStartingWith,
  insertAfterMarker,
  insertBeforeMarker,
  MARKERS,
  parseArgs,
  pluralize,
  pluralizeKebab,
  pluralizeSnake,
  renderDbTable,
  renderModuleFiles,
  renderNamedImports,
  renderRegistrationChanges,
  resolveRepoRoot,
  rollbackWrites,
  toCamel,
  toPascal,
  toSnake,
  toUpperSnake,
} from "./gen-module"

// ─── 命名派生 ────────────────────────────────────────────────────────────────

describe("命名派生", () => {
  it("kebab 各形态：单词 / 多段", () => {
    expect(toCamel("contract")).toBe("contract")
    expect(toCamel("purchase-order")).toBe("purchaseOrder")
    expect(toPascal("contract")).toBe("Contract")
    expect(toPascal("purchase-order")).toBe("PurchaseOrder")
    expect(toSnake("purchase-order")).toBe("purchase_order")
    expect(toUpperSnake("purchase-order")).toBe("PURCHASE_ORDER")
  })

  it("复数规则：常规 / s-x-ch-sh / 辅音+y / 多段只变最后一段", () => {
    expect(pluralize("contract")).toBe("contracts")
    expect(pluralize("box")).toBe("boxes")
    expect(pluralize("match")).toBe("matches")
    expect(pluralize("category")).toBe("categories")
    expect(pluralize("day")).toBe("days")
    expect(pluralizeKebab("purchase-order")).toBe("purchase-orders")
    expect(pluralizeSnake("purchase_order")).toBe("purchase_orders")
  })
})

// ─── 参数解析与规格校验 ──────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("支持空格与 = 两种取值形式，布尔开关缺省 false", () => {
    const options = parseArgs([
      "--name",
      "contract",
      "--label=合同",
      "--mode",
      "sortable",
      "--force",
      "--dry-run",
    ])
    expect(options.name).toBe("contract")
    expect(options.label).toBe("合同")
    expect(options.mode).toBe("sortable")
    expect(options.force).toBe(true)
    expect(options.dryRun).toBe(true)
    expect(options.skipDb).toBe(false)
    expect(options.icon).toBe("FileText")
  })

  it("--help / -h 置位", () => {
    expect(parseArgs(["--help"]).help).toBe(true)
    expect(parseArgs(["-h"]).help).toBe(true)
  })

  it("未知参数 / 缺值 → GenModuleError", () => {
    expect(() => parseArgs(["--bogus"])).toThrow(GenModuleError)
    expect(() => parseArgs(["--name"])).toThrow(GenModuleError)
    expect(() => parseArgs(["--name", "--label", "合同"])).toThrow(
      GenModuleError
    )
  })

  it("布尔参数显式取值：--force=false 不等于 true", () => {
    expect(parseArgs(["--force=false"]).force).toBe(false)
    expect(parseArgs(["--force=true"]).force).toBe(true)
    expect(() => parseArgs(["--force=yes"])).toThrow(GenModuleError)
  })
})

describe("buildSpec", () => {
  it("crud 规格派生（table / 权限码 / 路由路径）", () => {
    const spec = buildSpec({ name: "contract", label: "合同" })
    expect(spec.pascal).toBe("Contract")
    expect(spec.camel).toBe("contract")
    expect(spec.table).toBe("contracts")
    expect(spec.upper).toBe("CONTRACT")
    expect(spec.apiPath).toBe("/contracts")
    expect(spec.routePath).toBe("/contract")
    expect(spec.permissionView).toBe("contract:view")
    expect(spec.permissionEdit).toBe("contract:edit")
    expect(spec.mode).toBe("crud")
  })

  it("多段 kebab 与 y 结尾复数：purchase-order / category", () => {
    const order = buildSpec({ name: "purchase-order", label: "采购单" })
    expect(order.pascal).toBe("PurchaseOrder")
    expect(order.table).toBe("purchase_orders")
    expect(order.apiPath).toBe("/purchase-orders")
    expect(order.routePath).toBe("/purchase-order")

    const category = buildSpec({
      name: "category",
      label: "分类",
      mode: "sortable",
    })
    expect(category.table).toBe("categories")
    expect(category.mode).toBe("sortable")
  })

  it("非法输入 → GenModuleError（大写 / 下划线 / 数字开头 / 保留名 / 缺 label / 坏图标 / 坏模式）", () => {
    expect(() => buildSpec({ name: "Contract", label: "合同" })).toThrow()
    expect(() =>
      buildSpec({ name: "purchase_order", label: "采购单" })
    ).toThrow()
    expect(() => buildSpec({ name: "1contract", label: "合同" })).toThrow()
    expect(() => buildSpec({ name: "user", label: "用户" })).toThrow(
      GenModuleError
    )
    expect(() => buildSpec({ name: "auth", label: "认证" })).toThrow(
      GenModuleError
    )
    expect(() => buildSpec({ name: "audit", label: "审计" })).toThrow(
      GenModuleError
    )
    expect(() => buildSpec({ name: "system", label: "系统" })).toThrow(
      GenModuleError
    )
    expect(() => buildSpec({ name: "dashboard", label: "看板" })).toThrow(
      GenModuleError
    )
    expect(() => buildSpec({ name: "contract" })).toThrow()
    expect(() =>
      buildSpec({ name: "contract", label: "合同", icon: "file-text" })
    ).toThrow()
    expect(() =>
      buildSpec({ name: "contract", label: "合同", mode: "list" })
    ).toThrow()
    expect(() => buildSpec({ name: "contract", label: "合同\n注入" })).toThrow()
  })
})

// ─── 锚点插入 ────────────────────────────────────────────────────────────────

describe("锚点插入", () => {
  const content = ["// head", "// [probe:marker] 注释", "// tail", ""].join(
    "\n"
  )

  it("insertAfterMarker 在锚点行后插入", () => {
    const next = insertAfterMarker(content, "// [probe:marker]", "NEW\n")
    expect(next).toBe("// head\n// [probe:marker] 注释\nNEW\n// tail\n")
  })

  it("insertBeforeMarker 在锚点行前插入", () => {
    const next = insertBeforeMarker(content, "// [probe:marker]", "NEW\n")
    expect(next).toBe("// head\nNEW\n// [probe:marker] 注释\n// tail\n")
  })

  it("锚点缺失 → GenModuleError（不猜测位置）", () => {
    expect(() => insertAfterMarker(content, "// [missing]", "x\n")).toThrow(
      GenModuleError
    )
    expect(() => insertBeforeMarker(content, "// [missing]", "x\n")).toThrow(
      GenModuleError
    )
  })

  it("appendSection 收敛末尾空行并追加段落", () => {
    expect(appendSection("const a = 1\n\n\n", "// section\nconst b = 2")).toBe(
      "const a = 1\n\n// section\nconst b = 2\n"
    )
  })

  it("addLucideIcon 按字母序插入；已存在则不重复", () => {
    const menu =
      'import {\n  Settings,\n  type LucideIcon,\n} from "lucide-react"\n'
    const withTag = addLucideIcon(menu, "Tag")
    expect(withTag).toContain("type LucideIcon")
    expect(withTag.indexOf("Settings")).toBeLessThan(withTag.indexOf("Tag"))
    expect(addLucideIcon(withTag, "Tag")).toBe(withTag)
  })
})

// ─── 生成文件清单与关键契约 ──────────────────────────────────────────────────

describe("renderModuleFiles", () => {
  it("crud 模式生成 9 个文件，路径符合仓库布局", () => {
    const spec = buildSpec({ name: "contract", label: "合同" })
    const files = renderModuleFiles(spec)
    expect(files.map((file) => file.relPath)).toEqual([
      "packages/shared/src/contract.ts",
      "apps/api/src/modules/contract/contract.service.ts",
      "apps/api/src/modules/contract/contract.route.ts",
      "apps/api/src/modules/contract/contract.route.test.ts",
      "apps/web/src/services/contract.ts",
      "apps/web/src/hooks/queries/useContract.ts",
      "apps/web/src/pages/contract/ContractPage.tsx",
      "apps/web/src/pages/contract/components/ContractFormDialog.tsx",
      "apps/web/src/pages/contract/hooks/useContractForm.ts",
    ])
  })

  it("crud 模板关键内容：权限码 / 时务审计 / 分页查询 / 路由挂载", () => {
    const spec = buildSpec({ name: "contract", label: "合同" })
    const files = new Map(
      renderModuleFiles(spec).map((file) => [file.relPath, file.content])
    )
    const shared = files.get("packages/shared/src/contract.ts")!
    expect(shared).toContain("CONTRACT_STATUS")
    expect(shared).toContain("ContractListQuerySchema")
    expect(shared).toContain("code: z.string()")

    const service = files.get(
      "apps/api/src/modules/contract/contract.service.ts"
    )!
    expect(service).toContain("CONTRACT_AUDIT_CONFIG")
    expect(service).toContain("auditedInsert")
    expect(service).toContain("escapeLike")

    const route = files.get("apps/api/src/modules/contract/contract.route.ts")!
    expect(route).toContain("requirePermission(PERMISSIONS.CONTRACT_VIEW)")
    expect(route).toContain("listContracts(parsed.data)")
    expect(route).toContain('createContract(c.get("opCtx")!, parsed.data)')

    const page = files.get("apps/web/src/pages/contract/ContractPage.tsx")!
    expect(page).toContain("DataTable<Contract>")
    expect(page).toContain("ConfirmDialog")

    // 生成器模板占位符不应泄漏到生成结果（SQL 模板里的运行时插值不在此列）
    for (const content of files.values()) {
      for (const placeholder of [
        "${pascal}",
        "${pluralPascal}",
        "${table}",
        "${label}",
        "${spec.",
      ]) {
        expect(content).not.toContain(placeholder)
      }
    }
  })

  it("sortable 模式：重排契约 / sortOrder / 拖拽页 / 引用保护 TODO", () => {
    const spec = buildSpec({
      name: "category",
      label: "分类",
      mode: "sortable",
    })
    const files = new Map(
      renderModuleFiles(spec).map((file) => [file.relPath, file.content])
    )
    const shared = files.get("packages/shared/src/category.ts")!
    expect(shared).toContain("CategoryReorderSchema")
    expect(shared).toContain("sortOrder")
    expect(shared).not.toContain("CategoryListQuery")

    const service = files.get(
      "apps/api/src/modules/category/category.service.ts"
    )!
    expect(service).toContain("reorderCategories")
    expect(service).toContain("TODO(引用保护)")
    expect(service).toContain("db.transaction")

    const route = files.get("apps/api/src/modules/category/category.route.ts")!
    expect(route).toContain('"/reorder"')
    expect(route.indexOf('"/reorder"')).toBeLessThan(route.indexOf('"/:id"'))

    const page = files.get("apps/web/src/pages/category/CategoryPage.tsx")!
    expect(page).toContain("draggable")
    expect(page).toContain("onReorder")
  })

  it("renderDbTable：crud 唯一索引 key 为 code，sortable 为 name + sort_order 索引", () => {
    const crud = renderDbTable(buildSpec({ name: "contract", label: "合同" }))
    expect(crud).toContain('uniqueIndex("uq_contracts_code").on(table.code)')

    const sortable = renderDbTable(
      buildSpec({ name: "category", label: "分类", mode: "sortable" })
    )
    expect(sortable).toContain(
      'uniqueIndex("uq_categories_name").on(table.name)'
    )
    expect(sortable).toContain(
      'index("idx_categories_sort_order").on(table.sortOrder)'
    )
  })
})

// ─── 注册点：接线 + 幂等 ─────────────────────────────────────────────────────

/** 覆盖全部锚点的最小夹具（与模板文件形态一致） */
function makeRegistryFixtures(): Record<string, string> {
  return {
    "packages/shared/src/permissions.ts": [
      "export const PERMISSIONS = {",
      "  // [gen:module:permissions] 由 bun run gen:module 追加业务模块权限码（勿手改本行）",
      '  USER_VIEW: "user:view",',
      "} as const",
      "",
      "export const PERMISSION_REGISTRY: PermissionDef[] = [",
      "  // [gen:module:permission-registry] 由 bun run gen:module 追加业务模块权限注册（勿手改本行）",
      "]",
      "",
    ].join("\n"),
    "packages/shared/src/audit.ts": [
      "export const AUDIT_MODULES = {",
      "  // [gen:module:audit-modules] 锚点",
      '  USER: "user",',
      "} as const",
      "",
      "export const AUDIT_MODULE_LABELS: Record<AuditModule, string> = {",
      "  // [gen:module:audit-module-labels] 锚点",
      '  user: "用户管理",',
      "}",
      "",
      "export const MODULE_EVENT_TYPES: Record<string, readonly AuditEventType[]> = {",
      "  // [gen:module:audit-module-event-types] 锚点",
      '  user: ["create"],',
      "}",
      "",
    ].join("\n"),
    "packages/shared/src/index.ts":
      'export { type ApiResponse } from "./response.js"\n',
    "apps/api/src/db/schema.ts": "export const users = sqliteTable\n",
    "apps/api/src/index.ts": [
      'import { env } from "./env.js"',
      "",
      "// [gen:module:api-route-imports] 锚点",
      "",
      'app.route("/logs", logsRoute)',
      "// [gen:module:api-route-mounts] 锚点",
      "",
      "export { app }",
      "",
    ].join("\n"),
    "apps/web/src/lib/query-keys.ts": [
      "// [gen:module:query-keys] 锚点",
      "export const logKeys = {}",
      "",
    ].join("\n"),
    "apps/web/src/App.tsx": [
      'const ResultPage = lazy(() => import("@/pages/ResultPage"))',
      "",
      "// [gen:module:app-lazy-imports] 锚点",
      "",
      "export default function App() {",
      "  return (",
      "    <Routes>",
      "      <Route element={<SidebarLayout />}>",
      "        {/* [gen:module:app-routes] */}",
      "      </Route>",
      "    </Routes>",
      "  )",
      "}",
      "",
    ].join("\n"),
    "apps/web/src/lib/menu-config.ts": [
      "import {",
      "  Settings,",
      '} from "lucide-react"',
      "",
      "export const menuGroups: MenuGroup[] = [",
      "  {",
      '    label: "Overview",',
      '    items: [{ title: "仪表盘", path: "/dashboard", icon: Settings }],',
      "  },",
      "  // [gen:module:menu-groups] 锚点",
      "]",
      "",
    ].join("\n"),
  }
}

describe("renderRegistrationChanges", () => {
  it("首次生成：8 个注册文件全部产生变更（权限 / 审计 / 导出 / 表 / 挂载 / key / 路由 / 菜单）", () => {
    const spec = buildSpec({ name: "contract", label: "合同" })
    const fixtures = makeRegistryFixtures()
    const changes = renderRegistrationChanges(
      spec,
      (relPath) => fixtures[relPath] ?? null
    )
    expect(changes.map((change) => change.relPath)).toEqual([
      "packages/shared/src/permissions.ts",
      "packages/shared/src/audit.ts",
      "packages/shared/src/index.ts",
      "apps/api/src/db/schema.ts",
      "apps/api/src/index.ts",
      "apps/web/src/lib/query-keys.ts",
      "apps/web/src/App.tsx",
      "apps/web/src/lib/menu-config.ts",
    ])

    const byPath = new Map(
      changes.map((change) => [change.relPath, change.after])
    )
    const permissions = byPath.get("packages/shared/src/permissions.ts")!
    expect(permissions).toContain('CONTRACT_VIEW: "contract:view"')
    expect(permissions).toContain("code: PERMISSIONS.CONTRACT_VIEW")
    expect(permissions).toContain('groupLabel: "合同管理"')

    const audit = byPath.get("packages/shared/src/audit.ts")!
    expect(audit).toContain('CONTRACT: "contract"')
    expect(audit).toContain('"contract": "合同管理"')
    expect(audit).toContain('"contract": ["create", "update", "delete"]')

    const sharedIndex = byPath.get("packages/shared/src/index.ts")!
    expect(sharedIndex).toContain('} from "./contract.js"')

    const schema = byPath.get("apps/api/src/db/schema.ts")!
    expect(schema).toContain("export const contracts = sqliteTable")

    const apiIndex = byPath.get("apps/api/src/index.ts")!
    expect(apiIndex).toContain('from "./modules/contract/contract.route.js"')
    expect(apiIndex).toContain('app.route("/contracts", contractRoute)')

    const queryKeys = byPath.get("apps/web/src/lib/query-keys.ts")!
    expect(queryKeys).toContain("export const contractKeys = {")

    const app = byPath.get("apps/web/src/App.tsx")!
    expect(app).toContain('import("@/pages/contract/ContractPage")')
    expect(app).toContain('path="/contract"')

    const menu = byPath.get("apps/web/src/lib/menu-config.ts")!
    expect(menu).toContain('label: "Business"')
    expect(menu).toContain("permission: PERMISSIONS.CONTRACT_VIEW")
  })

  it("幂等：把首次结果作为新内容再跑一遍 → 0 个变更", () => {
    const spec = buildSpec({ name: "contract", label: "合同" })
    const first = makeRegistryFixtures()
    const changes = renderRegistrationChanges(
      spec,
      (relPath) => first[relPath] ?? null
    )
    for (const change of changes) first[change.relPath] = change.after

    const second = renderRegistrationChanges(
      spec,
      (relPath) => first[relPath] ?? null
    )
    expect(second).toEqual([])
  })

  it("第二个 sortable 模块：追加到已有 Business 分组内，不重复建组", () => {
    const crud = buildSpec({ name: "contract", label: "合同" })
    const fixtures = makeRegistryFixtures()
    for (const change of renderRegistrationChanges(
      crud,
      (relPath) => fixtures[relPath] ?? null
    )) {
      fixtures[change.relPath] = change.after
    }

    const sortable = buildSpec({
      name: "category",
      label: "分类",
      mode: "sortable",
    })
    const changes = renderRegistrationChanges(
      sortable,
      (relPath) => fixtures[relPath] ?? null
    )
    const menu = changes.find(
      (change) => change.relPath === "apps/web/src/lib/menu-config.ts"
    )!
    expect((menu.after.match(/label: "Business"/g) ?? []).length).toBe(1)
    expect(menu.after).toContain('path: "/category"')
    expect(menu.after).toContain("permission: PERMISSIONS.CATEGORY_VIEW")
    // 生成顺序 = 菜单顺序：先生成的 contract 排在后来生成的 category 之前
    expect(menu.after.indexOf('path: "/contract"')).toBeLessThan(
      menu.after.indexOf('path: "/category"')
    )
  })

  it("注册文件缺失 → GenModuleError", () => {
    const spec = buildSpec({ name: "contract", label: "合同" })
    expect(() => renderRegistrationChanges(spec, () => null)).toThrow(
      GenModuleError
    )
  })
})

// ─── 渲染结果语法安全 ────────────────────────────────────────────────────────

/** 用 Bun.Transpiler 做语法解析（只解析不执行，等价于 tsc 的 parseDiagnostics） */
function assertParses(file: { relPath: string; content: string }): void {
  const loader = file.relPath.endsWith(".tsx") ? "tsx" : "ts"
  expect(
    () => new Bun.Transpiler({ loader }).transformSync(file.content),
    file.relPath
  ).not.toThrow()
}

describe("渲染结果语法安全", () => {
  it("crud / sortable / 多词 / 中文标点 label 的全部渲染文件均可被 TS 解析", () => {
    const specs = [
      buildSpec({ name: "contract", label: "合同" }),
      buildSpec({ name: "category", label: "分类", mode: "sortable" }),
      buildSpec({ name: "purchase-order", label: "采购单（含税）" }),
      buildSpec({ name: "v2-record", label: "V2 记录 · 测试" }),
    ]
    for (const spec of specs) {
      for (const file of renderModuleFiles(spec)) assertParses(file)
    }
  })

  it("每个生成的 API 测试文件都在 450 行以内（arch:check 行数棘轮）", () => {
    for (const spec of [
      buildSpec({ name: "contract", label: "合同" }),
      buildSpec({ name: "category", label: "分类", mode: "sortable" }),
    ]) {
      const testFile = renderModuleFiles(spec).find((file) =>
        file.relPath.endsWith("route.test.ts")
      )!
      expect(testFile.content.split("\n").length).toBeLessThan(450)
    }
  })
})

// ─── 工具函数 ────────────────────────────────────────────────────────────────

describe("工具函数", () => {
  it("renderNamedImports 去重并排序（--icon 与页面内置图标同名不重复导入）", () => {
    expect(renderNamedImports(["Pencil", "Pencil", "Plus", "Trash2"])).toBe(
      "Pencil, Plus, Trash2"
    )
  })

  it("hasLineStartingWith 按整行前缀判断（避免子串误判）", () => {
    const content =
      '  SUB_CONTRACT_VIEW: "sub-contract:view",\n  CONTRACT_EDIT: "contract:edit",\n'
    expect(hasLineStartingWith(content, "CONTRACT_VIEW:")).toBe(false)
    expect(hasLineStartingWith(content, "CONTRACT_EDIT:")).toBe(true)
  })

  it("getLucideIconNames 解析真实 lucide-react；不存在图标在生成阶段报错", () => {
    const names = getLucideIconNames(resolveRepoRoot())
    if (!names) {
      // 依赖未安装（bun install 之前）时跳过严格校验，与生成器运行时行为一致
      return
    }
    expect(names.has("FileText")).toBe(true)
    expect(() =>
      assertIconExists("NotARealIconXYZ", resolveRepoRoot())
    ).toThrow(GenModuleError)
    expect(() => assertIconExists("FileText", resolveRepoRoot())).not.toThrow()
  })

  it("rollbackWrites 恢复旧内容 / 删除本次新建文件", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "gen-module-"))
    try {
      mkdirSync(path.join(dir, "a/b"), { recursive: true })
      writeFileSync(path.join(dir, "a/existing.ts"), "after", "utf8")
      writeFileSync(path.join(dir, "a/b/new.ts"), "new", "utf8")

      rollbackWrites(
        dir,
        new Map<string, string | null>([
          ["a/existing.ts", "before"],
          ["a/b/new.ts", null],
        ])
      )

      expect(readFileSync(path.join(dir, "a/existing.ts"), "utf8")).toBe(
        "before"
      )
      expect(existsSync(path.join(dir, "a/b/new.ts"))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("ensurePermissionsValueImport 能给降级后的 type-only 导入补回 PERMISSIONS", () => {
    const typeOnly = 'import type { PermissionCode } from "shared"\n'
    const next = ensurePermissionsValueImport(typeOnly)
    expect(next).toContain(
      'import { type PermissionCode, PERMISSIONS } from "shared"'
    )

    const already =
      'import { type PermissionCode, PERMISSIONS } from "shared"\n'
    expect(ensurePermissionsValueImport(already)).toBe(already)
  })
})

// ─── 注册点边界 ──────────────────────────────────────────────────────────────

describe("注册点边界", () => {
  it("sub-contract 先注册后，contract 仍能完整注册（不做子串误判）", () => {
    const fixtures = makeRegistryFixtures()
    const apply = (spec: ReturnType<typeof buildSpec>) => {
      for (const change of renderRegistrationChanges(
        spec,
        (relPath) => fixtures[relPath] ?? null
      )) {
        fixtures[change.relPath] = change.after
      }
    }
    apply(buildSpec({ name: "sub-contract", label: "子合同" }))
    apply(buildSpec({ name: "contract", label: "合同" }))

    const permissions = fixtures["packages/shared/src/permissions.ts"]
    expect(permissions).toContain('CONTRACT_VIEW: "contract:view"')
    expect(permissions).toContain('SUB_CONTRACT_VIEW: "sub-contract:view"')
    const schema = fixtures["apps/api/src/db/schema.ts"]
    expect(schema).toContain("export const contracts = sqliteTable")
    expect(schema).toContain("export const sub_contracts = sqliteTable")
  })
})

// ─── --force 参数变化护栏 ────────────────────────────────────────────────────

describe("detectExistingModuleState", () => {
  const readFrom = (overrides: Record<string, string>) => (relPath: string) =>
    overrides[relPath] ?? null

  it("service 不存在 → null（视为全新模块）", () => {
    const spec = buildSpec({ name: "contract", label: "合同" })
    expect(detectExistingModuleState(spec, () => null)).toBeNull()
  })

  it("解析已生成模块的 mode / label / icon", () => {
    const spec = buildSpec({
      name: "category",
      label: "分类",
      mode: "sortable",
    })
    const read = readFrom({
      "apps/api/src/modules/category/category.service.ts":
        "// sortOrder / reorderCategorys",
      "packages/shared/src/category.ts":
        "/**\n * 分类 — 前后端共享契约（gen:module 生成）\n */\n",
      "apps/web/src/lib/menu-config.ts":
        '        title: "分类",\n        path: "/category",\n        icon: Tag,\n',
    })
    expect(detectExistingModuleState(spec, read)).toEqual({
      mode: "sortable",
      label: "分类",
      icon: "Tag",
    })
  })

  it("crud 生成模块被解析为 crud", () => {
    const spec = buildSpec({ name: "contract", label: "合同" })
    const read = readFrom({
      "apps/api/src/modules/contract/contract.service.ts": "// listContracts",
      "packages/shared/src/contract.ts":
        "/**\n * 合同 — 前后端共享契约（gen:module 生成）\n */\n",
    })
    expect(detectExistingModuleState(spec, read)?.mode).toBe("crud")
  })
})

// ─── 真实注册文件锚点 ────────────────────────────────────────────────────────

describe("真实注册文件锚点", () => {
  const repoRoot = resolveRepoRoot()
  const FILE_BY_MARKER: Record<keyof typeof MARKERS, string> = {
    permissions: "packages/shared/src/permissions.ts",
    permissionRegistry: "packages/shared/src/permissions.ts",
    auditModules: "packages/shared/src/audit.ts",
    auditModuleLabels: "packages/shared/src/audit.ts",
    auditModuleEventTypes: "packages/shared/src/audit.ts",
    apiRouteImports: "apps/api/src/index.ts",
    apiRouteMounts: "apps/api/src/index.ts",
    appLazyImports: "apps/web/src/App.tsx",
    appRoutes: "apps/web/src/App.tsx",
    queryKeys: "apps/web/src/lib/query-keys.ts",
    menuGroups: "apps/web/src/lib/menu-config.ts",
    menuItems: "apps/web/src/lib/menu-config.ts",
  }

  const readReal = (relPath: string): string | null => {
    const fullPath = path.join(repoRoot, relPath)
    return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : null
  }

  it("模板内置 MARKERS 在真实注册文件中出现且仅出现一次", () => {
    for (const [key, relPath] of Object.entries(FILE_BY_MARKER)) {
      const content = readReal(relPath)
      expect(content, relPath).not.toBeNull()
      const marker = MARKERS[key as keyof typeof MARKERS]
      const occurrences = (content as string).split(marker).length - 1
      // menuItems 锚点由首次生成创建在 Business 分组内，模板里可以不存在；
      // 存在时也必须唯一（防止重复生成时出现两个锚点）。
      if (key === "menuItems") {
        expect(occurrences, relPath + " 的锚点 " + marker).toBeLessThanOrEqual(
          1
        )
      } else {
        expect(occurrences, relPath + " 的锚点 " + marker).toBe(1)
      }
    }
  })

  it("对真实注册文件副本跑注册计算：变更可应用且二次幂等", () => {
    const spec = buildSpec({ name: "review-probe", label: "评审探针" })
    const first = renderRegistrationChanges(spec, readReal)
    const applied = new Map<string, string>()
    for (const change of first) applied.set(change.relPath, change.after)

    const second = renderRegistrationChanges(
      spec,
      (relPath) => applied.get(relPath) ?? readReal(relPath)
    )
    expect(second).toEqual([])
  })
})
