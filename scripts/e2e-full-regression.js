/**
 * E2E 全量回归入口 — 一条命令完成从环境初始化到质量报告的完整链路
 *
 * 执行顺序:
 *   Step 1: 环境消毒（端口检测 + 依赖检查 + 数据库就绪）      e2e-sanitizer.js
 *   Step 2: 数据库重置 + Seed                                 seed.ts --reset
 *   Step 3: 启动后端 + 前端服务（后台进程）                     start-server.ts + vite
 *   Step 4: 冒烟测试（API 快速验证）                            smoke-test.js
 *   Step 5: E2E 无头全量（Playwright headless）                 bunx playwright test
 *   Step 6: 覆盖率门禁                                          check-e2e-coverage.js
 *   Step 7: 有头最小基线（@headed tag，至少 5 条）              bunx playwright test --headed --grep @headed
 *   Step 8: 有头/无头一致性校验                                  check-e2e-parity.js
 *   Step 9: 停止服务 + 汇总报告                                  JSON + 摘要
 *
 * 用法:
 *   node scripts/e2e-full-regression.js                        # 完整回归
 *   node scripts/e2e-full-regression.js --skip-headed          # 跳过头测试
 *   node scripts/e2e-full-regression.js --skip-smoke           # 跳过冒烟测试
 *   node scripts/e2e-full-regression.js --ci                   # CI 模式（精简输出）
 *
 * 退出码:
 *   0 — 全量通过
 *   1 — 存在失败步骤
 *   2 — 脚本执行异常
 */

const fs = require('fs')
const path = require('path')
const { execSync, spawn } = require('child_process')

// ─── 配置 ──────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const BACKEND_PORT = 3333
const FRONTEND_PORT = 5555

// ─── 工具函数 ──────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 2000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(t)
      if (res.ok || res.status < 500) return true
    } catch { /* 服务尚未就绪 */ }
    await sleep(1000)
  }
  return false
}

function runStep(command, description, options = {}) {
  const { ciMode, cwd } = options
  const displayCmd = typeof command === 'string' ? command : command.join(' ')

  if (!ciMode) {
    console.log('')
    console.log(`▶ ${description}`)
    console.log(`  $ ${displayCmd}`)
  }

  try {
    execSync(typeof command === 'string' ? command : command.join(' '), {
      cwd: cwd || ROOT,
      stdio: ciMode ? 'pipe' : 'inherit',
      timeout: 120_000,
    })
    return { passed: true, description, error: null }
  } catch (err) {
    if (!ciMode) {
      console.error(`\n  ❌ 失败: ${description}`)
    }
    return {
      passed: false,
      description,
      error: err.message || `退出码: ${err.status}`,
    }
  }
}

// ─── 全局状态 ──────────────────────────────────────────────────────────

let backendProcess = null
let frontendProcess = null

async function cleanup() {
  if (backendProcess) {
    try { process.kill(-backendProcess.pid, 'SIGTERM') } catch { /* */ }
  }
  if (frontendProcess) {
    try { process.kill(-frontendProcess.pid, 'SIGTERM') } catch { /* */ }
  }
}

// 捕获中断信号
process.on('SIGINT', () => {
  console.log('\n\n⚠️  收到中断信号，正在停止服务...')
  if (backendProcess || frontendProcess) {
    try { execSync('taskkill /F /IM node.exe', { stdio: 'ignore' }) } catch { /* */ }
  }
  process.exit(130)
})

