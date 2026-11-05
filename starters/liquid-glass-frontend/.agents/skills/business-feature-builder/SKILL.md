---
name: business-feature-builder
description: >-
  Use when building a new business module, CRUD page, dictionary or category management feature, or full-stack domain in this monorepo. Guides 5-element requirement alignment, scaffolds full-stack files via gen:module, implements shared Zod contracts, Drizzle SQLite schema, ServiceError invariants, declarative audit logs, and Liquid Glass UI components, and verifies all architecture gates.
metadata:
  pattern: inversion + pipeline
  domain: fullstack-business-module
---

# Overview

Execute this workflow to build or evolve a production-ready full-stack business module across `packages/shared`, `apps/api`, and `apps/web`. Follow all phases in strict sequential order. Do NOT skip phases or write application code before the requirement and 5-element specification are aligned.

## Human vs. AI Responsibility Boundary

- **Human provides**: Raw business intent in natural language (a few sentences, raw PRD files, prototype HTML files, screenshots, or change requests) and confirms key business decisions (fields, invariants, permissions). The human NEVER manually creates folders in `docs/requirements/` or manually copies/fills out `docs/specs/<name>.md`.
- **AI owns**:
  1. **Auto-archiving raw inputs (when provided)**: Filing raw PRD/HTML/asset files provided by the user into `docs/requirements/v<X.Y>/` (version-first, since one release version may span multiple modules), and linking them in `docs/specs/<name>.md` under `0.2 版本演进记录`. Ad-hoc conversational tweaks without raw files do NOT create directories in `docs/requirements/`.
  2. **Translating intent & HTML prototypes into the 5-element specification**: Extracting information architecture (fields, filter controls, columns, dialog inputs, state tabs) from raw PRDs and prototype HTML while discarding hardcoded HTML colors/styles in favor of Liquid Glass components and `--lg-*` tokens.
  3. **Interviewing the user ONLY on ambiguous business rules** (Phase 1), then generating or updating `docs/specs/<name>.md` (including Section 0 Business Context & Version History + Elements 1–5) as the persistent domain record.
  4. **Running `bun run gen:module`** (Phase 2), implementing full-stack code and tests (Phases 3–5), and passing all verification gates (Phase 6).

---

# Workflow

## Phase 1 — Requirement Alignment & Spec Generation (Inversion Gate)

1. **Raw Material Intake & Auto-Archiving (`docs/requirements/v<X.Y>/`)**:
   - Check whether the user supplied raw product artifacts (PRD `.md`/`.pdf`, prototype `.html`, or screenshots/assets) via workspace paths, external file paths (e.g., `~/Downloads/...`), or pasted content:
     - **With raw artifacts**: Automatically archive them under `docs/requirements/v<X.Y>/` (e.g., `docs/requirements/v1.0/prd.md`, `docs/requirements/v1.0/<name>.html`, `docs/requirements/v1.0/assets/`). Move temporary files dropped in the workspace root or copy files from external paths so `docs/requirements/v<X.Y>/` preserves a clean, read-only snapshot of that release's product inputs.
     - **Prototype HTML consumption rule ("keep structure, replace skin")**: Parse `.html` prototypes to extract fields, table columns, filter controls, status badges, and modal forms automatically (do NOT re-ask the user for fields already visible in the HTML), but **NEVER** copy hardcoded hex/RGB/Tailwind raw color classes or raw `<table>`/`<dialog>` markup into `apps/web` — always map them to `DataTable`, `FilterBar`, `ResponsiveDialog`, `StatusBadge`, and `--lg-*` tokens.
     - **Conversational tweaks without raw files**: Do NOT create an empty folder under `docs/requirements/`; record `对话直接指令（无外部附件）` in the `原始资料归档 (PRD / 原型)` column of `0.2 版本演进记录`.
2. **Check whether `docs/specs/<name>.md` already exists**:
   - **Existing module iteration (`v1.x` minor/patch update)**: Read `docs/specs/<name>.md` first to restore full business context and prior invariants. Keep the living spec at `docs/specs/<name>.md`, bump `version` in frontmatter (e.g., `v1.0` → `v1.1` for release iteration, or `v1.1.1` for small conversational tweak), append a row to `0.2 版本演进记录` (with relative links to `../requirements/v<X.Y>/...` when raw files exist), and update Sections 1–5 in place so they always reflect the latest full state.
   - **Major breaking redesign (`v1.x` → `v2.0`)**: Archive the previous living spec to `docs/specs/archive/v1/<name>.md` before rewriting `docs/specs/<name>.md` as `v2.0`.
   - **New module (`v1.0`)**: Read [docs/specs/_template.md](../../../docs/specs/_template.md) to load the target structure (`Frontmatter` + `Section 0: Business Context & Version History` + `Generator Metadata` + `Elements 1–5`).
