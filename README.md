# QoderMVP — 多 Agent 并行 MVP 开发流水线

> 43 个技能 + ultra-cost-effective 极致节能引擎，Qoder 专属。
> 从需求到交付全流程自动化，一行命令安装。

---

## 安装

**Windows PowerShell：**
```powershell
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
```

**macOS / Linux / WSL：**
```bash
npx giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
```

> 在当前项目根目录执行。`.qoder/skills/` 出现在项目中，重启 Qoder 即可。

---

## 安装后你得到什么

```
.qoder/
├── skills/                 ← Qoder 技能（43 个）
│   ├── all-in-mvp/         ← 主技能：多 Agent 并行流水线
│   ├── kf-mvp-*/           ← 阶段专项技能
│   └── ...
└── settings.json           ← Qoder 项目配置（模型/规则/环境变量）

.claude/                    ← Claude Code 配置（agents/rules/skills/hooks）
.trae/                      ← Trae 技能兼容层

ultra-cost-effective/       ← 极致节能引擎 v2.0
├── helpers/
│   ├── project-monitor.cjs ← 项目级全链路 Token 监控
│   ├── token-watcher.cjs   ← 会话级 JSONL 扫描
│   └── perf/               ← 成本追踪 + 定价数据
├── rules/                  ← LLM 行为规则
└── adapters/qoder/         ← Qoder 专用适配器

starters/                   ← 前端脚手架模板
└── liquid-glass-frontend/  ← Vue 3 + shadcn/vue + Liquid Glass，npm install 即用
```

---

## 技能清单

| Stage | 技能 | 说明 |
|-------|------|------|
| **核心** | all-in-mvp, kf-pipeline-coordinator, grill-with-docs | 流水线调度 + 交叉审查 |
| **Stage1 需求** | product-manager, prd-generator, arch-expert, biz-expert, spec-generator, task-splitter | 需求 → 架构 → 任务拆分 |
| **Stage2 规划** | api-contract, schema-design, mock-service, test-single, test-e2e, test-review, testing-strategy | API 契约 + 测试设计 |
| **Stage3 开发** | backend-tdd, frontend-dev, code-review, debug, tdd-helper, vue-components, auth-implementation | TDD 开发 + 代码审查 |
| **Stage4 集成** | integration, stage4-coordinator, devops, security, health-check, data-migration, monitoring, performance | 集成 + 部署 + 验证 |
| **辅助** | error-handling, refactoring, caching, api-doc, api-versioning, onboarding, cli, web-search, skill-design-expert | 质量保障 + 工具 |

### 极致节能引擎

| 模块 | 说明 |
|------|------|
| `project-monitor.cjs` | 七层架构项目级全链路 Token 监控（A2A穿透 + 子Agent + 理论节约） |
| `token-watcher.cjs` | 会话级 JSONL 实时 Token 统计 |
| `agent-spawn-guard.cjs` | Agent spawn 前置拦截，注入压缩上下文 |
| `perf-tracker.cjs` | 全链路成本追踪（会话/任务/项目三级） |

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

A: `.gitattributes` 的 `export-ignore` 规则让 GitHub tarball 自动排除文档/白皮书等文件，只保留 `.qoder/skills/`、`.claude/`、`ultra-cost-effective/`、`starters/`。完整源码在 [GitHub 仓库](https://github.com/1234567KF/all-in-mvp)。

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

A: 运行项目级监控：
```bash
node ultra-cost-effective/helpers/project-monitor.cjs
```

---

## 许可证

MIT
