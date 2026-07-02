#!/usr/bin/env node

/**
 * E2E Coverage Gate — Stage 3.5 / Stage 4 强制门禁
 *
 * 扫描 tests/e2e/ 和 integration-tests/scenarios/ 下的所有 E2E 测试文件，
 * 统计用例数并按分类对比最低门槛。
 *
 * 用法:
 *   node scripts/check-e2e-coverage.js              # 输出完整报告
 *   node scripts/check-e2e-coverage.js --ci          # CI 模式（退出码 0/1）
 *   node scripts/check-e2e-coverage.js --json        # JSON 输出
 *   node scripts/check-e2e-coverage.js --min-cases 70  # 自定义最低总用例数
 *
 * 退出码:
 *   0 — 全部通过
 *   1 — 覆盖率不达标
 *   2 — 扫描错误（无测试文件等）
 */

const fs = require('fs');
const path = require('path');

// ─── 最低门槛定义（与 kf-mvp-test-e2e 强制清单对齐）──────────────────────
const THRESHOLDS = {
  total: 70,          // 全量模式最低总用例数
  login: 12,          // 登录流程（每角色+错误+改密+找回+退出）
  navigation: 5,      // 菜单导航（完整+权限+跳转+404+面包屑）
  crudPerModule: 7,   // 每模块 CRUD（创建×2+列表+详情+编辑+删除+取消）
  workflow: 21,       // 工作流（管理员8+销售7+渠道6）
  dataIsolation: 1,   // 数据隔离
};

// ─── 搜索目录 ──────────────────────────────────────────────────────────
const SEARCH_DIRS = [
  'tests/e2e',
  'integration-tests/scenarios',
];

// ─── 辅助函数 ──────────────────────────────────────────────────────────

/** 递归获取目录下所有 .spec.ts / .test.ts 文件 */
function findTestFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

