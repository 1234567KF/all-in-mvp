# all-in-mvp — Qoder MVP 开发流水线

> 42 个技能 + ultra-cost-effective 极致节能引擎，Qoder 专属。
> 多 Agent 并行开发，从需求到交付全流程自动化。

---

## 安装

### 自动安装

将此 README 发给你的 Qoder Agent，说：

> **"安装 all-in-mvp 技能"**

### 手动安装

```powershell
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
```

> 在当前项目根目录执行。`.qoder/skills/` 出现在项目中，重启 Qoder 即可。

---

## 架构

```
.qoder/
├── skills/               ← Qoder 技能（43 个）
│   ├── all-in-mvp/       ← 主技能：多 Agent 并行流水线
│   ├── kf-mvp-*/         ← 阶段专项技能
│   └── ...
└── settings.json         ← Qoder 项目配置（模型/规则/环境变量）

ultra-cost-effective/     ← 极致节能引擎 v2.0
├── helpers/
│   ├── project-monitor.cjs  ← 项目级全链路 Token 监控
│   ├── token-watcher.cjs    ← 会话级 JSONL 扫描
│   └── perf/                ← 成本追踪 + 定价数据
├── rules/                   ← LLM 行为规则
└── adapters/qoder/          ← Qoder 专用适配器
```

---

## 技能清单

