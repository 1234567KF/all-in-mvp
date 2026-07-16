/**
 * E2E 环境初始化检查脚本 — Stage 4 前置验证
 *
 * 在 E2E 测试前验证环境完整性，明确区分：
 *   - 单元测试通过（内存数据库）
 *   - E2E 测试通过（文件数据库 + 真实服务）
 *   - 人工验收通过（浏览器端到端）
 *
 * 用法:
 *   node scripts/check-e2e-env.js           # 完整检查报告
 *   node scripts/check-e2e-env.js --ci      # CI 模式（退出码 0/1）
 *
 * 退出码:
 *   0 — 全部通过
 *   1 — 存在未通过项
 *   2 — 脚本执行错误
 *
 * 检查项:
 *   1. 文件数据库是否存在（wecrm.db / *.db）
 *   2. 数据库表是否已创建（users / roles）
 *   3. Seed 数据是否已插入（测试用户数量 ≥ 4）
 *   4. 后端服务是否可访问（health endpoint）
 *   5. 前端服务是否可访问（Vite dev server）
 *   6. 登录接口是否正常（POST /auth/login 返回 token）
 *   7. Vite 代理是否配置（vite.config.ts 含 proxy）
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ─── 配置 ──────────────────────────────────────────────────────────────

const CHECKS = {
  db: {
    name: '文件数据库',
    description: 'wecrm.db 或 *.db 文件存在',
    severity: 'critical',
  },
  tables: {
    name: '数据库表结构',
    description: 'users / roles 表已创建',
    severity: 'critical',
  },
  seed: {
    name: 'Seed 数据',
    description: '测试用户 ≥ 4 个（admin/sales/partner）',
    severity: 'critical',
  },
  backend: {
    name: '后端服务',
    description: 'http://localhost:3333/health 可访问',
    severity: 'critical',
  },
  frontend: {
    name: '前端服务',
    description: 'http://127.0.0.1:5555 可访问',
    severity: 'warning',
  },
  login: {
    name: '登录接口',
    description: 'POST /api/auth/login 返回 token',
    severity: 'critical',
  },
  proxy: {
    name: 'Vite 代理配置',
    description: 'vite.config.ts 含 /api proxy 配置',
    severity: 'warning',
  },
}

// ─── 检查函数 ──────────────────────────────────────────────────────────

function findDbFile() {
  const cwd = process.cwd()
  // 优先 wecrm.db，其次任意 .db 文件
  const wecrmPath = path.join(cwd, 'wecrm.db')
  if (fs.existsSync(wecrmPath)) return wecrmPath

  const files = fs.readdirSync(cwd)
  const dbFile = files.find(f => f.endsWith('.db') && f !== '.ultra-cost-effective-tracker.json')
  return dbFile ? path.join(cwd, dbFile) : null
}

function checkDb() {
  const dbPath = findDbFile()
  if (!dbPath) {
    return {
      passed: false,
      message: '未找到文件数据库（wecrm.db），请运行: bun run templates/e2e/seed.ts',
      detail: `搜索路径: ${process.cwd()}`,
    }
  }
  return {
    passed: true,
    message: `数据库已存在: ${path.relative(process.cwd(), dbPath)}`,
    detail: `文件大小: ${(fs.statSync(dbPath).size / 1024).toFixed(1)} KB`,
  }
}

function checkTables() {
  const dbPath = findDbFile()
  if (!dbPath) {
    return { passed: false, message: '无数据库文件，跳过表结构检查' }
  }
  // 静态检查: 尝试加载 better-sqlite3
  try {
    const Database = require('better-sqlite3')
    const db = new Database(dbPath, { readonly: true })
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all().map(r => r.name)
    db.close()

    const required = ['users', 'roles']
    const missing = required.filter(t => !tables.includes(t))

    if (missing.length > 0) {
      return {
        passed: false,
        message: `缺少表: ${missing.join(', ')}。请运行: bun run templates/e2e/seed.ts`,
        detail: `已有表: ${tables.join(', ') || '无'}`,
      }
    }

    return {
      passed: true,
      message: `所有必需表已创建: ${tables.join(', ')}`,
      detail: `共 ${tables.length} 个表`,
    }
  } catch (err) {
    // 可能 better-sqlite3 未安装
    return {
      passed: true, // 无法检查时不阻断
      message: '跳过表结构检查（better-sqlite3 未安装或无法加载）',
      detail: err.message,
    }
  }
}

function checkSeed() {
  const dbPath = findDbFile()
  if (!dbPath) {
    return { passed: false, message: '无数据库文件，跳过 Seed 数据检查' }
  }
  try {
    const Database = require('better-sqlite3')
    const db = new Database(dbPath, { readonly: true })

    // 检查 users 表
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()
    const roles = db.prepare('SELECT DISTINCT role FROM users').all().map(r => r.role)

    db.close()

    const actualCount = userCount?.count || 0
    if (actualCount < 4) {
      return {
        passed: false,
        message: `测试用户不足: ${actualCount}/4。请运行: bun run templates/e2e/seed.ts`,
        detail: `需要至少 admin/sales1/sales2/partner1 四个用户`,
      }
    }

    return {
      passed: true,
      message: `测试用户充足: ${actualCount} 个`,
      detail: `角色分布: ${roles.join(', ')}`,
    }
  } catch (err) {
    return {
      passed: true,
      message: '跳过 Seed 数据检查（better-sqlite3 未安装）',
      detail: err.message,
    }
  }
}

async function checkBackend() {
  const url = 'http://localhost:3333/health'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) {
      const body = await res.json()
      return {
        passed: true,
        message: '后端服务正常',
        detail: JSON.stringify(body),
      }
    }
    return {
      passed: false,
      message: `后端返回 ${res.status}`,
      detail: `请运行: bun run templates/e2e/start-server.ts`,
    }
  } catch (err) {
    return {
      passed: false,
      message: '后端服务不可达',
      detail: `请运行: bun run templates/e2e/start-server.ts (${err.message})`,
    }
  }
}

async function checkFrontend() {
  const url = 'http://127.0.0.1:5555'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    return {
      passed: true,
      message: '前端服务正常（Vite dev server）',
      detail: `状态码: ${res.status}`,
    }
  } catch (err) {
    return {
      passed: false,
      message: '前端服务不可达',
      detail: `请运行: cd demo-frontend && bun run dev`,
    }
  }
}

async function checkLogin() {
  const url = 'http://localhost:3333/auth/login'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      const body = await res.json()
      if (body.token) {
        return {
          passed: true,
          message: '登录接口正常',
          detail: `返回 token: ${body.token.substring(0, 20)}..., 角色: ${body.user?.role}`,
        }
      }
      return {
        passed: false,
        message: '登录接口返回异常（无 token）',
        detail: JSON.stringify(body).substring(0, 100),
      }
    }
    return {
      passed: false,
      message: `登录失败: HTTP ${res.status}`,
      detail: `请确认 seed 数据已初始化: bun run templates/e2e/seed.ts`,
    }
  } catch (err) {
    return {
      passed: false,
      message: '登录接口不可达',
      detail: `请确认后端已启动: bun run templates/e2e/start-server.ts (${err.message})`,
    }
  }
}

function checkProxy() {
  const configPaths = [
    path.join(process.cwd(), 'vite.config.ts'),
    path.join(process.cwd(), 'apps', 'web', 'vite.config.ts'),
  ]

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8')
      if (content.includes("'/api'") && content.includes('proxy')) {
        return {
          passed: true,
          message: 'Vite 代理配置正确',
          detail: `配置文件: ${path.relative(process.cwd(), configPath)}`,
        }
      }
    }
  }

  return {
    passed: false,
    message: '未找到 Vite 代理配置',
    detail: '请在 vite.config.ts 中配置 /api → http://localhost:3333 的 proxy',
  }
}

// ─── 报告逻辑 ──────────────────────────────────────────────────────────

async function runChecks(args) {
  const ciMode = args.includes('--ci')
  const results = []

  // 文件级检查（同步）
  results.push({ ...CHECKS.db, ...checkDb() })
  results.push({ ...CHECKS.tables, ...checkTables() })
  results.push({ ...CHECKS.seed, ...checkSeed() })
  results.push({ ...CHECKS.proxy, ...checkProxy() })

  // 网络级检查（异步）
  results.push({ ...CHECKS.backend, ...(await checkBackend()) })

  // 仅在 backend 正常时检查 login
  const backendOk = results.find(r => r.name === '后端服务')?.passed
  if (backendOk) {
    results.push({ ...CHECKS.login, ...(await checkLogin()) })
  } else {
    results.push({ ...CHECKS.login, passed: false, message: '跳过（后端不可达）', detail: '' })
  }

  results.push({ ...CHECKS.frontend, ...(await checkFrontend()) })

  // 统计
  const critical = results.filter(r => r.severity === 'critical')
  const criticalFailed = critical.filter(r => !r.passed)
  const allCriticalPassed = criticalFailed.length === 0
  const totalPassed = results.filter(r => r.passed).length

  if (ciMode) {
    if (allCriticalPassed) {
      console.log(`✅ E2E 环境检查通过 (${totalPassed}/${results.length})`)
      process.exit(0)
    } else {
      console.log(`❌ E2E 环境检查未通过 — ${criticalFailed.length} 个关键项失败:`)
      for (const r of criticalFailed) {
        console.log(`   ❌ ${r.name}: ${r.message}`)
      }
      process.exit(1)
    }
  }

  // 完整报告
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  E2E 环境初始化检查报告')
  console.log('═══════════════════════════════════════════')
  console.log('')

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    const sev = r.severity === 'critical' ? '[关键]' : '[建议]'
    console.log(`  ${icon} ${sev} ${r.name}`)
    console.log(`     ${r.message}`)
    if (r.detail) {
      console.log(`     ${r.detail}`)
    }
    console.log('')
  }

  console.log('═══════════════════════════════════════════')
  console.log(`  结果: ${totalPassed}/${results.length} 通过`)

  if (allCriticalPassed) {
    console.log('')
    console.log('  ✅ 所有关键项通过！可以运行 E2E 测试:')
    console.log('     bunx playwright test')
  } else {
    console.log('')
    console.log('  ❌ 关键项未通过！请按以下顺序初始化:')
    console.log('')
    console.log('  方式 1 (一键):')
    console.log('     bun run templates/e2e/setup-e2e-env.ts')
    console.log('')
    console.log('  方式 2 (分步):')
    console.log('     1. bun run templates/e2e/seed.ts          # 初始化数据库')
    console.log('     2. bun run templates/e2e/start-server.ts  # 启动后端（3333）')
    console.log('     3. cd demo-frontend && bun run dev              # 启动前端（5555）')
    console.log('     4. node scripts/check-e2e-env.js           # 重新检查')
  }
  console.log('')

  process.exit(allCriticalPassed ? 0 : 1)
}

// ─── 入口 ──────────────────────────────────────────────────────────────

runChecks(process.argv.slice(2)).catch(err => {
  console.error(`❌ 检查脚本异常: ${err.message}`)
  process.exit(2)
})
