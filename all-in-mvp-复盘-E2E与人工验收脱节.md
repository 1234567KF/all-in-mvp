# all-in-mvp 复盘：E2E全量通过但人工验收仍出问题的根因与对策

> 背景：微点CRM MVP 流水线 Stage1→Stage4 全流程完成，后端 326 tests、E2E 92/92 pass。
> 但人工启动系统后，"管理员快捷登录"立即报密码错误。

---

## 一、出问题的场景

| 环节 | 测试结果 | 实际情况 |
|------|---------|---------|
| 后端单元/集成测试 (bun test) | 326 pass / 0 fail | ✅ 只测路由逻辑，不测种子数据完整性 |
| E2E 测试 (bunx playwright) | 92 pass / 92 total | ✅ 但运行在 Mock 服务器上，非真实后端 |
| 人工打开前端→快捷登录 | ❌ "手机号或密码错误" | 真实 SQLite 后端只有 1 个管理员，不是快捷按钮填的那个 |

**核心悖论**：测试全绿 ≠ 系统可用。问题出在**测试环境与人工验收环境不是同一个后端**。

---

## 二、根因分析

### 根因 1：E2E 跑了 Mock，人工验收跑了真实后端

```
E2E 测试链路：
  playwright → http://localhost:5173 (Vite) → /api → http://localhost:3000
                                                            ↓
                                                    mock-launcher.ts
                                                            ↓
                                                    mock-server.ts (内存 Mock)
                                                    - 7 个测试账号（明文密码）
                                                    - 不校验 bcrypt
                                                    - 无 SQLite
                                                    - 重启即重置

人工验收链路：
  浏览器 → http://localhost:5177 (Vite) → /api → http://localhost:3000
                                                        ↓
                                                index.ts (真实 Hono 后端)
                                                        ↓
                                                db.ts → SQLite (data/sqlite.db)
                                                - 只有 1 个账号 (13800000000/admin123)
                                                - bcrypt 密码校验
                                                - 惰性种子（首次 API 请求才初始化）
```

Mock 服务器有 7 个账号（mock-data.ts 的 `users` 数组），真实 SQLite 只有 1 个（db.ts 的种子代码只插了 `13800000000`）。两套后端**完全独立，数据不同步**。

**关键教训**：E2E 测试不能只跑 Mock。必须有一套 E2E 用例跑在真实后端上（哪怕是同一个 spec 文件、通过环境变量切换）。

### 根因 2：种子数据有两份，没有同步机制

| 种子位置 | 账号数 | 密码格式 | 用途 |
|----------|--------|----------|------|
| `apps/api/src/mock/mock-data.ts` | 7 个 | 明文 hash_pwd_xxx | Mock 服务器 |
| `apps/api/src/db.ts` (种子函数) | 1 个 | bcrypt | 真实 SQLite |

两处种子数据**没有关联**。修改 Mock 数据不会触发真实种子同步。

**关键教训**：种子数据只能有**一份权威来源**。Mock 和真实后端必须从同一份种子定义生成。

### 根因 3：端口使用默认值，没有执行技能规范

- **模板设计**（templates/e2e/）：后端 3333，前端 5555
- **实际实现**：后端 3000，前端 5173
- **用户要求**：使用 2222 / 3333

端口没有按模板规范执行的原因：
1. `apps/api/src/env.ts` 直接硬编码 `PORT || "3000"`
2. `apps/web/vite.config.ts` 硬编码 `target: "http://localhost:3000"`
3. E2E mock-launcher.ts 硬编码 `E2E_MOCK_PORT || '3000'`
4. 用户要求（2222/3333）存在于口头约定，但从未写入 all-in-mvp 技能文件

**后果**：5173-5176 都被旧进程占用，每次启动端口漂移。

---

## 三、系统性修复方案

### 修复 1：E2E 双模式运行（强制门禁）

Stage4 验收前，E2E 必须跑**两遍**：

```
模式 A：Mock 模式（已有，保持不变）
  用途：开发阶段快速反馈、CI 预检
  命令：bunx playwright test

模式 B：Real 模式（新增，Stage4 门禁）
  用途：人工验收前的最终验证
  命令：E2E_MODE=real bunx playwright test --config tests/e2e/playwright.real.config.ts
  原理：不再启动 mock-launcher，而是启动真实后端（bun run dev），
        让 E2E 请求走真实 SQLite + bcrypt + JWT 全链路。
```

**实现要点**：
- 新增 `tests/e2e/playwright.real.config.ts`，webServer 改成真实后端
- global-setup 改为调用 seed API（而非 mock 直写内存）
- real 模式用例可以精简（只覆盖核心登录+CRUD链路），不追求全量