3. **Derive the specification from the user's prompt & raw artifacts**:
   - **Section 0 — Business Context & Requirements**: Business goal, target roles, user stories, and out-of-scope boundaries.
   - **Generator Metadata**: `--name` (kebab-case), `--label` (Chinese title ≤ 30 chars), `--icon` (Lucide icon name, default `FileText`), `--mode` (`crud` for server-paged CRUD, `sortable` for full-list dictionary with `sortOrder` drag-and-drop).
   - **Element 1 — Entity & Shared Contract**: Fields, types, required/optional rules, uniqueness constraints, and English enum values + Chinese `*_LABELS`.
   - **Element 2 — Domain Invariants & `ServiceError`**: Conflict checks (409), not-found checks (404), reference protection before deletion (400), or state transition guards (400).
   - **Element 3 — Permissions (Opt-in)**: Permission codes (`<name>:view`, `<name>:edit` or custom actions) and which roles (`admin` vs. `user`) receive them by default.
   - **Element 4 — Audit & Notifications**: `TableAuditConfig.fieldLabels` (column → Chinese label for `AuditDiffViewer`), custom non-CRUD audit events via `createAuditor`, and optional `notify` / `notifyMany` side effects.
   - **Element 5 — UI Layout & Components**: `FilterBar` search/filter controls, `DataTable` desktop columns, `MobileCard` three-part slots, and `ResponsiveDialog` form fields.
4. **If any core business rules (Elements 1, 2, or `--mode` `crud` vs. `sortable`) are missing or ambiguous**, present a concise Chinese proposal with recommended defaults and ask the user to confirm:

```markdown
收到需求。我整理了「<模块中文名>」的核心规格草案（技术细节已按项目规范填好默认值），请确认以下业务点：

- **业务场景**：<一句话概括目标与核心操作>
- **1. 生成模式与参数**：`--name <name>` · `--label "<中文名>"` · `--icon <Icon>` · `--mode <crud|sortable>`
- **2. 核心字段与枚举**：<列出业务字段、必填项、唯一键及状态枚举>
- **3. 业务拦截规则**：<如编码/名称唯一性 409、删除引用保护 400>
- **4. 权限与角色（默认推荐）**：`<name>:view` / `<name>:edit` 默认仅 `admin` 持有（是否需要默认开放给普通 `user` 角色？）
- **5. 审计与界面（默认推荐）**：全字段中文 Diff 审计；桌面端 `DataTable` + 移动端 `MobileCard` + `ResponsiveDialog` 弹窗表单。
```