| Stage | 技能 | 说明 |
|-------|------|------|
| **核心** | all-in-mvp, kf-pipeline-coordinator, grill-with-docs | 流水线调度 + 交叉审查 |
| **Stage1** | kf-mvp-product-manager, kf-mvp-prd-generator, kf-mvp-arch-expert, kf-mvp-biz-expert, kf-mvp-spec-generator, kf-mvp-task-splitter | 需求 → 架构 → 任务拆分 |
| **Stage2** | kf-mvp-api-contract, kf-mvp-schema-design, kf-mvp-mock-service, kf-mvp-test-single, kf-mvp-test-e2e, kf-mvp-test-review, kf-mvp-testing-strategy | API 契约 + 测试设计 |
| **Stage3** | kf-mvp-backend-tdd, kf-mvp-frontend-dev, kf-mvp-code-review, kf-mvp-debug, kf-mvp-tdd-helper, kf-mvp-vue-components, kf-mvp-auth-implementation | TDD 开发 + 代码审查 |
| **Stage4** | kf-mvp-integration, kf-mvp-stage4-coordinator, kf-mvp-devops, kf-mvp-security, kf-mvp-health-check, kf-mvp-data-migration, kf-mvp-monitoring, kf-mvp-performance | 集成 + 部署 + 验证 |
| **辅助** | kf-mvp-error-handling, kf-mvp-refactoring, kf-mvp-caching, kf-mvp-api-doc, kf-mvp-api-versioning, kf-mvp-onboarding, kf-mvp-cli, kf-web-search, kf-skill-design-expert | 质量保障 + 工具 |

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
```

---

## 许可证

MIT
# all-in-skills — 跨平台 Agent 技能库

> 39 个 MVP 开发技能，一次维护，三平台自动同步。
> Claude Code / Qoder / Trae 通用。

---

## 安装

### 自动安装（推荐）

将此 README 发给你的 AI Agent，说：

> **"安装 all-in-skills 技能库"**

Agent 会自动执行以下安装步骤。

### 手动安装

根据你的平台，执行对应命令：

**Claude Code**
```bash
cp -r .claude/skills/* ~/path/to/project/.claude/skills/
```

**Qoder**
```bash
cp -r .qoder/skills/* ~/path/to/project/.qoder/skills/
```

**Trae**
```bash
cp -r .trae/skills/* ~/path/to/project/.trae/skills/
```

### 更新

```bash
git pull
# 然后重新执行上面的安装命令
```

---

## 安装指令（Agent 专用）

> 以下是给 AI Agent 阅读的精确安装指令。Agent 读取后应直接执行，无需询问用户。

```
TASK: Install all-in-skills to the current project.

STEP 1 — Detect platform:
  检测当前运行的 Agent 平台:
    - 如果当前是 Claude Code → platform = "claude-code"
    - 如果当前是 Qoder → platform = "qoder"
    - 如果当前是 Trae → platform = "trae"
    - 如果无法检测 → 询问用户使用哪个平台

STEP 2 — Copy skills:
  - claude-code: 复制 .claude/skills/ 下所有目录 到 项目根目录的 .claude/skills/
  - qoder: 复制 .qoder/skills/ 下所有目录 到 项目根目录的 .qoder/skills/
  - trae: 复制 .trae/skills/ 下所有目录 到 项目根目录的 .trae/skills/

STEP 3 — Verify:
  - 确认目标目录下存在多个以 kf-mvp- 开头的子目录
  - 确认每个子目录内有 SKILL.md 文件
  - 输出安装成功的技能数量和平台信息
```

---

## 架构

```
skills/                  ← 唯一源码（你只改这里）
overlays/                ← 平台差异覆盖（只写差异）
  qoder/                 ← Qoder 特定内容
  claude-code/           ← Claude Code 特定内容
  trae/                  ← Trae 特定内容
tools/generate.sh        ← 生成脚本（维护者运行，跨平台 Bash）
tools/generate.ps1       ← 生成脚本（PowerShell 备用）
.qoder/skills/          ← 生成产物（Qoder 用户直接复制）
.claude/skills/          ← 生成产物（Claude Code 用户直接复制）
.trae/skills/            ← 生成产物（Trae 用户直接复制）
```

## 维护者工作流

```bash
# 1. 编辑 skills/ 下的技能
# 2. 运行生成脚本
bash tools/generate.sh
# 3. 提交
git add .qoder/skills/ .claude/skills/ .trae/skills/
git commit -m "feat: 更新技能 xxx"
```

## 扩展平台差异

当某个技能需要针对特定平台有不同的实现：

```bash
# 在 overlays 下创建对应目录和文件
mkdir -p overlays/claude-code/技能名/
# 创建 SKILL.md，写入 Claude Code 特定的指令
# 生成脚本会自动优先使用覆盖层文件
bash tools/generate.sh
```

## 技能清单

| Stage | 技能 | 模式 |
|-------|------|------|
| Stage1 需求 | kf-mvp-product-manager, kf-mvp-prd-generator | Inversion, Generator |
| Stage2 计划 | kf-mvp-arch-expert, kf-mvp-spec-generator, kf-mvp-biz-expert, kf-mvp-task-splitter, kf-pipeline-coordinator, grill-with-docs, kf-mvp-api-contract, kf-mvp-schema-design, kf-mvp-api-versioning, kf-mvp-mock-service, kf-mvp-test-single, kf-mvp-test-e2e, kf-mvp-testing-strategy | Pipeline, Generator, Reviewer |
| Stage3 执行 | kf-mvp-backend-tdd, kf-mvp-frontend-dev, kf-mvp-code-review, kf-mvp-debug, kf-mvp-tdd-helper, kf-mvp-error-handling, kf-mvp-vue-components, kf-mvp-auth-implementation, kf-mvp-refactoring, kf-mvp-architecture, kf-mvp-api-doc, kf-mvp-caching, kf-mvp-cli | Pipeline, Reviewer, Tool Wrapper |
| Stage4 集成 | kf-mvp-integration, kf-mvp-devops, kf-mvp-security, kf-mvp-health-check, kf-mvp-data-migration, kf-mvp-monitoring, kf-mvp-performance, kf-mvp-onboarding | Pipeline, Reviewer |
| 元技能 | all-in-mvp, kf-skill-design-expert, kf-web-search, kf-mvp-api-contract | Pipeline, Generator |

---

## 许可证

MIT
