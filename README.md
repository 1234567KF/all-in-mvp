# QoderMVP — 多 Agent 并行 MVP 开发流水线

> 26 个技能 + 18 个子 Agent + ultra-cost-effective 极致节能引擎，**Qoder CLI 单平台**。
> 从需求到交付全流程自动化，一行命令安装。

**运行前提**：Windows PowerShell 5.1+（门禁脚本为 `.ps1`，需 `-ExecutionPolicy Bypass`）、Git。
技能、子 Agent、hooks、规则**均不依赖 Node.js**；只有可选的 Token 监控脚本需要 Node（见下文）。

---

## 安装

**方式一（需 Node.js）— Windows PowerShell：**
```powershell
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
```

**方式一（需 Node.js）— macOS / Linux / WSL：**
```bash
npx giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
```

**方式二（无需 Node.js，只要 Git）：**
```bash
git clone --depth 1 --branch all-in-mvp https://github.com/1234567KF/all-in-mvp.git /tmp/all-in-mvp
cp -r /tmp/all-in-mvp/.qoder ./          # 核心产物就是这一个目录
```

> 在当前项目根目录执行。`.qoder/skills/` 出现在项目中，重启 Qoder 即可。

---

## 安装后你得到什么

```
.qoder/                     ← 全部核心产物（复制到你的项目根目录即可）
├── skills/                 ← 技能 26 个（含主技能 all-in-mvp）
│   ├── all-in-mvp/         ← 主技能：多 Agent 并行流水线
│   ├── kf-mvp-*/           ← 阶段专项技能
│   └── references/         ← 按需加载的规则/手册（不进上下文）
├── agents/                 ← 子 Agent 18 个（mvp-*，流水线角色）
├── rules/                  ← 自动加载的行为规则（质量门禁 / 节能索引）
├── scripts/                ← 门禁脚本 9 个 .ps1（含 PostToolUse hook）
├── gate-rules.yaml         ← 规则单一真源（R001–R021）
├── PLAYBOOK.md             ← 血案库（B001–B020）
└── settings.json           ← 项目配置（模型 + hooks 门禁）

ultra-cost-effective/       ← 极致节能引擎 v2.0（可选，需 Node.js）
├── helpers/                ← Token 监控 / 成本追踪 .cjs 脚本
├── rules/                  ← 节能规则正文（由 .qoder/rules/ultra-cost-effective.md 按需索引）
└── adapters/qoder/         ← Qoder 适配器（参考模板）

starters/                   ← 前端脚手架模板
└── liquid-glass-frontend/  ← React 19 + Vite + react-router 7 + Liquid Glass 设计系统
```

---

## 技能清单

| Stage | 技能 | 说明 |
|-------|------|------|
| **核心** | all-in-mvp, kf-pipeline-coordinator, grill-with-docs | 流水线编排 + 交叉审查 |
| **Stage1 需求** | kf-mvp-prd-generator, kf-mvp-arch-expert, kf-mvp-biz-expert | 需求 → 架构 → 模块划分 |
| **Stage2 规划** | kf-mvp-api-contract, kf-mvp-schema-design, kf-mvp-mock-service, kf-mvp-test-single, kf-mvp-test-e2e, kf-mvp-test-review, kf-mvp-testing-strategy, kf-mvp-playwright-infra | 契约 + Mock + 测试设计 |
| **Stage3 开发** | kf-mvp-backend-tdd, kf-mvp-frontend-dev, kf-mvp-code-review, kf-mvp-vue-components, kf-mvp-auth-implementation | TDD 开发 + 审查 |
| **Stage4 集成** | kf-mvp-stage4-coordinator, kf-mvp-security, kf-mvp-performance, kf-mvp-error-handling | 联调 + 安全 + 性能 |
| **辅助** | kf-mvp-retrospective, kf-skill-design-expert, kf-web-search | 复盘 + 技能设计 + 检索 |

### 子 Agent（18 个，`.qoder/agents/`）

流水线角色由主 Agent 用 `Agent` 工具派发：

