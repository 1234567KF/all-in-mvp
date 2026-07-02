#!/usr/bin/env node

/**
 * E2E Headed/Headless Parity Gate — Stage 4 强制门禁
 *
 * 对比 L4 headed (有头浏览器) 和 L5 headless (无头浏览器) 的 Playwright JSON 报告，
 * 检测三种不一致类型：
 *   - 类型1 (无头独败): L5 失败但 L4 通过 → 无头渲染差异
 *   - 类型2 (有头独败): L4 失败但 L5 通过 → 有头竞态/动画差异
 *   - 类型3 (双方失败): L4 和 L5 均失败 → 真实 Bug（不计入不一致，但计数）
 *
 * 用法:
 *   node scripts/check-e2e-parity.js \
 *     --headed test-results/l4-headed.json \
 *     --headless test-results/l5-headless.json
 *
 *   node scripts/check-e2e-parity.js --ci \
 *     --headed test-results/l4-headed.json \
 *     --headless test-results/l5-headless.json
 *
 * 退出码:
 *   0 — 无 HIGH 级别差异
 *   1 — 存在 HIGH 级别不一致
 *   2 — 参数错误或文件缺失
 */

const fs = require('fs');
const path = require('path');

// ─── 参数解析 ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { ci: false, headed: null, headless: null };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ci') {
      args.ci = true;
    } else if (argv[i] === '--headed' && i + 1 < argv.length) {
      args.headed = argv[++i];
    } else if (argv[i] === '--headless' && i + 1 < argv.length) {
      args.headless = argv[++i];
    }
  }

  return args;
}

// ─── 报告解析 ──────────────────────────────────────────────────────────

function parsePlaywrightReport(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Playwright JSON reporter 格式: { suites: [...], stats: {...} }
  const results = new Map(); // testTitle → { status, duration }

  if (raw.suites) {
    flattenSuites(raw.suites, results);
  }

  // 备选格式: 直接是数组
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item.title && item.status) {
        results.set(item.title, { status: item.status, duration: item.duration || 0 });
      }
    }
  }

  return {
    file: filePath,
    stats: raw.stats || { total: results.size },
    results,
  };
}

function flattenSuites(suites, results, parentTitle = '') {
  for (const suite of suites) {
    const title = parentTitle ? `${parentTitle} › ${suite.title}` : suite.title;

    // 收集当前 suite 的 tests
    if (suite.specs) {
      for (const spec of suite.specs) {
        if (spec.tests) {
          for (const test of spec.tests) {
            const fullTitle = test.title
              ? `${spec.title || title} › ${test.title}`
              : (spec.title || title);
            const status = determineStatus(test);
            results.set(fullTitle, {
              status,
              duration: test.results?.[0]?.duration || 0,
            });
          }
        }
      }
    }

    // 递归子 suites
    if (suite.suites) {
      flattenSuites(suite.suites, results, title);
    }
  }
}

function determineStatus(test) {
  // expected: 'passed' | 'failed' | 'skipped'
  // status: 'expected' | 'unexpected' | 'flaky' | 'skipped'
  if (test.expectedStatus === 'skipped' || test.status === 'skipped') return 'skipped';
  if (test.status === 'expected' && test.expectedStatus === 'passed') return 'passed';
  if (test.status === 'unexpected' || test.expectedStatus === 'failed') return 'failed';
  if (test.status === 'flaky') return 'flaky';
  return test.status || 'unknown';
}

// ─── 对比分析 ──────────────────────────────────────────────────────────

function compareReports(headed, headless) {
  const allTests = new Set([...headed.results.keys(), ...headless.results.keys()]);

  const type1 = []; // L5 独败 (headless fails, headed passes)
  const type2 = []; // L4 独败 (headed fails, headless passes)
  const type3 = []; // 双方失败
  const passed  = []; // 双方通过

  for (const testName of allTests) {
    const hd = headed.results.get(testName);
    const hl = headless.results.get(testName);

    const hdStatus = hd?.status || 'missing';
    const hlStatus = hl?.status || 'missing';

    const entry = { test: testName, headed: hdStatus, headless: hlStatus };

    if (hdStatus === 'passed' && hlStatus === 'passed') {
      passed.push(entry);
    } else if ((hdStatus === 'passed' || hdStatus === 'skipped') && hlStatus === 'failed') {
      type1.push(entry);
    } else if (hdStatus === 'failed' && (hlStatus === 'passed' || hlStatus === 'skipped')) {
      type2.push(entry);
    } else if (hdStatus === 'failed' && hlStatus === 'failed') {
      type3.push(entry);
    }
    // 忽略 flaky / missing（非致命）
  }

  return { type1, type2, type3, passed };
}

// ─── 严重程度判定 ──────────────────────────────────────────────────────

