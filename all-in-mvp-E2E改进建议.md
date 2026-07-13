# all-in-mvp 技能修改建议 — E2E测试与人工验收环境隔离

## 问题描述

当前 all-in-mvp 流水线在 Stage 3.5（E2E测试）和 Stage 4（人工验收）之间存在**环境配置断层**，导致以下问题：

1. **E2E测试使用内存数据库**：每个测试文件独立运行，数据互不干扰，测试通过不代表真实环境可运行
2. **人工验收需要真实服务**：需要文件数据库（`wecrm.db`）+ seed 数据 + 正确的代理配置
3. **这些步骤在流水线中没有自动化**：需要手动发现和修复

## 根本原因分析

### 1. E2E 测试架构

```
E2E测试（Playwright）
  ├── 调用 API（通过 request 对象）
  ├── 后端使用 getTestDb() → :memory:（内存数据库）
  ├── 每个测试文件独立运行
  └── 测试数据由 test.beforeAll / test.beforeEach 创建
```

**优点**：测试隔离性好，无脏数据问题
**缺点**：与真实运行环境完全脱节

### 2. 人工验收架构

```
浏览器 → 前端(Vite) → 代理(/api) → 后端(Hono) → 文件数据库(wecrm.db)
```

**需要**：
- 文件数据库已创建
- seed 数据已插入
- Vite proxy 配置正确（含 rewrite）
- 后端服务正确启动（Node.js 24 需 duplex: 'half'）

## 修改建议

### 建议一：E2E 测试增加"真实环境验证"步骤

在 `playwright.config.ts` 的 `webServer` 配置中，启动真实后端服务（使用文件数据库），而非让 E2E 测试直接调用内存数据库。

**当前问题**：
```typescript
// e2e/modules/auth.spec.ts
// 直接调用 API，后端使用内存数据库
test('POST /auth/login', async ({ request }) => {
  const response = await request.post('/api/auth/login', {...})
})
```

**建议修改**：
1. E2E 测试启动前，先运行 seed 脚本到文件数据库
2. E2E 测试通过 Vite 代理访问 API（与人工验收一致）
3. 或者 E2E 测试直接启动后端服务（文件数据库模式）

### 建议二：Stage 4 增加"环境初始化检查清单"

在 STAGE4-INTEGRATION-REPORT.md 中增加以下检查项：

```markdown
## Stage 4 前置检查

- [ ] 文件数据库已创建（wecrm.db）
- [ ] Seed 数据已插入（角色 + 测试用户）
- [ ] 后端服务可启动（验证 duplex: 'half'）
- [ ] 前端代理配置正确（含 rewrite）
- [ ] 登录接口可访问（curl 验证）
```

### 建议三：增加 seed 脚本作为流水线标准产物

在 Stage 2（架构设计）阶段就定义 seed 脚本：

```
stage2/
  ├── spec.md
  ├── schema.sql
  ├── api-contract.yaml
  ├── seed.ts          ← 新增：标准测试数据
  └── start-server.ts  ← 新增：启动脚本
```

### 建议四：Vite 代理配置纳入前端脚手架模板

当前 starters/liquid-glass-frontend 的 vite.config.ts 没有代理配置。应在模板中就包含：

```typescript
// vite.config.ts 模板
export default defineConfig({
  // ...
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

### 建议五：Node.js 24 兼容性检查

在 Stage 3 后端开发阶段，增加启动脚本验证：

```typescript
// start-server.ts 应作为标准产物
// 关键：Node.js 24 需要 duplex: 'half'
if (req.method !== "GET" && req.method !== "HEAD") {
  (init as any).duplex = "half";
  (init as any).body = req;
}
```

## 具体修改点

### 1. 修改 `playwright.config.ts`（E2E 配置）

```typescript
// 启动真实后端服务（文件数据库）
webServer: [
  {
    command: 'cd apps/server && npx tsx start-server.ts',
    url: 'http://localhost:3001/health',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  {
    command: 'cd apps/web && npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
],
```

### 2. 修改 `seed.ts`（数据初始化）

作为 Stage 2 标准产物，在 Stage 3 开始前锁定。

### 3. 修改 `start-server.ts`（启动脚本）

作为 Stage 2 标准产物，处理 Node.js 24 兼容性。

### 4. 修改验收报告模板

增加"环境初始化验证"章节，明确区分：
- 单元测试通过（内存数据库）
- E2E 测试通过（文件数据库 + 真实服务）
- 人工验收通过（浏览器端到端）

## 总结

当前问题不是 E2E 测试本身有缺陷，而是**流水线缺少"真实环境验证"环节**。E2E 测试在内存数据库中运行是正确的设计（隔离性好），但需要在 Stage 4 之前增加：

1. **文件数据库初始化**（seed 脚本）
2. **服务启动验证**（start-server.ts + proxy 配置）
3. **端到端冒烟测试**（curl 验证登录接口）

这样才能确保从"测试通过"到"可人工验收"的平滑过渡。