### 修复 2：种子数据单一来源

**方案**：将 mock-data.ts 的账号/渠道数据提取为独立文件 `seeds/accounts.ts` + `seeds/channels.ts`，同时被 mock-data.ts 和 db.ts 引用。

```
seeds/
  accounts.ts    ← 权威种子账号定义（export const SEED_ACCOUNTS = [...]）
  channels.ts    ← 权威种子渠道定义
  index.ts       ← re-export

apps/api/src/mock/mock-data.ts
  → import { SEED_ACCOUNTS } from '@/seeds'
  → Mock 模式直接使用明文 hash

apps/api/src/db.ts
  → import { SEED_ACCOUNTS } from '@/seeds'
  → 真实模式用 Bun.password.hashSync() 批量生成 bcrypt hash
```

**效果**：修改一处种子数据，Mock 和真实后端自动同步。

### 修复 3：端口统一配置化

在项目根目录创建 `.env` 文件作为**唯一端口配置源**：

```bash
# .env
API_PORT=2222
WEB_PORT=3333
FRONTEND_URL=http://localhost:3333
```

修改以下文件从 `.env` 读取：

| 文件 | 改动 |
|------|------|
| `apps/api/src/env.ts` | `PORT` 改为 `process.env.API_PORT \|\| "2222"` |
| `apps/web/vite.config.ts` | proxy target 改为 `` `http://localhost:${API_PORT}` `` |
| `tests/e2e/mock-launcher.ts` | 端口改为 `E2E_MOCK_PORT \|\| API_PORT` |
| `tests/e2e/playwright.config.ts` | baseURL + webServer url 从常量提取 |

### 修复 4：Stage4 增加"冷启动验收"步骤

在 all-in-mvp Stage4 流程中强制增加以下步骤（不依赖 E2E 测试结果）：

```
Stage4 冷启动验收清单（Agent 必须逐项执行并记录）:
□ 1. 删除 data/sqlite.db（模拟全新部署）
□ 2. 启动后端，确认种子日志输出正确的账号数量
□ 3. 启动前端，确认端口与配置一致（无漂移）
□ 4. 用前端登录页快捷按钮逐一登录 admin/sales/channel
□ 5. 确认三个角色登录后跳转到正确页面
□ 6. 确认 disabled 账号登录被拒绝
□ 7. 确认 forceChangePwd 账号弹出改密页
```

---

## 四、all-in-mvp 技能修改建议

在 all-in-mvp SKILL.md 中增加以下强制规则：

### 新增规则：端口隔离

```markdown
## 端口规范（强制）

所有 MVP 项目必须使用非标准端口，避免与本地其他项目冲突：

| 服务 | 端口 | 环境变量 |
|------|------|----------|
| 后端 API | 2222 | API_PORT |
| 前端 Web | 3333 | WEB_PORT |

Stage2 架构设计时必须将端口写入 `.env`，后续所有配置文件从 `.env` 读取。
```

### 新增规则：E2E 双模验收

```markdown
## E2E 双模验收门禁（强制）

Stage4 集成验收前，E2E 测试必须执行两轮：

1. **Mock 模式**：`bunx playwright test`（开发阶段已有）
2. **Real 模式**：`E2E_MODE=real bunx playwright test`（Stage4 新增门禁）

Real 模式 E2E 至少覆盖：
- 三个角色登录成功
- 禁用账号登录被拒
- 核心 CRUD 链路（管理员审核+销售跟进+渠道报备）

两轮全部通过才能标记 Stage4 完成。
```

### 新增规则：种子数据权威来源

```markdown
## 种子数据管理（强制）

- 测试账号/渠道等种子数据必须存放在独立的 `seeds/` 目录
- Mock 数据和真实数据库种子必须引用同一份种子定义
- 修改种子后必须同步更新 docs/用户手册.md 的测试账号表
- db.ts 种子函数内账号数量必须与登录页快捷按钮数量一致
```

---

## 五、总结

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 1 | E2E 全过但人工登录失败 | E2E 跑 Mock，人工跑真实后端，种子数据不同 | E2E 双模式 + 种子单一来源 |
| 2 | 端口漂移 (5177) | 未执行模板/用户指定的 2222/3333 端口规范 | .env 统一配置 + 技能文件明确写入 |
| 3 | 快捷登录按钮失效 | 种子数据未覆盖前端 TEST_ACCOUNTS 列表 | 种子=权威来源，强制对齐 |
| 4 | 缺少冷启动验证 | Stage4 流程没有"删库→重启→人工验收"步骤 | Stage4 增加冷启动清单 |

**一句话复盘**：测试环境和验收环境不是同一套后端，是 E2E 全绿但一跑就挂的万恶之源。
