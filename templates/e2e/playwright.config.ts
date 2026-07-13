/**
 * Playwright E2E 测试配置 — Stage 3.5 标准产物
 *
 * 核心设计：E2E 测试通过真实后端服务（文件数据库）而非内存数据库运行，
 * 确保测试结果与人工验收环境一致。
 *
 * 稳定性保障:
 *   - globalSetup: 每次测试前运行 seed.ts --reset，确保干净数据库
 *   - fullyParallel: false（文件 DB 不能并行写入）
 *   - workers: 1（同一 SQLite 文件串行操作，避免锁冲突）
 *
 * 使用方式:
 *   npx playwright test              # 自动重置 DB + 启动服务 + 运行测试
 *   npx playwright test --ui         # UI 模式调试
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // 测试文件目录
  testDir: './tests/e2e',

  // ⚠️ 全局初始化: 每次测试前重置数据库为干净状态
  globalSetup: './templates/e2e/global-setup.ts',

  // 全局超时
  timeout: 60 * 1000,

  // ⚠️ 文件数据库不支持并行: 禁用 fullyParallel，workers=1
  // SQLite 文件 DB 在多 worker 并发写入时会锁冲突
  fullyParallel: false,

  // CI 环境禁止 test.only
  forbidOnly: !!process.env.CI,

  // CI 环境失败重试 1 次
  retries: process.env.CI ? 1 : 0,

  // ⚠️ 单 worker（文件 DB 串行安全）
  // 如果改用内存数据库或独立 DB 文件，可提高 workers
  workers: 1,

  // 报告格式
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  // 全局配置
  use: {
    // 基础 URL（指向 Vite 前端）
    baseURL: 'http://127.0.0.1:5173',

    // 截图策略: 仅失败时截图
    screenshot: 'only-on-failure',

    // 视频策略: 仅失败时录制
    video: 'retain-on-failure',

    // Trace 策略: 首次重试时记录
    trace: 'on-first-retry',
  },

  // ─── Web 服务 ────────────────────────────────────────────────────────
  //
  // Playwright 自动管理前后端服务的启动/停止。
  // 如果服务已在运行（reuseExistingServer），则复用已有实例。
  webServer: [
    // 后端服务: 使用文件数据库
    {
      command: 'npx tsx templates/e2e/start-server.ts',
      url: 'http://localhost:3000/health',
      timeout: 30 * 1000,
      reuseExistingServer: !process.env.CI,
      cwd: process.cwd(),
    },
    // 前端服务: Vite dev server
    {
      command: 'cd apps/web && npm run dev',
      url: 'http://127.0.0.1:5173',
      timeout: 30 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],

  // ─── 项目配置 ────────────────────────────────────────────────────────
  projects: [
    // 桌面端 Chromium（主浏览器）
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // 桌面端 Firefox（辅助浏览器）
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // 移动端 Chrome（可选，移动端验证）
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
})
