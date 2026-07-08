---
name: kf-mvp-playwright-infra
description: >-
  Load when setting up or modifying Playwright test infrastructure for MVP projects.
  Covers playwright.config.ts templates, CI integration, screenshot baseline management,
  browser instance pool, and test fixtures. Triggers: Playwright 配置, 测试基础设施,
  playwright config, browser setup, CI测试, 截图基线, screenshot baseline,
  test fixture, 浏览器实例池. NOT for: writing specific test cases (use kf-mvp-test-e2e
  or kf-mvp-test-single).
metadata:
  pattern: tool-wrapper
  domain: mvp-infra
recommended_model: qwen-3.7-Max
graph:
  dependencies:
    - target: kf-mvp-testing-strategy
      type: semantic
    - target: kf-mvp-test-e2e
      type: semantic
    - target: kf-mvp-backend-tdd
      type: semantic
    - target: kf-mvp-frontend-dev
      type: semantic
    - target: kf-mvp-test-review
      type: semantic
    - target: all-in-mvp
      type: semantic
---

# MVP Playwright Infrastructure Skill — Playwright 测试基础设施技能

> **Core Belief**: Playwright infrastructure is cross-cutting shared code. It must be configured once, consistently, and referenced by all test-writing skills. Never embed Playwright config inside module-specific test skills.

**Division of Labor**: This Skill focuses on **Playwright infrastructure setup and maintenance** — config templates, CI pipeline integration, screenshot baselines, browser instance pooling, and fixture system. It does NOT write test cases.

---

# 1. Standard `playwright.config.ts` Template

```typescript
// playwright.config.ts — MVP Standard Template
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  // Global timeout per test (30s default, generous for CI)
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Shared browser options
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // ── L5: Headless CI ──
    {
      name: 'chromium-headless',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
      },
    },
    // ── L4: Headed local (human-visible) ──
    {
      name: 'chromium-headed',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        launchOptions: { slowMo: 100 },
      },
      // Skip in CI — headed mode is for local debugging only
      grepInvert: process.env.CI ? /.*/ : null,
    },
    // ── Mobile viewports (optional, enable as needed) ──
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Dev server — auto-start for local, skip in CI
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

**Key decisions**:

| Decision | Rationale |
|----------|-----------|
| `forbidOnly` in CI | Prevents accidentally committing `test.only` |
| `retries: 2` in CI | Mitigates flaky CI environments; 0 locally for fast feedback |
| `workers: 1` in CI | Avoids port conflicts in constrained CI runners |
| `trace: 'on-first-retry'` | Captures traces only when retries occur — balances debug info vs storage |
| `screenshot: 'only-on-failure'` | Saves disk and CI artifact size |

---

# 2. CI Integration (GitHub Actions)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests (headless)
        run: npx playwright test --project=chromium-headless
        env:
          CI: 'true'
          BASE_URL: http://localhost:5173

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 7
```

**CI Checklist**:
- Only install `chromium` (not all browsers) to save CI time
- `--with-deps` installs OS-level dependencies automatically
- Always upload artifacts on failure for debugging
- Set explicit `timeout-minutes` to prevent hung jobs

---

# 3. Screenshot Baseline Management

## Directory Structure

```
e2e/
├── <scenario>.spec.ts
└── <scenario>-snapshots/          # Auto-generated by Playwright
    ├── chromium-headless/         # Desktop baseline (L5 CI)
    │   └── <scenario>.png
    ├── chromium-headed/           # Desktop baseline (L4 local)
    │   └── <scenario>.png
    ├── mobile-chrome/             # Android baseline (Pixel 5)
    │   └── <scenario>.png
    └── mobile-safari/             # iOS baseline (iPhone 13)
        └── <scenario>.png
```

> **说明**：Playwright 按 `projects[].name` 自动创建子目录。添加新 device project 后，首次运行 `--update-snapshots` 即可生成对应基线。

## Baseline Update Strategy

| Scenario | Command | When |
|----------|---------|------|
| First run (no baselines) | `npx playwright test --update-snapshots` | Initial test creation |
| Intentional UI change | `npx playwright test --update-snapshots` | After PRD-approved visual changes |
| CI drift (OS/font rendering) | `npx playwright test --update-snapshots` | When CI runner OS updates |
| Accidental mismatch | **Do NOT update** — fix the code | When a real regression is found |

## Tolerance Configuration