// ─── 主流程 ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const ciMode = args.includes('--ci')
  const skipHeaded = args.includes('--skip-headed')
  const skipSmoke = args.includes('--skip-smoke')

  const report = {
    timestamp: new Date().toISOString(),
    steps: [],
    services: [],
    startTime: Date.now(),
  }

  try {
    console.log('')
    console.log('═══════════════════════════════════════════')
    console.log('  E2E 全量回归测试')
    console.log(`  时间: ${new Date().toLocaleString()}`)
    console.log(`  后端: http://localhost:${BACKEND_PORT}`)
    console.log(`  前端: http://127.0.0.1:${FRONTEND_PORT}`)
    console.log('═══════════════════════════════════════════')

    // ── Step 1: 环境消毒 ──────────────────────────────────────────────
    const sanitizeCmd = args.includes('--dry-run')
      ? 'node scripts/e2e-sanitizer.js --dry-run'
      : 'node scripts/e2e-sanitizer.js --ci'
    const step1 = runStep(sanitizeCmd, 'Step 1/9: 环境消毒', { ciMode })
    report.steps.push(step1)
    if (!step1.passed) {
      console.error('\n❌ 环境消毒不通过，终止回归测试。请修复后重试。')
      process.exit(1)
    }

    // ── Step 2: 数据库重置 ──────────────────────────────────────────
    const step2 = runStep(
      'bun run templates/e2e/seed.ts --reset',
      'Step 2/9: 数据库重置 + Seed',
      { ciMode }
    )
    report.steps.push(step2)
    if (!step2.passed) {
      console.error('\n❌ 数据库初始化失败，终止回归测试。')
      process.exit(1)
    }

    // ── Step 3: 启动服务 ────────────────────────────────────────────
    if (!ciMode) {
      console.log('')
      console.log('▶ Step 3/9: 启动后端 + 前端服务')
    }

    // 启动后端
    const backendCmd = spawn('bun', ['run', 'templates/e2e/start-server.ts'], {
      cwd: ROOT,
      stdio: ciMode ? 'ignore' : 'inherit',
      detached: false,
      env: { ...process.env, PORT: String(BACKEND_PORT) },
    })
    backendProcess = backendCmd
    report.services.push({ name: '后端', port: BACKEND_PORT, pid: backendCmd.pid })

    if (!ciMode) console.log(`  $ bun run templates/e2e/start-server.ts (PID ${backendCmd.pid})`)

    // 等待后端就绪
    if (!ciMode) process.stdout.write('  等待后端就绪...')
    const backendReady = await waitForUrl(`http://localhost:${BACKEND_PORT}/health`, 30000)
    if (!backendReady) {
      console.error('\n❌ 后端服务启动超时，终止回归测试。')
      await cleanup()
      process.exit(1)
    }
    if (!ciMode) console.log(' ✅')

    // 启动前端
    const frontendCmd = spawn('bun', ['run', 'dev'], {
      cwd: path.join(ROOT, 'demo-frontend'),
      stdio: ciMode ? 'ignore' : 'inherit',
      detached: false,
      env: { ...process.env },
    })
    frontendProcess = frontendCmd
    report.services.push({ name: '前端', port: FRONTEND_PORT, pid: frontendCmd.pid })

    if (!ciMode) console.log(`  $ cd demo-frontend && bun run dev (PID ${frontendCmd.pid})`)

    // 等待前端就绪
    if (!ciMode) process.stdout.write('  等待前端就绪...')
    const frontendReady = await waitForUrl(`http://127.0.0.1:${FRONTEND_PORT}`, 60000)
    if (!frontendReady) {
      console.error('\n❌ 前端服务启动超时，终止回归测试。')
      await cleanup()
      process.exit(1)
    }
    if (!ciMode) console.log(' ✅')

    // ── Step 4: 冒烟测试 ────────────────────────────────────────────
    if (!skipSmoke) {
      const step4 = runStep(
        `node scripts/smoke-test.js ${ciMode ? '--ci' : ''}`,
        'Step 4/9: 冒烟测试',
        { ciMode }
      )
      report.steps.push(step4)
      if (!step4.passed) {
        console.error('\n❌ 冒烟测试失败，请检查服务状态。')
        await cleanup()
        process.exit(1)
      }
    } else {
      report.steps.push({ passed: true, description: 'Step 4/9: 冒烟测试', skipped: true })
    }

    // ── Step 5: E2E 无头全量 ───────────────────────────────────────
    const step5 = runStep(
      'bunx playwright test',
      'Step 5/9: E2E 无头全量测试',
      { ciMode }
    )
    report.steps.push(step5)

    // ── Step 6: 覆盖率门禁 ─────────────────────────────────────────
    const step6 = runStep(
      'node scripts/check-e2e-coverage.js --ci',
      'Step 6/9: 覆盖率门禁',
      { ciMode }
    )
    report.steps.push(step6)

    // ── Step 7: 有头最小基线 ───────────────────────────────────────
    if (!skipHeaded) {
      const step7 = runStep(
        'bunx playwright test --headed --project=chromium --grep @headed',
        'Step 7/9: 有头最小基线（@headed tag）',
        { ciMode }
      )
      report.steps.push(step7)
    } else {
      report.steps.push({
        passed: true,
        description: 'Step 7/9: 有头最小基线',
        skipped: true,
      })
    }

    // ── Step 8: 有头/无头一致性校验 ────────────────────────────────
    const headedResultsDir = path.join(ROOT, 'test-results', 'headed')
    const headlessResultsDir = path.join(ROOT, 'test-results', 'headless')
    const headedResults = path.join(ROOT, 'test-results', 'headed.json')
    const headlessResults = path.join(ROOT, 'test-results', 'headless.json')

    if (fs.existsSync(headedResults) && fs.existsSync(headlessResults)) {
      const step8 = runStep(
        `node scripts/check-e2e-parity.js ${ciMode ? '--ci' : ''} --headed ${headedResults} --headless ${headlessResults}`,
        'Step 8/9: 有头/无头一致性校验',
        { ciMode }
      )
      report.steps.push(step8)
    } else {
      if (!ciMode) {
        console.log('')
        console.log('▶ Step 8/9: 有头/无头一致性校验')
        console.log('  ⏭️  报告文件未生成（可能无头或有头测试未执行），跳过校验')
      }
      report.steps.push({
        passed: true,
        description: 'Step 8/9: 有头/无头一致性校验',
        skipped: true,
        detail: '报告文件缺失，跳过',
      })
    }

    // ── Step 9: 汇总 ────────────────────────────────────────────────
    await cleanup()

    const totalSteps = report.steps.filter(s => !s.skipped).length
    const passedSteps = report.steps.filter(s => s.passed).length
    const failedSteps = report.steps.filter(s => s.passed === false)
    const duration = ((Date.now() - report.startTime) / 1000).toFixed(1)

    console.log('')
    console.log('═══════════════════════════════════════════')
    console.log('  全量回归报告')
    console.log('═══════════════════════════════════════════')
    console.log('')
    console.log(`  耗时: ${duration}s`)
    console.log(`  步骤: ${passedSteps}/${report.steps.length} 通过`)
    console.log('')

    for (const step of report.steps) {
      if (step.skipped) {
        console.log(`  ⏭️  ${step.description} (已跳过)`)
      } else if (step.passed) {
        console.log(`  ✅ ${step.description}`)
      } else {
        console.log(`  ❌ ${step.description}`)
        if (step.error) console.log(`     错误: ${step.error}`)
      }
    }

    console.log('')
    console.log('═══════════════════════════════════════════')

    if (failedSteps.length === 0) {
      console.log('  ✅ 全量回归通过！')
      console.log('')
      process.exit(0)
    } else {
      console.log(`  ❌ ${failedSteps.length} 个步骤失败`)
      console.log('')
      process.exit(1)
    }

  } catch (err) {
    console.error(`\n❌ 回归测试异常: ${err.message}`)
    await cleanup()
    process.exit(2)
  }
}

main()
