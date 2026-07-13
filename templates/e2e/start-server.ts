/**
 * 后端服务启动脚本 — Stage 2 标准产物
 *
 * 用于 E2E 测试和人工验收时启动后端服务（使用文件数据库）。
 * 区别于开发模式（内存数据库），此脚本使用 wecrm.db 文件数据库。
 *
 * 使用方式:
 *   npx tsx templates/e2e/start-server.ts
 *
 * 关键兼容性:
 *   - Node.js 24+: 需要 duplex: 'half'（否则 POST/PUT 请求报错）
 *   - 端口: 默认 3000（可通过 PORT 环境变量覆盖）
 *   - 数据库: wecrm.db（需先运行 seed.ts）
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import Database from 'better-sqlite3'
import { resolve } from 'node:path'

// ─── 配置 ──────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10)
// 支持 DB_PATH 环境变量（方便 E2E 测试隔离，如: DB_PATH=test-e2e.db）
const DB_PATH = process.env.DB_PATH
  ? resolve(process.cwd(), process.env.DB_PATH)
  : resolve(process.cwd(), 'wecrm.db')

// ─── 数据库初始化 ──────────────────────────────────────────────────────

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

// ─── 应用初始化 ────────────────────────────────────────────────────────

const app = new Hono()

// 中间件
app.use('*', cors())
app.use('*', logger())

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', db: DB_PATH, timestamp: new Date().toISOString() })
})

// ─── 认证接口 ──────────────────────────────────────────────────────────

app.post('/auth/login', async (c) => {
  const { username, password } = await c.req.json()

  if (!username || !password) {
    return c.json({ error: '用户名和密码不能为空' }, 400)
  }

  const user = db.prepare(
    'SELECT id, username, role, display_name, status FROM users WHERE username = ? AND password = ?'
  ).get(username, password) as any

  if (!user) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }

  if (user.status !== 'active') {
    return c.json({ error: '账户已被禁用' }, 403)
  }

  return c.json({
    token: `mock-token-${user.id}-${Date.now()}`,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
    },
  })
})

// ─── 用户接口 ──────────────────────────────────────────────────────────

app.get('/users', (c) => {
  const users = db.prepare(
    'SELECT id, username, role, display_name, status, created_at FROM users ORDER BY id'
  ).all()
  return c.json({ data: users })
})

// ─── 启动 ──────────────────────────────────────────────────────────────

// Node.js 24+ 兼容: 处理 duplex: 'half'
const server = Bun
  ? Bun.serve({ fetch: app.fetch, port: PORT })
  : null

if (!server) {
  // 使用 Node.js 原生 HTTP（Node.js 24 需要 duplex: 'half'）
  import('node:http').then((http) => {
    const nodeServer = http.createServer(
      {
        // Node.js 24+: 必须显式设置 duplex 以支持流式请求体
        IncomingMessage: http.IncomingMessage,
        ServerResponse: http.ServerResponse,
      } as any,
      async (req, res) => {
        // Node.js 24 兼容: 为 POST/PUT/PATCH 请求设置 duplex
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          try {
            // 读取请求体
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(Buffer.from(chunk))
            }
            const body = Buffer.concat(chunks).toString()

            // 构造 fetch Request
            const url = `http://localhost:${PORT}${req.url}`
            const fetchReq = new Request(url, {
              method: req.method,
              headers: Object.fromEntries(
                Object.entries(req.headers).filter(([k]) => k) as [string, string][]
              ),
              body: body || undefined,
            })

            const fetchRes = await app.fetch(fetchReq)
            res.writeHead(fetchRes.status, Object.fromEntries(fetchRes.headers.entries()))
            const resBody = await fetchRes.text()
            res.end(resBody)
          } catch (err) {
            console.error('Request error:', err)
            res.writeHead(500)
            res.end(JSON.stringify({ error: 'Internal Server Error' }))
          }
        } else {
          // GET/HEAD 请求不需要 body 处理
          const url = `http://localhost:${PORT}${req.url}`
          const fetchReq = new Request(url, {
            method: req.method,
            headers: Object.fromEntries(
              Object.entries(req.headers).filter(([k]) => k) as [string, string][]
            ),
          })

          const fetchRes = await app.fetch(fetchReq)
          res.writeHead(fetchRes.status, Object.fromEntries(fetchRes.headers.entries()))
          const resBody = await fetchRes.text()
          res.end(resBody)
        }
      }
    )

    nodeServer.listen(PORT, () => {
      console.log('')
      console.log('═══════════════════════════════════════════')
      console.log('  后端服务已启动')
      console.log('═══════════════════════════════════════════')
      console.log('')
      console.log(`  地址:     http://localhost:${PORT}`)
      console.log(`  数据库:   ${DB_PATH}`)
      console.log(`  健康检查: http://localhost:${PORT}/health`)
      console.log('')
      console.log('  按 Ctrl+C 停止服务')
      console.log('')
    })
  })
} else {
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  后端服务已启动 (Bun)')
  console.log('═══════════════════════════════════════════')
  console.log('')
  console.log(`  地址:     http://localhost:${PORT}`)
  console.log(`  数据库:   ${DB_PATH}`)
  console.log('')
}