```typescript
// Per-test override for flaky visual comparisons
await expect(element).toHaveScreenshot('component.png', {
  maxDiffPixelRatio: 0.01,   // 1% pixel difference tolerance
  // OR
  maxDiffPixels: 100,         // Absolute pixel count
  threshold: 0.2,             // Per-pixel color threshold (0-1)
});
```

**Rules**:
- Baselines MUST be committed to Git
- Use `maxDiffPixelRatio` over `maxDiffPixels` for responsive layouts
- Never set tolerance above `0.05` (5%) — that hides real bugs
- Review baseline diffs in PR just like code changes

---

# 4. Browser Instance Pool Management

> **Problem**: Parallel Playwright tests can cause port conflicts when multiple browser instances hit the same dev server, or exhaust system resources.

## Strategy: Shared Browser + Isolated Contexts

```typescript
// e2e/fixtures/browser-pool.ts
import { test as base, Browser, BrowserContext, Page } from '@playwright/test';

type BrowserPoolFixtures = {
  /** Isolated browser context per test — separate cookies, storage, localStorage */
  isolatedContext: BrowserContext;
  /** Fresh page within the isolated context */
  isolatedPage: Page;
};

export const test = base.extend<BrowserPoolFixtures>({
  isolatedContext: async ({ browser }, use) => {
    // Each test gets its own context (cookies/storage isolation)
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
    });
    await use(context);
    await context.close();
  },

  isolatedPage: async ({ isolatedContext }, use) => {
    const page = await isolatedContext.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
```

## Parallel Execution Rules

| Setting | Local Dev | CI |
|---------|-----------|-----|
| `fullyParallel` | `true` | `true` |
| `workers` | `undefined` (auto = CPU cores) | `1` (avoid resource exhaustion) |
| `retries` | `0` | `2` |
| Port conflict mitigation | Multiple dev servers or `reuseExistingServer` | Single server, sequential workers |

## Port Conflict Avoidance

```typescript
// If tests need multiple backend instances, use dynamic ports:
webServer: [
  {
    command: 'npm run dev:api -- --port 3001',
    url: 'http://localhost:3001/health',
    reuseExistingServer: !process.env.CI,
  },
  {
    command: 'npm run dev:frontend -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
],
```

---

# 5. Global Setup / Teardown

```typescript
// e2e/global-setup.ts
import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Seed test database
  // Start shared services
  // Pre-warm caches
  console.log('[GlobalSetup] Preparing test environment...');
}

export default globalSetup;
```

```typescript
// e2e/global-teardown.ts
import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  // Clean up test database
  // Stop shared services
  console.log('[GlobalTeardown] Cleaning up...');
}

export default globalTeardown;
```

Reference in config:

```typescript
// playwright.config.ts
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // ... rest of config
});
```

---

# 6. Test Fixture System (test.extend)

Playwright's `test.extend` is the recommended way to share setup logic across tests.

```typescript
// e2e/fixtures/auth-fixture.ts
import { test as base } from '@playwright/test';

type AuthFixtures = {
  /** Pre-authenticated admin page */
  adminPage: Page;
  /** Pre-authenticated regular user page */
  userPage: Page;
  /** Storage state path for session reuse */
  authStatePath: string;
};

export const test = base.extend<AuthFixtures>({
  authStatePath: async ({}, use) => {
    await use('./e2e/.auth/storage-state.json');
  },

  adminPage: async ({ browser, authStatePath }, use) => {
    const context = await browser.newContext({ storageState: authStatePath });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  userPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    // Login flow
    await page.goto('/login');
    await page.fill('[data-testid="input-phone"]', '13800138001');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="btn-login"]');
    await page.waitForURL(/dashboard/);
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
```

Usage in tests:

```typescript
import { test, expect } from '../fixtures/auth-fixture';

test('admin can approve opportunity', async ({ adminPage }) => {
  await adminPage.goto('/opportunities/pending');
  // adminPage is already authenticated
});
```

---

# 7. Authentication State Reuse (storageState)

> **Problem**: Logging in before every test wastes time and adds flakiness.
> **Solution**: Authenticate once in `globalSetup`, save `storageState`, reuse across tests.

```typescript
// e2e/global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Login once
  await page.goto('http://localhost:5173/login');
  await page.fill('[data-testid="input-phone"]', '13800138000');
  await page.fill('[data-testid="input-password"]', 'password123');
  await page.click('[data-testid="btn-login"]');
  await page.waitForURL(/dashboard/);

  // Save auth state
  await page.context().storageState({
    path: './e2e/.auth/storage-state.json',
  });

  await browser.close();
}

export default globalSetup;
```

