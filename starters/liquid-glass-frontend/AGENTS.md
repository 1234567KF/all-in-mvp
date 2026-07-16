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

<!-- region:cmds -->

## 🛠️ Commands

```bash
bun run dev        # dev server
bun run test       # test
bun run lint:fix   # lint auto-fix
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
