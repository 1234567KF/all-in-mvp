---
module: <name>
label: <模块中文名>
version: v1.0
mode: crud
status: active
updatedAt: YYYY-MM-DD
---

# 业务模块规格书：`<模块中文名>`（`<name>`）

> **维护方式（AI-Native）**：本规格书由 AI（`business-feature-builder` 技能）根据开发者的**自然语言需求 / PRD 原件 / 原型 HTML** 自动起草与更新，**开发者无需手写下方表格**。
>
> - **上游原始资料归档（按迭代版本）**：若产品提供了原始 PRD 或静态原型 HTML，由 AI 自动归档至 `docs/requirements/v<X.Y>/`（如 `docs/requirements/v1.0/prd.md`、`docs/requirements/v1.0/<name>.html`），并在下方 `0.2 版本演进记录` 中生成相对链接；日常对话式小改动不建 `requirements/` 目录。
> - **现行唯一事实源（按业务模块）**：永远固定在 `docs/specs/<name>.md`（小版本 `v1.1`、`v1.2` 原地更新第 1~5 节最新全量状态，并在 `0.2 版本演进记录` 追加增量说明）。
> - **大版本归档**：仅当发生推倒重来的跨代重构（如 `v1.x` ➡️ `v2.0`）时，将旧版快照归档至 `docs/specs/archive/v1/<name>.md`。

## 0. 业务背景与版本演进（Business Context & Version History）

### 0.1 原始业务目标与场景

- **业务目标**：`<一句话说明该模块解决什么业务问题>`
- **核心使用角色**：`<如：系统管理员、销售人员、运营人员>`
- **核心业务场景（User Stories）**：
  1. `<场景 1：如管理员维护合同主数据，支持按编码/名称检索与状态启停>`
  2. `<场景 2：如删除已被下游引用的记录时予以拦截提示>`
- **本期范围与非目标（Out of Scope）**：
  - `<明确本期不做的事项，防止 AI 过度设计>`

### 0.2 版本演进记录（Version History）

| 版本号 | 日期         | 变更类型 | 原始资料归档 (PRD / 原型)                                                                                                    | 需求摘要与关键影响点（契约 / 表结构 / 拦截规则 / UI）    |
| ------ | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `v1.0` | `YYYY-MM-DD` | 初始创建 | `[prd.md](../requirements/v1.0/prd.md)` · `[<name>.html](../requirements/v1.0/<name>.html)`（若无外部附件填 `对话直接指令`） | 完成 `<模块中文名>` 基础 CRUD、业务不变量与权限/审计接入 |

---

## 元数据（`gen:module` 生成参数）

| 参数      | 取值                                               | 说明                                                                              |
| --------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `--name`  | `<kebab-case>`（如 `contract` / `purchase-order`） | 必填，决定文件名、表名、权限码前缀与路由路径                                      |
| `--label` | `<模块中文名>`（如 `合同`）                        | 必填（≤30 字符），用于菜单、页面标题与审计模块标签                                |
| `--icon`  | `<LucideIcon>`（默认 `FileText`）                  | `lucide-react` 导出的 PascalCase 图标组件名                                       |
| `--mode`  | `crud` \| `sortable`                               | `crud` = 服务端分页列表（默认）；`sortable` = 字典全量列表 + 拖拽重排 `sortOrder` |

```bash
# 一键生成骨架命令
bun run gen:module --name <name> --label "<模块中文名>" --icon <LucideIcon> --mode <crud|sortable>
```

---

## 1. 核心实体与字段（Entity & Shared Contract）

- **落点文件**：
  - 数据库表定义：`apps/api/src/db/schema.ts`（表名默认复数 snake_case：`<table_name>`）
  - 前后端共享契约：`packages/shared/src/<name>.ts`（Wire 行 Schema + 表单 `FormSchema` + 查询 `ListQuerySchema` / 重排 `ReorderSchema`）

### 1.1 字段清单

| 字段名 (TS / DB)              | 类型 (Zod / Drizzle)      | 必填 / 默认值                  | 校验与长度约束                   | 索引 / 唯一约束          | 业务说明     |
| ----------------------------- | ------------------------- | ------------------------------ | -------------------------------- | ------------------------ | ------------ |
| `id` / `id`                   | `number` / `integer`      | 自增主键                       | `int().positive()`               | PK                       | 主键         |
| `code` / `code`               | `string` / `text`         | 必填（仅 `crud` 模式默认生成） | `trim().min(1).max(50)`          | `uq_<table>_code`        | 业务唯一编码 |
| `name` / `name`               | `string` / `text`         | 必填                           | `trim().min(1).max(100)`         | `sortable` 模式唯一索引  | 名称         |
| `status` / `status`           | `enum` / `text`           | 必填，默认 `"enabled"`         | `z.enum(<UPPER>_STATUS_OPTIONS)` | 普通索引（按需）         | 状态枚举     |
| `description` / `description` | `string \| null` / `text` | 可选，空串归一化为 `null`      | `trim().max(200).optional()`     | 无                       | 备注 / 描述  |
| `sortOrder` / `sort_order`    | `number` / `integer`      | 默认 `0`（仅 `sortable` 模式） | `int()`                          | `idx_<table>_sort_order` | 显示排序权重 |
| `createdAt` / `created_at`    | `string` / `text`         | ISO 时间戳                     | `z.string()`                     | 无                       | 创建时间     |
| `updatedAt` / `updated_at`    | `string` / `text`         | ISO 时间戳                     | `z.string()`                     | 无                       | 更新时间     |