Then in `playwright.config.ts`:

```typescript
projects: [
  {
    name: 'chromium-headless',
    use: {
      ...devices['Desktop Chrome'],
      storageState: './e2e/.auth/storage-state.json',
    },
  },
],
```

**Rules**:
- `.auth/` directory MUST be in `.gitignore`
- Regenerate storageState in `globalSetup` (never commit tokens)
- For multi-role tests, save separate states: `admin-state.json`, `user-state.json`

---

# 8. Playwright API 核心约定

> **定位**：本节提炼跨所有 Playwright 使用场景（E2E、视觉回归、后端 L4/L5）必须遵守的核心 API 约定。详细用例写法见 `kf-mvp-test-e2e`。

## Locator 优先级（强制）

| 优先级 | 选择器 | 示例 |
|:------:|--------|------|
| 1 (最高) | `data-testid` | `page.locator('[data-testid="btn-submit"]')` |
| 2 | `getByRole` | `page.getByRole('button', { name: '提交' })` |
| 3 | `getByText` | `page.getByText('确认删除')` |
| 4 | `getByLabel` | `page.getByLabel('用户名')` |
| 5 | `getByPlaceholder` | `page.getByPlaceholder('请输入手机号')` |
| 6 (最低) | CSS 选择器 | `page.locator('.btn-primary')` — 仅做兜底 |

- MUST 优先使用 `data-testid`，前端组件必须预埋
- MUST NOT 使用 `.ant-btn-primary > span:nth-child(2)` 等脆弱选择器
- MUST NOT 使用 XPath

## 等待策略（强制）

| 场景 | 正确做法 | 禁止做法 |
|------|---------|---------|
| 等待 API 响应 | `waitForResponse(url => url.includes('/api/xxx'))` | `waitForTimeout(2000)` |
| 等待元素可见 | `waitForSelector('[data-testid="result"]', { state: 'visible' })` | `waitForTimeout(1000)` |
| 等待页面加载 | `waitForLoadState('networkidle')` | `waitForTimeout(3000)` |
| 等待导航完成 | `waitForURL(/dashboard/)` | `waitForTimeout(2000)` |

- **MUST NOT 使用 `page.waitForTimeout()`** — 永远使用显式等待条件

## 认证状态复用

```typescript
// 登录一次，所有测试复用 — 详见 Section 7
const context = await browser.newContext({
  storageState: './e2e/.auth/storage-state.json',
});
```

- `.auth/` 目录 MUST 在 `.gitignore` 中
- 多角色场景维护独立 state 文件（`admin-state.json`、`user-state.json`）

## 网络拦截

```typescript
// 模拟 API 错误
await page.route('**/api/xxx', route => {
  route.fulfill({ status: 500, body: JSON.stringify({ error: '...' }) });
});
```

- MUST 在 `page.goto()` 之前设置 route 拦截
- MUST NOT 拦截所有请求 — 只拦截测试需要的特定路径

---

# Cross-References

| Skill | Relationship |
|-------|-------------|
| `kf-mvp-test-e2e` | Uses this infra for E2E test execution |
| `kf-mvp-backend-tdd` | References this infra for L4/L5 browser test config |
| `kf-mvp-frontend-dev` | Uses this infra for visual regression setup |
| `kf-mvp-testing-strategy` | This infra implements the E2E layer defined in testing strategy |

---

# Constraints

**MUST DO:**
- Keep this config as single source of truth for Playwright settings
- Reference this skill from other test-writing skills (don't duplicate config)
- Commit screenshot baselines to Git
- Use `test.extend` for shared fixtures instead of `beforeAll` hooks

**MUST NOT DO:**
- Embed Playwright config inside module-specific test skills
- Use `page.waitForTimeout()` — always use explicit wait strategies
- Run headed mode in CI
- Set overly generous timeouts to hide slow tests

---

# Gotchas

- **Port conflicts**: When `workers > 1` locally, ensure dev server uses `reuseExistingServer: true` or dynamic ports
- **CI font rendering**: Linux CI renders fonts differently from macOS — always generate baselines on the same OS as CI
- **Flaky traces**: `trace: 'on-first-retry'` only captures on retry; use `trace: 'on'` locally for debugging
- **storageState expiry**: If your JWT expires in 1 hour, regenerate in `globalSetup`; don't rely on stale tokens
- **Parallel + database**: If tests share a database, use `workers: 1` or isolate data per test with unique prefixes
