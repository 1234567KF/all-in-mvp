/**
 * E2E 环境消毒器 — 全量回归前置步骤
 *
 * 在 E2E 测试启动前确保环境干净，消除人为验收时常见的"乌龙"事件：
 *   1. 端口冲突检测（3333=后端, 5555=前端, 2222=预留）
 *   2. 残留进程清理
 *   3. 前端依赖检查（demo-frontend/node_modules）
 *   4. 数据库就绪检查（wecrm.db 不存在则自动 seed）
 *
 * 用法:
 *   node scripts/e2e-sanitizer.js               # 完整消毒 + 报告
 *   node scripts/e2e-sanitizer.js --ci           # CI 模式（退出码 0/1）
 *   node scripts/e2e-sanitizer.js --dry-run      # 仅检查，不执行清理
 *
 * 退出码:
 *   0 — 环境干净，可继续
 *   1 — 环境存在问题且无法自动修复
 *   2 — 脚本执行异常
 */

const fs = require('fs')
const path = require('path')
const { execSync, spawnSync } = require('child_process')

// ─── 配置 ──────────────────────────────────────────────────────────────

const PORTS = [
  { port: 3333, name: '后端 API', critical: true },
  { port: 5555, name: '前端 Vite', critical: true },
  { port: 2222, name: '预留服务', critical: false },
]

const ROOT = process.cwd()

// ─── 工具函数 ──────────────────────────────────────────────────────────

/** 检查 Windows 端口占用，返回 PID 列表 */
function checkPortWindows(port) {
  try {
    const result = execSync(`netstat -ano | findstr :${port}`, {
      encoding: 'utf-8',
      timeout: 5000,
    })
    const lines = result.trim().split('\n').filter(Boolean)
    const pids = new Set()
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const pid = parseInt(parts[parts.length - 1], 10)
      if (pid && !isNaN(pid) && pid !== 0) {
        pids.add(pid)
      }
    }
    return [...pids]
  } catch {
    // findstr 退出码 1 表示无匹配，即端口空闲
    return []
  }
}

/** 获取进程名称（Windows） */
function getProcessName(pid) {
  try {
    const result = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: 'utf-8',
      timeout: 5000,
    })
    const match = result.match(/"([^"]+)"/)
    return match ? match[1] : `PID ${pid}`
  } catch {
    return `PID ${pid}`
  }
}

/** 终止进程（Windows） */
function killProcess(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { timeout: 5000, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/** 检查目录是否存在 */
function dirExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
}

/** 检查文件是否存在 */
function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
}

// ─── 检查函数 ──────────────────────────────────────────────────────────

function sanitizePorts(ciMode, dryRun) {
  const results = []

  for (const { port, name, critical } of PORTS) {
    const pids = checkPortWindows(port)

    if (pids.length === 0) {
      results.push({
        check: `端口 ${port} (${name})`,
        passed: true,
        message: `空闲`,
        detail: '',
        critical,
      })
      continue
    }

    // 端口被占用 — 识别进程
    const processInfo = pids.map(pid => ({
      pid,
      name: getProcessName(pid),
    }))

    const isNodeProcess = processInfo.some(p =>
      p.name.toLowerCase().includes('node') ||
      p.name.toLowerCase().includes('npm') ||
      p.name.toLowerCase().includes('bun') ||
      p.name.toLowerCase().includes('vite')
    )

    if (isNodeProcess && !dryRun) {
      // 疑似残留的 Node 进程 → 尝试清理
      let killed = 0
      for (const { pid, name: pname } of processInfo) {
        if (killProcess(pid)) killed++
      }

      results.push({
        check: `端口 ${port} (${name})`,
        passed: true,
        message: `已清理 ${killed}/${pids.length} 个残留进程`,
        detail: processInfo.map(p => `  ${p.name} (PID ${p.pid})`).join('\n'),
        critical,
      })
    } else if (dryRun) {
      results.push({
        check: `端口 ${port} (${name})`,
        passed: !critical,
        message: dryRun ? '检测到占用（仅报告未清理）' : '占用中',
        detail: processInfo.map(p => `  ${p.name} (PID ${p.pid})`).join('\n'),
        critical,
      })
    } else {
      // 非 Node 进程占用 → 无法自动处理
      results.push({
        check: `端口 ${port} (${name})`,
        passed: false,
        message: `被非 Node 进程占用，无法自动清理`,
        detail: processInfo.map(p => `  ${p.name} (PID ${p.pid})`).join('\n'),
        critical,
      })
    }
  }

  return results
}

