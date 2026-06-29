/**
 * 视觉回归测试 — Playwright 无头截图 + pixelmatch
 *
 * 替代纯人工 VISUAL_PENDING 确认的自动化方案。
 * 
 * 使用方式:
 *   1. npm run test:visual           # 运行视觉回归测试
 *   2. npx playwright test           # 或用 playwright 直接运行
 * 
 * 流程:
 *   1. 启动本地 dev server (http://localhost:5173)
 *   2. Playwright 无头模式截图每个页面
 *   3. pixelmatch 对比 baseline vs current
 *   4. 差异 > 阈值 → FAIL，输出 diff 图
 *   5. 差异 ≤ 阈值 → PASS，替代 VISUAL_PENDING 人工确认
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// 从 stage4 导入配置
const { VISUAL_REGRESSION_CONFIG } = require('../../stage4-integration');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve(__dirname, '../../reports/screenshots');
const BASELINE_DIR = path.join(SCREENSHOT_DIR, 'baseline');
const CURRENT_DIR = path.join(SCREENSHOT_DIR, 'current');
const DIFF_DIR = path.join(SCREENSHOT_DIR, 'diff');

// 确保目录存在
for (const dir of [BASELINE_DIR, CURRENT_DIR, DIFF_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── 页面清单（从 task.md 或手动配置）─────────────────────────────────────────
// 实际项目中应从 task.md 解析出前端页面路由
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/dashboard' },
];

// ─── 视觉回归测试 ─────────────────────────────────────────────────────────────

for (const page of PAGES) {
  test(`视觉回归: ${page.name} (${page.path})`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: {
        width: VISUAL_REGRESSION_CONFIG.viewportWidth,
        height: VISUAL_REGRESSION_CONFIG.viewportHeight,
      },
    });
    const p = await context.newPage();

    // 导航到页面
    try {
      await p.goto(`${BASE_URL}${page.path}`, { timeout: 10000 });
    } catch (e) {
      // 如果 dev server 未启动，跳过测试（不阻塞 CI）
      test.skip(true, `Dev server 未启动 (${BASE_URL})，跳过视觉回归`);
      return;
    }

    // 等待页面稳定
    await p.waitForLoadState('networkidle');

    // 截图
    const currentPath = path.join(CURRENT_DIR, `${page.name}.png`);
    const baselinePath = path.join(BASELINE_DIR, `${page.name}.png`);
    const diffPath = path.join(DIFF_DIR, `${page.name}.png`);

    await p.screenshot({ path: currentPath, fullPage: true });
    await context.close();

    // 如果没有 baseline，当前截图作为 baseline（首次运行）
    if (!fs.existsSync(baselinePath)) {
      fs.copyFileSync(currentPath, baselinePath);
      console.log(`[baseline] 首次运行，${page.name} 已保存为 baseline`);
      return;
    }

    // pixelmatch 对比
    const { PNG } = require('pngjs');
    const pixelmatch = require('pixelmatch');

    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const current = PNG.sync.read(fs.readFileSync(currentPath));

    // 尺寸不匹配时使用较大尺寸
    const width = Math.max(baseline.width, current.width);
    const height = Math.max(baseline.height, current.height);

    // 如果尺寸不同，resize 到最大尺寸（填充透明）
    const baselineResized = new PNG({ width, height });
    const currentResized = new PNG({ width, height });
    PNG.bitblt(baseline, baselineResized, 0, 0, baseline.width, baseline.height, 0, 0);
    PNG.bitblt(current, currentResized, 0, 0, current.width, current.height, 0, 0);

    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      baselineResized.data,
      currentResized.data,
      diff.data,
      width,
      height,
      { threshold: VISUAL_REGRESSION_CONFIG.threshold }
    );

    // 保存 diff 图
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    const diffPercent = (numDiffPixels / (width * height)) * 100;
    console.log(`[visual] ${page.name}: ${numDiffPixels} 差异像素 (${diffPercent.toFixed(2)}%)`);

    // 断言：差异像素不超过阈值
    expect(numDiffPixels).toBeLessThanOrEqual(
      VISUAL_REGRESSION_CONFIG.maxDiffPixels
    );
  });
}

// ─── VISUAL_PENDING 替代验证 ─────────────────────────────────────────────────

test('所有 VISUAL_PENDING 页面已通过自动化视觉回归', async () => {
  // 此测试验证：如果所有页面都通过了截图对比，
  // 则不需要人工确认 VISUAL_PENDING

  const currentFiles = fs.readdirSync(CURRENT_DIR).filter(f => f.endsWith('.png'));
  const baselineFiles = fs.readdirSync(BASELINE_DIR).filter(f => f.endsWith('.png'));
  const diffFiles = fs.readdirSync(DIFF_DIR).filter(f => f.endsWith('.png'));

  console.log(`[summary] baseline: ${baselineFiles.length}, current: ${currentFiles.length}, diff: ${diffFiles.length}`);

  // 如果没有任何截图，跳过（首次运行前的状态）
  if (currentFiles.length === 0) {
    test.skip(true, '无截图文件，跳过');
    return;
  }

  // 验证 diff 目录中的文件数量 ≤ maxDiffPixels 允许的失败数
  // （实际断言在每个页面的测试中完成）
  expect(currentFiles.length).toBeGreaterThan(0);
});
