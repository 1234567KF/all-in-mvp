/**
 * 端到端冒烟测试 — Stage 4 前置验证
 *
 * 模拟浏览器登录流程，验证从前端 → Vite 代理 → 后端 → 文件数据库的完整链路。
 * 不依赖 Playwright，使用原生 fetch 快速验证核心服务可用性。
 *
 * 用法:
 *   node scripts/smoke-test.js              # 完整冒烟测试
 *   node scripts/smoke-test.js --ci         # CI 模式（退出码 0/1）
 *
 * 退出码:
 *   0 — 所有测试通过
 *   1 — 存在失败测试
 *
 * 测试流程:
 *   T1: 后端健康检查
 *   T2: 登录 (admin / admin123)
 *   T3: 登录 (sales1 / sales123)
 *   T4: 登录 (partner1 / partner123)
 *   T5: 登录失败 (错误密码)
 *   T6: 获取用户列表 (带 token)
 *   T7: 前端 Vite 代理验证 (通过 /api 路径)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3333'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5555'

// ─── 测试用例定义 ──────────────────────────────────────────────────────

const TESTS = [
  {
    id: 'T1',
    name: '后端健康检查',
    fn: async () => {
      const res = await fetch(`${BASE_URL}/health`)
      const body = await res.json()
      return {
        passed: res.ok && body.status === 'ok',
        detail: `状态码: ${res.status}, 响应: ${JSON.stringify(body)}`,
      }
    },
  },
  {
    id: 'T2',
    name: '管理员登录 (admin/admin123)',
    fn: async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      })
      const body = await res.json()
      globalThis.adminToken = body.token
      return {
        passed: res.ok && !!body.token && body.user?.role === 'admin',
        detail: `角色: ${body.user?.role}, token: ${body.token?.substring(0, 20)}...`,
      }
    },
  },
  {
    id: 'T3',
    name: '销售登录 (sales1/sales123)',
    fn: async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'sales1', password: 'sales123' }),
      })
      const body = await res.json()
      globalThis.salesToken = body.token
      return {
        passed: res.ok && !!body.token && body.user?.role === 'sales',
        detail: `角色: ${body.user?.role}, 显示名: ${body.user?.displayName}`,
      }
    },
  },
  {
    id: 'T4',
    name: '渠道登录 (partner1/partner123)',
    fn: async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'partner1', password: 'partner123' }),
      })
      const body = await res.json()
      return {
        passed: res.ok && !!body.token && body.user?.role === 'partner',
        detail: `角色: ${body.user?.role}, 显示名: ${body.user?.displayName}`,
      }
    },
  },
  {
    id: 'T5',
    name: '登录失败 — 错误密码',
    fn: async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong-password' }),
      })
      const body = await res.json()
      return {
        passed: res.status === 401 && !!body.error,
        detail: `状态码: ${res.status}, 错误: ${body.error}`,
      }
    },
  },
  {
    id: 'T6',
    name: '获取用户列表（管理员 token）',
    fn: async () => {
      if (!globalThis.adminToken) {
        return { passed: false, detail: '无管理员 token，请先执行 T2' }
      }
      const res = await fetch(`${BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${globalThis.adminToken}` },
      })
      const body = await res.json()
      return {
        passed: res.ok && Array.isArray(body.data) && body.data.length >= 4,
        detail: `用户数: ${body.data?.length}`,
      }
    },
  },
  {
    id: 'T7',
    name: '前端 Vite 代理验证（/api → 后端）',
    fn: async () => {
      try {
        // 通过前端代理访问后端 API
        const res = await fetch(`${FRONTEND_URL}/api/health`, {
          signal: AbortSignal.timeout(3000),
        })
        return {
          passed: res.ok,
          detail: `Vite 代理正常，状态码: ${res.status}`,
        }
      } catch (err) {
        return {
          passed: false,
          detail: `Vite 代理不可达: ${err.message}。请确认前端服务已启动（cd demo-frontend && bun run dev）`,
        }
      }
    },
  },
]

// ─── 执行逻辑 ──────────────────────────────────────────────────────────

async function runTests(args) {
  const ciMode = args.includes('--ci')
  const results = []

  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  端到端冒烟测试')
  console.log('═══════════════════════════════════════════')
  console.log('')
  console.log(`  后端:  ${BASE_URL}`)
  console.log(`  前端:  ${FRONTEND_URL}`)
  console.log('')

  let passed = 0
  let failed = 0

  for (const test of TESTS) {
    process.stdout.write(`  [${test.id}] ${test.name}... `)

    try {
      const result = await test.fn()
      results.push({ id: test.id, name: test.name, ...result })

      if (result.passed) {
        console.log('✅')
        if (!ciMode) console.log(`       ${result.detail}`)
        passed++
      } else {
        console.log('❌')
        console.log(`       ${result.detail}`)
        failed++
      }
    } catch (err) {
      console.log('❌')
      console.log(`       异常: ${err.message}`)
      results.push({ id: test.id, name: test.name, passed: false, detail: err.message })
      failed++
    }
  }

  // 汇总
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log(`  结果: ${passed}/${TESTS.length} 通过, ${failed}/${TESTS.length} 失败`)
  console.log('')

  if (failed === 0) {
    console.log('  ✅ 冒烟测试全部通过！可进行人工验收或运行完整 E2E 测试:')
    console.log('     bunx playwright test')
    console.log('')
    process.exit(0)
  } else {
    console.log('  ❌ 冒烟测试未通过！请按以下步骤排查:')
    console.log('')
    console.log('  1. 确认 seed 数据已初始化:')
    console.log('     bun run templates/e2e/seed.ts')
    console.log('')
    console.log('  2. 确认后端服务已启动:')
    console.log('     bun run templates/e2e/start-server.ts')
    console.log('')
    console.log('  3. 确认前端服务已启动:')
    console.log('     cd demo-frontend && bun run dev')
    console.log('')
    console.log('  4. 完整环境检查:')
    console.log('     node scripts/check-e2e-env.js')
    console.log('')
    process.exit(1)
  }
}

runTests(process.argv.slice(2)).catch(err => {
  console.error(`❌ 冒烟测试异常: ${err.message}`)
  process.exit(2)
})