function classifySeverity(type1, type2, type3, totalTests) {
  const inconsistentCount = type1.length + type2.length;

  if (inconsistentCount === 0) {
    return { level: 'PASS', message: '有头/无头完全一致' };
  }

  const inconsistentRate = inconsistentCount / (totalTests || 1);

  if (inconsistentRate > 0.1) {
    return { level: 'HIGH', message: `不一致率 ${(inconsistentRate * 100).toFixed(1)}% > 10%，存在严重的渲染差异` };
  }

  if (type1.length > 0 && type2.length === 0) {
    // 仅无头独败 → 可能是无头渲染限制（如:focus-visible）
    return { level: 'MEDIUM', message: `${type1.length} 个用例仅在无头环境失败，可能是 headless 渲染限制` };
  }

  if (type2.length > 0 && type1.length === 0) {
    return { level: 'MEDIUM', message: `${type2.length} 个用例仅在有头环境失败，可能是有头环境竞态或动画差异` };
  }

  return { level: 'LOW', message: `${inconsistentCount} 个不一致用例，但占比 < 10%` };
}

// ─── 输出 ──────────────────────────────────────────────────────────────

function outputReport(result, args) {
  const { headed, headless, type1, type2, type3, passed } = result;
  const totalTests = type1.length + type2.length + type3.length + passed.length;
  const severity = classifySeverity(type1, type2, type3, totalTests);

  if (args.ci) {
    // CI 模式：精简输出
    if (severity.level === 'PASS') {
      console.log(`✅ E2E Parity: ${totalTests} tests, 0 inconsistencies`);
      process.exit(0);
    } else if (severity.level === 'HIGH') {
      console.log(`❌ E2E Parity FAILED: ${severity.message}`);
      console.log(`   类型1 (无头独败): ${type1.length}`);
      console.log(`   类型2 (有头独败): ${type2.length}`);
      console.log(`   类型3 (双方失败): ${type3.length}`);
      process.exit(1);
    } else {
      console.log(`⚠️  E2E Parity WARNING: ${severity.message}`);
      process.exit(0); // MEDIUM/LOW 不阻断 CI
    }
  }

  // 完整报告
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  E2E Headed/Headless Parity Report');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log(`  Heade report:   ${path.basename(headed.file)}`);
  console.log(`  Headless report: ${path.basename(headless.file)}`);
  console.log('');
  console.log(`  总测试数:   ${totalTests}`);
  console.log(`  双方通过:   ${passed.length}`);
  console.log(`  双方失败:   ${type3.length} (真实 Bug，计入修复)`);
  console.log(`  类型1 (无头独败): ${type1.length}`);
  console.log(`  类型2 (有头独败): ${type2.length}`);
  console.log('');
  console.log(`  判定: [${severity.level}] ${severity.message}`);
  console.log('');

  if (type1.length > 0) {
    console.log('  ⚠️  类型1 — 无头独败:');
    for (const t of type1.slice(0, 10)) {
      console.log(`      ${t.test}`);
      console.log(`        headed: ${t.headed} | headless: ${t.headless}`);
    }
    if (type1.length > 10) console.log(`      ... 还有 ${type1.length - 10} 个`);
    console.log('');
  }

  if (type2.length > 0) {
    console.log('  ⚠️  类型2 — 有头独败:');
    for (const t of type2.slice(0, 10)) {
      console.log(`      ${t.test}`);
      console.log(`        headed: ${t.headed} | headless: ${t.headless}`);
    }
    if (type2.length > 10) console.log(`      ... 还有 ${type2.length - 10} 个`);
    console.log('');
  }

  if (type3.length > 0) {
    console.log('  ❌  类型3 — 双方失败 (需修复):');
    for (const t of type3.slice(0, 5)) {
      console.log(`      ${t.test}`);
    }
    if (type3.length > 5) console.log(`      ... 还有 ${type3.length - 5} 个`);
    console.log('');
  }

  if (severity.level === 'HIGH') {
    process.exit(1);
  }
}

// ─── 入口 ──────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.headed || !args.headless) {
    console.error('用法: node scripts/check-e2e-parity.js --headed <file> --headless <file> [--ci]');
    console.error('');
    console.error('示例:');
    console.error('  node scripts/check-e2e-parity.js \\');
    console.error('    --headed test-results/l4-headed.json \\');
    console.error('    --headless test-results/l5-headless.json \\');
    console.error('    --ci');
    process.exit(2);
  }

  try {
    const headed = parsePlaywrightReport(args.headed);
    const headless = parsePlaywrightReport(args.headless);
    const comparison = compareReports(headed, headless);
    outputReport({ headed, headless, ...comparison }, args);
  } catch (err) {
    console.error(`❌ 解析失败: ${err.message}`);
    process.exit(2);
  }
}

main();