### 1.2 枚举定义（DB 与接口存英文值，中文仅 UI 展示）

| 枚举常量名                | 英文值（DB / Wire） | 中文展示（`*_LABELS`） | 状态徽章语义                   |
| ------------------------- | ------------------- | ---------------------- | ------------------------------ |
| `<UPPER>_STATUS.ENABLED`  | `"enabled"`         | `"启用"`               | `<StatusBadge active={true}>`  |
| `<UPPER>_STATUS.DISABLED` | `"disabled"`        | `"停用"`               | `<StatusBadge active={false}>` |

---

## 2. 业务不变量与拦截规则（Invariants & `ServiceError`）

- **落点文件**：`apps/api/src/modules/<name>/<name>.service.ts`
- **错误处理**：领域异常统一继承 `ServiceError(message, status, code)`，由 `.route.ts` 的 `mapServiceError(c, err)` 或全局 `onError` 转成标准 HTTP 响应。

| 触发动作                   | 拦截条件（业务不变量）                     | HTTP 状态码 | 错误码 (`code`)                                   | 错误类型 (`ServiceError` 子类) | 用户提示文案 (`message`)                   |
| -------------------------- | ------------------------------------------ | ----------- | ------------------------------------------------- | ------------------------------ | ------------------------------------------ |
| `update` / `delete`        | 目标 `id` 在表中不存在                     | `404`       | `<UPPER>_NOT_FOUND`                               | `<Pascal>NotFoundError`        | `<模块中文名>不存在`                       |
| `create` / `update`        | 编码 `code`（或名称 `name`）与其他记录重复 | `409`       | `<UPPER>_CODE_EXISTS`（或 `<UPPER>_NAME_EXISTS`） | `<Pascal>CodeConflictError`    | `<模块中文名>编码「xxx」已存在`            |
| `delete`（字典/主数据）    | 被下游业务表外键引用（引用保护）           | `400`       | `<UPPER>_IN_USE`                                  | `<Pascal>InUseError`           | `该<模块中文名>已被业务记录引用，无法删除` |
| `reorder`（仅 `sortable`） | `ids` 缺项、含重复项或含未知 `id`          | `400`       | `<UPPER>_REORDER_INVALID`                         | `<Pascal>ReorderInvalidError`  | `排序列表必须包含全部记录且不重复`         |

---

## 3. 权限控制（Permissions — Opt-in）

- **落点文件**：
  - 权限注册表：`packages/shared/src/permissions.ts`（`PERMISSIONS` + `PERMISSION_REGISTRY` + `ROLE_PERMISSIONS`）
  - 后端鉴权：`apps/api/src/modules/<name>/<name>.route.ts`（`requirePermission(...)` 中间件；依赖业务状态的动态授权下沉到 `.service.ts`）
  - 前端门控：`apps/web/src/lib/menu-config.ts`（菜单项 `permission`）、`<Pascal>Page.tsx`（`usePermission().can` + `<PermissionGate>`）

| 权限码 (`code`) | 常量名 (`PERMISSIONS.*`)   | 类别 (`kind`) | 默认授予角色                                              | 控制范围（菜单 / 按钮 / 接口）                                         |
| --------------- | -------------------------- | ------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `<name>:view`   | `PERMISSIONS.<UPPER>_VIEW` | `menu`        | `admin`（若普通角色可见，需加入 `ROLE_PERMISSIONS.user`） | 侧边栏 & ⌘K 菜单显隐、列表页查看、`GET /<plural>`                      |
| `<name>:edit`   | `PERMISSIONS.<UPPER>_EDIT` | `action`      | `admin`（按需加入其他角色）                               | 「新增 / 编辑 / 删除 / 拖拽排序」按钮、`POST / PUT / DELETE /<plural>` |

---

## 4. 审计与通知副作用（Audit & Notifications）

### 4.1 审计日志配置

- **落点文件**：
  - 审计常量与筛选映射：`packages/shared/src/audit.ts`（`AUDIT_MODULES.<UPPER>`、`AUDIT_MODULE_LABELS`、`MODULE_EVENT_TYPES`）
  - 声明式 CRUD 审计：`apps/api/src/modules/<name>/<name>.service.ts` 内联 `<UPPER>_AUDIT_CONFIG: TableAuditConfig`