function checkFrontendDeps() {
  const demoDir = path.join(ROOT, 'demo-frontend')
  const nodeModules = path.join(demoDir, 'node_modules')

  if (!dirExists(demoDir)) {
    return {
      check: 'demo-frontend 目录',
      passed: false,
      message: '目录不存在',
      detail: '请确认仓库已包含 demo-frontend 目录',
      critical: true,
    }
  }

  if (!dirExists(nodeModules)) {
    return {
      check: '前端依赖 (node_modules)',
      passed: false,
      message: '未安装依赖',
      detail: '请运行: cd demo-frontend && bun install',
      critical: true,
    }
  }

  return {
    check: '前端依赖 (node_modules)',
    passed: true,
    message: '已安装',
    detail: `路径: demo-frontend/node_modules`,
    critical: true,
  }
}

function checkDatabase() {
  const dbPath = path.join(ROOT, 'wecrm.db')

  if (fileExists(dbPath)) {
    return {
      check: '文件数据库 (wecrm.db)',
      passed: true,
      message: '已存在',
      detail: `大小: ${(fs.statSync(dbPath).size / 1024).toFixed(1)} KB`,
      critical: false,
    }
  }

  // 数据库不存在 → 自动 seed
  return {
    check: '文件数据库 (wecrm.db)',
    passed: false,
    message: '不存在（将自动初始化）',
    detail: '',
    critical: false,
    needsSeed: true,
  }
}

// ─── 报告逻辑 ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const ciMode = args.includes('--ci')
  const dryRun = args.includes('--dry-run')

  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  E2E 环境消毒器')
  console.log(`  模式: ${dryRun ? '仅检查' : '自动清理'}`)
  console.log('═══════════════════════════════════════════')
  console.log('')

  const allResults = []

  // 1. 端口检测 + 清理
  console.log('▶ 端口检测...')
  const portResults = sanitizePorts(ciMode, dryRun)
  allResults.push(...portResults)

  // 2. 前端依赖检查
  console.log('▶ 前端依赖检查...')
  const depResult = checkFrontendDeps()
  allResults.push(depResult)

  // 3. 数据库检查
  console.log('▶ 数据库检查...')
  const dbResult = checkDatabase()
  allResults.push(dbResult)

  // 4. 自动 seed（如果需要）
  if (dbResult.needsSeed && !dryRun) {
    console.log('')
    console.log('▶ 自动初始化数据库...')
    try {
      execSync('bun run templates/e2e/seed.ts --reset', {
        cwd: ROOT,
        stdio: 'inherit',
        timeout: 30_000,
      })
      console.log('  ✅ 数据库初始化完成')
      // 更新结果
      dbResult.passed = true
      dbResult.message = '已自动初始化'
    } catch (err) {
      dbResult.passed = false
      dbResult.message = `自动初始化失败: ${err.message}`
    }
  }

  // 5. 汇总
  const critical = allResults.filter(r => r.critical)
  const criticalFailed = critical.filter(r => !r.passed)
  const totalPassed = allResults.filter(r => r.passed).length

  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  消毒结果')
  console.log('═══════════════════════════════════════════')
  console.log('')

  for (const r of allResults) {
    const icon = r.passed ? '✅' : '❌'
    const sev = r.critical ? '[关键]' : '[建议]'
    console.log(`  ${icon} ${sev} ${r.check}`)
    console.log(`     ${r.message}`)
    if (r.detail) {
      const lines = r.detail.split('\n')
      for (const line of lines) {
        console.log(`     ${line}`)
      }
    }
    console.log('')
  }

  console.log('═══════════════════════════════════════════')
  console.log(`  结果: ${totalPassed}/${allResults.length} 通过`)

  if (criticalFailed.length === 0) {
    console.log('')
    console.log('  ✅ 环境干净，可以启动 E2E 测试！')
    console.log('')
    process.exit(0)
  } else {
    console.log('')
    console.log('  ❌ 以下关键项未通过，请手动修复后重试:')
    for (const r of criticalFailed) {
      console.log(`     - ${r.check}: ${r.message}`)
    }
    console.log('')
    process.exit(1)
  }
}

main().catch(err => {
  console.error(`❌ 消毒器异常: ${err.message}`)
  process.exit(2)
})