**PHASE GATE**: Do NOT proceed to Phase 2 until the user confirms the specification (or if the user's initial prompt already specified all business rules unambiguously). Once aligned, **AI writes or updates `docs/specs/<name>.md`** following `docs/specs/_template.md` (including Section 0原始需求描述 and Elements 1–5) so the repository retains a permanent specification artifact.

---

## Phase 2 — Scaffold Baseline via `gen:module`

Run the module generator from the repository root to create the 9 baseline files and wire all 8 registration points (`permissions.ts`, `audit.ts`, `shared/index.ts`, `db/schema.ts`, `api/src/index.ts`, `query-keys.ts`, `App.tsx`, `menu-config.ts`):

```bash
# Mode A (default): Server-side paginated CRUD module
bun run gen:module --name <name> --label "<中文名>" --icon <Icon>

# Mode B: Dictionary / category module with full-list drag-and-drop sortOrder
bun run gen:module --name <name> --label "<中文名>" --icon <Icon> --mode sortable
```

- Do NOT manually create the 9 module files or hand-edit the 8 registration files before running `gen:module`.
- Use `--dry-run` first if you only want to preview the planned file paths.

---

## Phase 3 — Customize Shared Contracts & Database Schema

1. **Update `packages/shared/src/<name>.ts` and `packages/shared/src/index.ts`**:
   - Replace placeholder fields (`code`, `name`, `status`, `description`) with the actual domain fields from Element 1.
   - Define all enums with English literal values in DB/Wire (`export const <UPPER>_STATUS = { ... } as const`) and a corresponding Chinese label record (`export const <UPPER>_STATUS_LABELS: Record<..., string> = { ... }`).
   - Keep `<Pascal>Schema` (wire output), `<Pascal>FormSchema` (create/update input), and `<Pascal>ListQueryBaseSchema` / `<Pascal>ListQuerySchema` (using `z.preprocess(stripBlankQueryValues, ...)`) in sync.
   - Export any newly added schemas, constants, or types from `packages/shared/src/index.ts`.
2. **Update `apps/api/src/db/schema.ts`**:
   - Align the Drizzle `sqliteTable` columns, `.notNull()`, `.default()`, `uniqueIndex(...)`, and `index(...)` with `packages/shared/src/<name>.ts`.
3. **Update Role Permissions (if non-admin roles need access)**:
   - By default, `gen:module` registers `PERMISSIONS.<UPPER>_VIEW` and `PERMISSIONS.<UPPER>_EDIT` in `PERMISSION_REGISTRY` (granted automatically to `admin`).
   - If Element 3 grants access to `DEFAULT_ROLE` (`user`) or other roles, add the permission constants to `ROLE_PERMISSIONS` in `packages/shared/src/permissions.ts`.
4. **Synchronize Database Artifacts & Shared Build**:
   - Check which database mode the workspace uses:
     - **Template repository** (`apps/api/init.sql` exists): run `bun --filter api db:init:generate`.
     - **Scaffolded project** (`apps/api/init.sql` does not exist, `apps/api/drizzle/meta/_journal.json` exists): run `bun --filter api db:generate`.
   - Rebuild the shared package so `apps/api` and `apps/web` see the updated types and runtime schemas:
     ```bash
     bun run build:shared
     ```

---

## Phase 4 — Implement Backend Service, Audit & Route Tests

1. **Update `apps/api/src/modules/<name>/<name>.service.ts`**:
   - Update `<UPPER>_AUDIT_CONFIG: TableAuditConfig`:
     - Map every business column to its Chinese label in `fieldLabels` (used by `AuditDiffViewer`).
     - List all business columns in `snapshotColumns` and keep metadata columns (`createdAt`, `updatedAt`, `sortOrder`) in `excludeColumns`.
   - Implement Element 2 domain invariants by throwing `ServiceError` subclasses (with explicit HTTP status `400` / `403` / `404` / `409` and `UPPER_SNAKE` error code).
   - For dictionary/category modules (`sortable`) or master data referenced by other tables, implement reference protection in `delete<Pascal>` before deleting the row (query referencing table with `.limit(1)` and throw `<Pascal>InUseError` with status `400`).
   - Ensure every exported function that writes audit logs (`auditedInsert`, `auditedUpdate`, `auditedDelete`, or `audit`) accepts `ctx: OpCtx` as its first parameter.
   - Trigger optional notifications via `notify()` / `notifyMany()` / `notifySafe()` from `apps/api/src/shared/notification.ts` when specified in Element 4.
2. **Update `apps/api/src/modules/<name>/<name>.route.ts`**:
   - Keep route handlers thin: authentication (`authMiddleware`, `opCtxMiddleware`) → `requirePermission(...)` → Zod `safeParse` (`formatZodErrors`) → service call → `mapServiceError(c, err)`.
   - Never import database modules or `ali-oss` in `.route.ts`.
3. **Update `apps/api/src/modules/<name>/<name>.route.test.ts`**:
   - Update `validForm` fixtures and test cases to match the customized fields and domain invariants (401, 403, 201 + create audit snapshot, 400 validation, 409 uniqueness conflict, 400 reference protection if applicable, 200 update + diff audit, 200 delete + audit, 404 not found).
   - Keep `setupTestDb()` in `beforeEach` so every test case runs against an isolated in-memory SQLite database.

---

## Phase 5 — Implement Frontend Hooks, Page & Form Dialog

1. **Update `apps/web/src/pages/<name>/hooks/use<Pascal>Form.ts`**:
   - Update `makeEmptyValues()` and `toFormValues(record)` to match `<Pascal>Form` (convert nullable wire fields to `""` for controlled inputs).
2. **Update `apps/web/src/pages/<name>/components/<Pascal>FormDialog.tsx`**:
   - Render form fields inside `ResponsiveDialog` using `Field`, `FieldLabel`, `FieldError`, `Input`, `Select`, `Textarea`.
   - Keep the error round-trip in `handleSubmit`:
     ```ts
     if (!applyServerFieldErrors(err, form.setError)) {
       showError(extractErrorMessage(err))
     }
     ```
3. **Update `apps/web/src/pages/<name>/<Pascal>Page.tsx`**:
   - Configure `FilterBar` (`search` input + filter selects + accurate `activeFilterCount`).
   - Configure `DataTable` desktop `columns` using semantic primitives (`StatusBadge`, `DateCell`, `NullableText`, `Badge`).
   - Configure `mobileCard` using `MobileCard`, `MobileCardTitle`, `MobileCardTags`, and `MobileCardMeta` so mobile viewports (`<md`) render a complete card layout.
   - Gate write actions (`新增`, `编辑`, `删除`, and `draggable` / `onReorder`) with `usePermission().can(PERMISSIONS.<UPPER>_EDIT)` or `<PermissionGate perm={PERMISSIONS.<UPPER>_EDIT}>`.
   - If the page file approaches 400 lines (hard CI limit is 450 lines), extract detail drawers or secondary dialogs into `apps/web/src/pages/<name>/components/`.

---

## Phase 6 — Mandatory Quality Gates & Self-Check

Run the full verification suite from the repository root and fix any failures before reporting completion:

```bash
bun run typecheck && bun run lint:nocache && bun run arch:check && bun run test
```

If `apps/api/init.sql` or `apps/api/drizzle/` was modified, also verify database schema consistency:

```bash
bun --filter api migrate:check
```

**Self-Check Checklist before finishing**:

- [ ] All enum values stored in DB and sent over the wire are English literals; Chinese labels are used only in UI (`*_LABELS`) and `TableAuditConfig.fieldLabels`.
- [ ] No raw Tailwind colors (`text-red-500`, `bg-emerald-500`) or inline style hex/rgb/hsl literals exist in `.tsx` files; semantic tokens (`var(--lg-danger)`, `StatusBadge`, `variant="destructive"`) are used instead.
- [ ] No value imports of `@/services/*` exist in `apps/web/src/pages/**` or `components/**` (only `import type` is allowed; runtime calls go through `hooks/queries/`).
- [ ] Every file under `apps/web/src/pages/**/*.tsx` and `apps/api/src/modules/**/*.ts` is strictly under 450 lines (`wc -l`).
- [ ] All `[gen:module:*]` anchor comments in registration files remain intact.

---

# Gotchas

- **Template Repo vs. Scaffolded Project DB Sync**: Never run `bun --filter api db:generate` in the template repository (where `apps/api/init.sql` exists); the pre-commit hook and `migrate:check` reject `apps/api/drizzle/` files in template mode. Conversely, in a scaffolded project (`apps/api/init.sql` removed), always use `bun --filter api db:generate`.
- **Shared Package `dist/` Resolution**: Both `apps/api` and `apps/web` resolve `"shared"` to `packages/shared/dist/`. Whenever you edit `packages/shared/src/*.ts`, run `bun run build:shared` (included in `bun run typecheck`) before running single-package tests like `cd apps/api && bun test`.
- **ESLint Custom Rules & Cache**: `bun run lint` uses `--cache`. When verifying across architecture rules, run `bun run lint:nocache` so ESLint evaluates all files without stale cache hits.
- **Route Layer Import Ban**: `*.route.ts` files are strictly forbidden from importing `**/db*`, `drizzle-orm`, `bun:sqlite`, or `ali-oss` (both static `import` and dynamic `import()`). Keep all SQL queries and OSS calls inside `*.service.ts`.
- **Frontend Permission Source of Truth**: Never import `ROLE_PERMISSIONS`, `ALL_PERMISSIONS`, or `permissionsForRole` in `apps/web/src/**` (blocked by ESLint `no-restricted-imports`). Always consume `user.permissions` via `usePermission()` or `<PermissionGate>`.
- **LIKE Wildcard Escaping**: When adding custom `LIKE` filters in `*.service.ts`, escape `%`, `_`, and `\` via `escapeLike(keyword)` and append `ESCAPE '\\'` in the SQL template so user input containing `%` or `_` cannot match unintended rows.