| Stage | 子 Agent |
|-------|----------|
| 1 | mvp-pm-agent |
| 2 | mvp-architect, mvp-domain-expert, mvp-grill-review, mvp-mock-service, mvp-single-module-test, mvp-scenario-test, mvp-test-writer, mvp-test-review |
| 3 | mvp-pipeline-coordinator, mvp-backend-tdd, mvp-frontend-dev, mvp-code-reviewer |
| 4 | mvp-stage4-coordinator, mvp-debug-fixer, mvp-verifier |
| 全程 / 5 | mvp-pipeline-monitor（只读状态报告）, mvp-retrospective-agent |

### 质量门禁如何生效

1. **Stage 入口**：`powershell -NoProfile -ExecutionPolicy Bypass -File .qoder/scripts/check-stage3-gate.ps1`（Stage4 同理）
2. **随手改代码**：`settings.json` → `hooks.PostToolUse` → `quality-gate-hook.ps1`，命中 `src/**`、路由/服务层、共享 UI 路径时，向 Agent 注入"必须审查/契约校验/冒烟"指令
3. **行为约束**：`.qoder/rules/quality-gate.md`（每次会话自动加载）

### 极致节能引擎（可选，需 Node.js）

| 模块 | 说明 |
|------|------|
| `project-monitor.cjs` | 七层架构项目级全链路 Token 监控（A2A穿透 + 子Agent + 理论节约） |
| `token-watcher.cjs` | 会话级 JSONL 实时 Token 统计 |
| `agent-spawn-guard.cjs` | Agent spawn 前置拦截，注入压缩上下文 |
| `perf-tracker.cjs` | 全链路成本追踪（会话/任务/项目三级） |

> 未安装 Node.js 时这四项不可用；节能规则中**纯行为约束**部分仍然有效（见 `.qoder/rules/ultra-cost-effective.md` 的可用性表）。

---

## 维护者工作流

```bash
# 直接编辑 .qoder/skills/ 下的技能
vim .qoder/skills/all-in-mvp/SKILL.md

# 提交
git add .qoder/skills/
git commit -m "feat: 更新技能"
git push origin all-in-mvp

# 打 tag 发布新版本
git tag v2.10.0
git push origin all-in-mvp --tags
```

用户通过 tag 锁定版本：
```bash
npx.cmd giget gh:1234567KF/all-in-mvp#v2.10.0 .
```

---

## 常见问题

### Q: giget 拉取后有哪些目录？

A: `.gitattributes` 的 `export-ignore` 规则让 GitHub tarball 自动排除文档/白皮书等文件，只保留 `.qoder/skills/`、`ultra-cost-effective/`、`starters/`。完整源码在 [GitHub 仓库](https://github.com/1234567KF/all-in-mvp)。

### Q: 技能是全局的还是项目级的？

A: **项目级**。技能在 `.qoder/skills/`，Qoder 自动识别且优先级高于全局。每个项目独立拥有，互不影响。

### Q: 为什么 giget URL 需要 `#all-in-mvp`？

A: 仓库默认分支是 `all-in-mvp`（非 `main`），giget 默认拉取 `main` 会导致 404。`#all-in-mvp` 显式指定分支。

### Q: Windows PowerShell 运行 `npx giget` 报错？

A: 用 `npx.cmd` 替代 `npx`：
```powershell
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp .
```

### Q: 如何查看 Token 消耗？

A: 需要安装 Node.js，然后运行项目级监控：
```bash
node ultra-cost-effective/helpers/project-monitor.cjs
```
没有 Node 时改用 Qoder 自身的 `/context` / `/cost` 视图；节能规则仍可手动遵循（`.qoder/rules/ultra-cost-effective.md`）。

### Q: 门禁脚本报"在此系统上禁止运行脚本"？

A: 这是 PowerShell 执行策略，不是框架 bug。始终用完整形式调用：
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .qoder/scripts/check-stage3-gate.ps1
```

### Q: 质量门禁 hook 什么时候开始生效？

A: `settings.json` 的 `hooks` 在会话启动时读取，**改完需重启 Qoder**。生效后可故意编辑 `src/` 下任一 `.ts` 文件验证：应看到 `[QUALITY-GATE]` 提示要求派发审查子 Agent。

### Q: `model.name` 填什么？

A: 模板默认 `deepseek-v4-flash`。可用模型由你的账号决定（Qoder 内用 `/model` 查看/切换）；若列表里没有该模型，删掉 `model` 块即可走默认路由。Qoder 会忽略无法识别的配置键。

---

## 许可证

MIT