/** 从文件中统计 it/test 用例数 */
function countTestCases(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // 匹配 test('...', 或 it('...', 或 test(`...`, 或 it(`...`,
    const pattern = /(?:test|it)\s*\(\s*(['"`])/g;
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

/** 根据文件名和内容推测测试分类 */
function classifyFile(filePath, content) {
  const fileName = path.basename(filePath).toLowerCase();
  const fileContent = (content || '').toLowerCase();

  // 登录相关
  if (
    fileName.includes('auth') ||
    fileName.includes('login') ||
    fileName.includes('logout') ||
    fileContent.includes('describe(\'[workflow]') && fileContent.includes('login')
  ) {
    return 'login';
  }

  // 导航相关
  if (
    fileName.includes('nav') ||
    fileName.includes('dashboard') ||
    fileName.includes('menu') ||
    fileName.includes('breadcrumb')
  ) {
    return 'navigation';
  }

  // 工作流测试
  if (
    fileName.includes('workflow') ||
    fileName.includes('internal') ||
    fileName.includes('partner') ||
    fileContent.includes('[workflow]')
  ) {
    return 'workflow';
  }

  // 数据隔离
  if (
    fileName.includes('isolation') ||
    fileName.includes('permission') ||
    fileName.includes('data-permission')
  ) {
    return 'dataIsolation';
  }

  // 默认归为 CRUD（模块级测试）
  return 'crud';
}

/** 统计唯一模块数（从 CRUD 类文件名提取） */
function extractModuleNames(files) {
  const modules = new Set();
  for (const f of files) {
    const name = path.basename(f).toLowerCase();
    // 去掉后缀和常见后缀
    const clean = name.replace(/\.(spec|test)\.ts$/, '').replace(/\.visual$/, '');
    if (clean && !['helpers', 'factory', 'testfactory', 'account-helper'].includes(clean)) {
      modules.add(clean);
    }
  }
  return modules;
}

// ─── 主逻辑 ────────────────────────────────────────────────────────────

function analyze(args) {
  const ciMode = args.includes('--ci');
  const jsonMode = args.includes('--json');
  const minCasesIdx = args.indexOf('--min-cases');
  const minCases = minCasesIdx !== -1 ? parseInt(args[minCasesIdx + 1], 10) : THRESHOLDS.total;

  // 1. 扫描所有测试文件
  const allFiles = [];
  for (const dir of SEARCH_DIRS) {
    allFiles.push(...findTestFiles(dir));
  }

  if (allFiles.length === 0) {
    const err = { error: 'NO_E2E_FILES', message: '未找到任何 E2E 测试文件（tests/e2e/ 或 integration-tests/scenarios/）' };
    if (jsonMode) { console.log(JSON.stringify(err, null, 2)); }
    else { console.error(`❌ ${err.message}`); }
    process.exit(2);
  }

  // 2. 逐文件统计
  const fileStats = [];
  const categoryCounts = { login: 0, navigation: 0, crud: 0, workflow: 0, dataIsolation: 0 };

  for (const file of allFiles) {
    let content = '';
    try { content = fs.readFileSync(file, 'utf-8'); } catch { /* skip unreadable */ }
    const count = countTestCases(file);
    const category = classifyFile(file, content);

    fileStats.push({
      file: path.relative(process.cwd(), file),
      category,
      cases: count,
    });

    categoryCounts[category] += count;
  }

  const totalCases = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const crudModules = extractModuleNames(fileStats.filter(f => f.category === 'crud').map(f => f.file));

  // 3. 计算 CRUD 最低要求
  const moduleCount = crudModules.size || 1;
  const requiredCrud = moduleCount * THRESHOLDS.crudPerModule;

  // 4. 逐项比对
  const checks = [
    { name: '总用例', required: minCases, actual: totalCases },
    { name: '登录流程', required: THRESHOLDS.login, actual: categoryCounts.login },
    { name: '菜单导航', required: THRESHOLDS.navigation, actual: categoryCounts.navigation },
    { name: `CRUD（${moduleCount}模块×${THRESHOLDS.crudPerModule}）`, required: requiredCrud, actual: categoryCounts.crud },
    { name: '工作流测试', required: THRESHOLDS.workflow, actual: categoryCounts.workflow },
    { name: '数据隔离', required: THRESHOLDS.dataIsolation, actual: categoryCounts.dataIsolation },
  ];

  const allPassed = checks.every(c => c.actual >= c.required);
  const failedChecks = checks.filter(c => c.actual < c.required);

  // 5. 输出
  if (jsonMode) {
    console.log(JSON.stringify({
      passed: allPassed,
      totalCases,
      requiredTotal: minCases,
      categoryCounts,
      thresholds: { ...THRESHOLDS, crudRequired: requiredCrud },
      files: fileStats,
      checks: checks.map(c => ({ ...c, passed: c.actual >= c.required })),
    }, null, 2));
  } else {
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  E2E Coverage Gate Report');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log(`  扫描文件数: ${allFiles.length}`);
    console.log(`  总用例数:   ${totalCases} (最低要求: ${minCases})`);
    console.log(`  检测模块:   ${moduleCount} 个 (${[...crudModules].join(', ') || '未知'})`);
    console.log('');
    console.log('  分类统计:');
    console.log('  ─────────────────────────────────────');

    for (const check of checks) {
      const icon = check.actual >= check.required ? '✅' : '❌';
      const gap = check.actual >= check.required
        ? ''
        : ` (缺 ${check.required - check.actual})`;
      console.log(`  ${icon} ${check.name.padEnd(24)} ${String(check.actual).padStart(3)} / ${String(check.required).padStart(3)}${gap}`);
    }

    console.log('');
    console.log('  文件明细:');
    console.log('  ─────────────────────────────────────');
    for (const f of fileStats) {
      console.log(`  [${f.category.padEnd(13)}] ${f.cases.toString().padStart(3)} cases — ${f.file}`);
    }

    console.log('');
    if (allPassed) {
      console.log('  ✅ E2E 覆盖率门禁通过！');
      console.log('');
      process.exit(0);
    } else {
      console.log('  ❌ E2E 覆盖率门禁未通过！');
      console.log('');
      console.log('  未达标项:');
      for (const c of failedChecks) {
        console.log(`    - ${c.name}: ${c.actual}/${c.required} (缺 ${c.required - c.actual} 用例)`);
      }
      console.log('');
      console.log('  修复建议:');
      console.log('    1. 补齐缺失分类的测试用例');
      console.log('    2. 确保每个 CRUD 模块至少 7 个用例');
      console.log('    3. 确保工作流测试覆盖每个角色核心业务闭环');
      console.log('    4. 运行 Stage 3.5 E2E-Adapt 阶段自动补齐');
      console.log('');
      process.exit(1);
    }
  }

  return { allPassed, checks, totalCases };
}

// ─── 入口 ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
analyze(args);
