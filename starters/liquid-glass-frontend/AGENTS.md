# AI Developer Guide

This project is AI-Native. Follow these guidelines when modifying or creating components and pages.

## Design System

- **MUST read and follow** the [DESIGN.md](./DESIGN.md) specification for all visual tokens, colors, typography, layout grid, glassmorphism, responsive styles, animations, and structural page/dialog/table layout rules.
- **Never hardcode colors** (`hex` / `rgba` / Tailwind raw color classes). Do not use classes like `text-red-500` or `bg-red-600`; instead use `variant="destructive"` or theme variable colors (e.g., `style={{ color: "var(--lg-danger)" }}`). Reference [theme-tokens.css](apps/web/src/theme-tokens.css) variables or [design-utils.css](apps/web/src/design-utils.css) utilities. Customize primary color only via `★★★` variables.

## Key Files

[theme-tokens.css](apps/web/src/theme-tokens.css) Design tokens · [design-utils.css](apps/web/src/design-utils.css) Glass utilities · [menu-config.ts](apps/web/src/lib/menu-config.ts) Sidebar & ⌘K index · [App.tsx](apps/web/src/App.tsx) Main Router

## Add a New Page

1. **Create**: New component under `apps/web/src/pages/` (Tailwind CSS)
2. **Route**: Lazy-load via `React.lazy`, register in [App.tsx](apps/web/src/App.tsx) inside `<Route element={<SidebarLayout />}>`
3. **Nav**: Add entry to `menuGroups` in [menu-config.ts](apps/web/src/lib/menu-config.ts) (`title` / `path` / `icon` / `keywords` / `englishSub`)

<!-- region:api -->

## API & Service Layer

- **No direct imports** of `api` (`@/lib/api`), `fetch`, `axios`, or backend RPC clients in UI components.
- Encapsulate all network logic in `apps/web/src/services/`. UI only calls service functions returning Promises.
- **Database**: Drizzle ORM + `bun:sqlite`. Schema in [db/schema.ts](apps/api/src/db/schema.ts), connection in [db/index.ts](apps/api/src/db/index.ts). Run `bun run db:generate` after schema changes.
<!-- endregion:api -->

## Shared Components (`components/shared/`)

`DataTable` data table · `VirtualDataTable` virtual scroll (1000+ rows) · `ConfirmDialog` confirm dialog · `FileUpload` drag & drop upload · `PageSkeleton` skeleton fallback · `FilterBar` filter toolbar · `CommandPalette` ⌘K

## Page Transitions

Native **View Transitions API** (React Router DOM v7). All `<NavLink>` use `viewTransition` prop. New routes inherit transitions automatically.

## Code Conventions

- **Import order**: `eslint-plugin-simple-import-sort`, auto-fix via `bun run lint:fix`
- **Code Splitting**: All pages must use `React.lazy()` (except LoginPage)
- **Type Safety**: tsconfig enforces `noUnusedLocals` + `noUnusedParameters`
- **Toast**: Use `@/lib/toast` (`showSuccess` / `showError` / `showWarning` / `showInfo`). Never import sonner directly.

## Architecture Gates

Two enforcement layers. Use the cheapest one that can actually see the violation — cross-file checks are the only thing ESLint cannot express:

| Layer | Sees | Command |
| --- | --- | --- |
| ESLint custom rules | one file's AST | `bun run lint` |
| `arch:check` | the whole `apps/web/src` tree + `App.tsx` | `bun run arch:check` |

Project rules live in [eslint-rules/](./eslint-rules), registered as the `project-rules` plugin. Every rule file documents its Rationale, correct alternatives, and **Known blind spots** — read the blind spots before treating a green run as proof that a class of bug is gone.

| Rule | Scope | Severity |
| --- | --- | --- |
| `project-rules/no-toisostring-slice` | all `.ts/.tsx` | `warn` |
| `project-rules/no-tailwind-raw-colors` | `pages/` + `components/` | `error` |
| `project-rules/no-raw-viewport-check` | `pages/` + `components/` | `error` |

`arch:check` carries what a single-file AST cannot: no `@/lib/api` / `axios` / `fetch` import in UI layers, `sonner` stays behind the toast whitelist, and every page except LoginPage is `React.lazy`-imported in [App.tsx](apps/web/src/App.tsx).

**Exemption ratchet.** `reportUnusedDisableDirectives` is `error`: after fixing the code you must delete the `eslint-disable`, or lint fails. Documented per-file exemptions sit in [eslint.config.js](./eslint.config.js) and must state (a) why the rule cannot be satisfied at that spot and (b) what change removes the exemption. No exemption without both sentences.

## Enum Values

Store machine values in English, keep display text separate. `role: text("role").default("user")` in [db/schema.ts](apps/api/src/db/schema.ts) is the pattern: `"user"` / `"admin"` go into the database and the API contract; Chinese labels live in a display map next to the component that renders them. Never write Chinese as the stored or compared value — it makes every filter, migration and cross-language consumer fragile.

## Date & Time

Never derive a calendar date from a UTC string: `.toISOString().slice(0, 10)` shifts the date back one day for every UTC+ user. [date-utils.ts](apps/web/src/lib/date-utils.ts) provides `formatDate` (local `YYYY-MM-DD`), `formatTimestamp` (local `YYYY-MM-DD HH:mm:ss`), `formatRelativeTime`, and `getLocalDayBoundaryISO(date, "start" | "end")` for query ranges that must stay in the viewer's day.

## Testing

Match the layer you are touching:

| Layer | Runner | Location | Example |
| --- | --- | --- | --- |
| ESLint rules | `bun test` (RuleTester) | `eslint-rules/*.test.js` | `no-tailwind-raw-colors.test.js` |
| Web components / libs | vitest | `apps/web/src/**/__tests__/` | `components/shared/__tests__/DataTable.test.tsx` |
| API logic | `bun:test` | colocated next to source in `apps/api/src/` | `response.test.ts` |
| Shared package | vitest | `packages/shared/` | `passWithNoTests` until tests exist |

Mock at the service boundary (`vi.mock("@/lib/api")`), not the component tree. `bun run test` runs all layers; `bun run test:ci` adds coverage.

## Verify After Every Change

Run before declaring a change done — a green typecheck is not proof the feature works:

```bash
bun run lint        # custom rules + import sort, 0 errors
bun run typecheck
bun run test
bun run arch:check  # when imports, pages, or App.tsx changed
```

UI changes additionally need a real browser check that every control in the affected dialog/page is visible and submits — `w-full` and `flex-col` edits have broken Checkbox/Radio/Switch before.

<!-- region:cmds -->

## 🛠️ Commands

```bash
bun run dev        # dev server
bun run lint       # eslint, all packages (web + api + shared)
bun run lint:fix   # lint auto-fix
bun run typecheck  # tsc --noEmit
bun run test       # eslint-rules + shared + web + api
bun run test:eslint # custom rule regression tests only
bun run arch:check # cross-file architecture invariants
bun run db:generate # generate migration after schema change (in apps/api)
bun run db:migrate  # apply migrations (in apps/api)
```

<!-- endregion:cmds -->

## Git Conventions

**Commit**: `<type>(<scope>): <subject>` — subject ≤50 chars, imperative mood
**Type**: `feat` · `fix` · `refactor` · `docs` · `test` · `chore` · `perf` · `ci` · `style`
**Branch**: `feature/<module>-<desc>` · `fix/` · `hotfix/` · `release/v<ver>` · `refactor/`
**Rule**: Never push cross-branch. Always checkout target branch before push.
**PR**: Must include change description + scope + test result + linked ID (`Fixes #123`); ≤500 lines.