| 配置项            | 取值                                                                  | 说明                                                              |
| ----------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `module`          | `AUDIT_MODULES.<UPPER>`（`"<name>"`）                                 | 审计模块标识，审计日志页可按此筛选                                |
| `fieldLabels`     | `{ code: "编码", name: "名称", status: "状态", description: "描述" }` | `AuditDiffViewer` 展示的中文列名映射（新增业务列必须同步登记）    |
| `excludeColumns`  | `["createdAt", "updatedAt"]`（`sortable` 含 `"sortOrder"`）           | 不计入字段级变更对比的列                                          |
| `snapshotColumns` | `["code", "name", "status", "description"]`                           | 新增（`create`）与删除（`delete`）写入 `snapshot` 的字段集        |
| 非 CRUD 审计      | `createAuditor(AUDIT_MODULES.<UPPER>)`                                | 如拖拽排序（`target: "排序调整"`）、批量导入/状态流转等自定义事件 |

### 4.2 消息通知副作用（可选，无则留空）

- **内核入口**：`apps/api/src/shared/notification.ts`（`notify` / `notifyMany` / `notifySafe`），前端映射见 `apps/web/src/lib/notification-adapter.ts`。

| 触发时机                    | 通知类型 (`type`) | 接收人 (`userId`)   | 标题与正文摘要 | `payload` 业务载荷与点击跳转         |
| --------------------------- | ----------------- | ------------------- | -------------- | ------------------------------------ |
| （如：状态流转 / 指派变更） | `<name>.<event>`  | 目标账号 email / id | 标题 + 摘要    | `{ targetId, routePath: "/<name>" }` |

---

## 5. 界面交互布局（UI Layout & Components）

- **落点文件**：
  - 列表页：`apps/web/src/pages/<name>/<Pascal>Page.tsx`（单文件硬上限 ≤ 450 行，接近 400 行时按弹窗/子区块拆分）
  - 表单弹窗：`apps/web/src/pages/<name>/components/<Pascal>FormDialog.tsx`
  - 表单 Hook：`apps/web/src/pages/<name>/hooks/use<Pascal>Form.ts`
  - 数据层：`apps/web/src/services/<name>.ts` + `apps/web/src/hooks/queries/use<Pascal>.ts`

### 5.1 筛选栏（`FilterBar`，仅 `crud` 模式或按需启用）

- **搜索框（`search`）**：匹配字段（如 `code` / `name`），输入变更时重置 `page = 1`。
- **筛选项（`children`）**：状态下拉（`ALL_FILTER` + `<UPPER>_STATUS_OPTIONS`）及业务扩展筛选项；正确计算 `activeFilterCount` 供移动端底部筛选抽屉角标展示。

### 5.2 桌面端表格列（`DataTable` Columns）与移动端卡片（`MobileCard`）

| 列标题   | 宽度建议    | 桌面端渲染规则                                        | 移动端 `MobileCard` 槽位                       |
| -------- | ----------- | ----------------------------------------------------- | ---------------------------------------------- |
| 编码     | `w-[140px]` | `font-mono text-xs`                                   | `MobileCardTags` → `<Badge variant="outline">` |
| 名称     | `w-[180px]` | `truncate font-medium`                                | `MobileCardTitle` 主标题                       |
| 状态     | `w-[90px]`  | `<StatusBadge active={...}>`                          | `MobileCardTitle` 右侧附属区                   |
| 描述     | `w-[240px]` | `<NullableText value={row.description} />`            | `MobileCardMeta` 左侧                          |
| 更新时间 | `w-[130px]` | `<DateCell value={row.updatedAt} />`                  | `MobileCardMeta` 右侧                          |
| 操作     | `w-[150px]` | `canEdit` 时渲染「编辑 / 删除」按钮，否则显示「只读」 | 卡片底部操作按钮区（`stopPropagation`）        |

### 5.3 新增 / 编辑表单弹窗（`ResponsiveDialog`）

- **容器**：桌面居中 `Dialog`、移动端底部 `Sheet`（统一用 `ResponsiveDialog`）。
- **表单控件与校验**：复用 `packages/shared/src/<name>.ts` 的 `<Pascal>FormSchema`（`zodResolver`）。
- **错误回填**：提交失败时先调用 `applyServerFieldErrors(err, form.setError)` 回填后端 400 字段级错误；非字段错误调用 `showError(extractErrorMessage(err))`。

---

## 6. 落地与门禁验收清单（Acceptance Checklist）

- [ ] 运行 `bun run gen:module` 生成骨架并完成 8 处自动注册
- [ ] 按本规格书更新 `packages/shared/src/<name>.ts` 与 `apps/api/src/db/schema.ts`
- [ ] 同步数据库结构：模板仓库跑 `bun --filter api db:init:generate`；生成项目跑 `bun --filter api db:generate`（本地库重建跑 `bun run db:reset`）
- [ ] 在 `<name>.service.ts` 补齐业务不变量、`TableAuditConfig.fieldLabels` 与引用保护，在 `<name>.route.test.ts` 补齐对应接口与审计断言
- [ ] 在 `<Pascal>Page.tsx` / `<Pascal>FormDialog.tsx` / `use<Pascal>Form.ts` 补齐真实业务列、筛选项与表单控件
- [ ] 全量门禁通过：`bun run typecheck && bun run lint:nocache && bun run arch:check && bun run test`
