# all-in-mvp 技能安装与分发指南

一个完整的多 Agent 并行 MVP 开发流水线技能集，支持 `npx giget` 一键拉取项目模板，开箱即用。

---

## 🚀 快速开始（giget 一键拉取 — 推荐）

> **最简方式**：用 `npx giget` 把 all-in-mvp 拉到本地作为 MVP 项目模板，然后运行 install.sh 安装技能到 AI Agent。

### Step 1：拉取项目模板

```bash
# macOS / Linux / WSL
npx giget gh:1234567KF/all-in-mvp#all-in-mvp my-mvp-project --ignore "AGENTS.md,README.md,INSTALL.md,WhyMe.md,MVP*,screenshot-1-full.png,nul,all-in-mvp-*.md,shadcn/**,tools/**,overlays/**,ultra-cost-effective/**"
cd my-mvp-project

# Windows (PowerShell) — 注意用 npx.cmd 避免 npx.ps1 兼容性问题
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp my-mvp-project --ignore "AGENTS.md,README.md,INSTALL.md,WhyMe.md,MVP*,screenshot-1-full.png,nul,all-in-mvp-*.md,shadcn/**,tools/**,overlays/**,ultra-cost-effective/**"
cd my-mvp-project
```

> 💡 `npx giget` 自动去除 `.git` 目录，拿到一个干净的项目模板。`--ignore` 排除根目录下的文档/白皮书/截图等元数据文件，只保留技能、脚本和 IDE 配置等核心分发内容。**注意**：仓库默认分支为 `all-in-mvp`（非 `main`），因此 URL 必须显式指定 `#all-in-mvp`。指定 `#v2.8.0` 可锁定版本。

### Step 2：安装技能到 AI Agent

```bash
# macOS / Linux / WSL
chmod +x install.sh && ./install.sh

# Windows (PowerShell)
.\install.ps1
```

脚本会自动检测你安装的 AI Agent（Qoder / Claude Code / Gemini），并将技能安装到对应全局配置目录。

### Step 3：开始使用

```bash
# 在项目目录中启动 AI Agent
qoder    # 或 claude

# 激活技能
> 使用 all-in-mvp 创建一个 CRM 系统
```

---

### 手动安装：只安装技能到 AI Agent

如果你已有项目，只需要把技能安装到 AI Agent 全局配置目录：

| 平台 | 命令 |
|------|------|
| **所有 Agent（自动检测）** | `curl -fsSL https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.sh \| bash` |
| **Qoder** | `npx giget gh:1234567KF/all-in-mvp#all-in-mvp/skills ~/.qoder/skills --force` |
| **Claude Code** | `npx giget gh:1234567KF/all-in-mvp#all-in-mvp/skills ~/.claude/skills --force` |
| **Gemini** | `npx giget gh:1234567KF/all-in-mvp#all-in-mvp/skills ~/.gemini/config/skills --force` |
| **Windows Qoder** | `npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp/skills $env:USERPROFILE\.qoder\skills --force` |
| **Windows Claude** | `npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp/skills $env:USERPROFILE\.claude\skills --force` |

> 💡 **提示**：若技能后续有更新，只需重新运行上述对应助手的命令即可完成覆盖升级。

### 安装单个技能

```bash
# 只安装 all-in-mvp 主技能
npx giget gh:1234567KF/all-in-mvp#all-in-mvp/skills/all-in-mvp ~/.qoder/skills/all-in-mvp --force

# 只安装 Pipeline Coordinator
npx giget gh:1234567KF/all-in-mvp#all-in-mvp/skills/kf-pipeline-coordinator ~/.qoder/skills/kf-pipeline-coordinator --force
```

---

## 📦 技能清单

本技能集包含以下 42 个技能，覆盖 MVP 开发全流程：

### 核心流程技能
| 技能名称 | 说明 |
|---------|------|
| `all-in-mvp` | 主技能 - 多 Agent 并行 MVP 开发流水线 |
| `kf-pipeline-coordinator` | Pipeline 任务调度器 |
| `grill-with-docs` | 交叉审查技能 |

### 阶段 1：需求与规划
| 技能名称 | 说明 |
|---------|------|
| `kf-mvp-product-manager` | 产品经理 Agent |
| `kf-mvp-prd-generator` | PRD 生成器 |
| `kf-mvp-arch-expert` | 架构专家 |
| `kf-mvp-biz-expert` | 业务领域专家 |
| `kf-mvp-spec-generator` | 规格文档生成器 |
| `kf-mvp-task-splitter` | 任务拆分器 |

### 阶段 2：设计与测试
| 技能名称 | 说明 |
|---------|------|
| `kf-mvp-api-contract` | API 契约设计 |
| `kf-mvp-schema-design` | 数据库 Schema 设计 |
| `kf-mvp-mock-service` | Mock 服务搭建 |
| `kf-mvp-test-single` | 单模块测试 |
| `kf-mvp-test-e2e` | E2E 测试 |
| `kf-mvp-test-review` | 测试审查 |
| `kf-mvp-testing-strategy` | 测试策略 |

### 阶段 3：开发实现
| 技能名称 | 说明 |
|---------|------|
| `kf-mvp-backend-tdd` | 后端 TDD 开发 |
| `kf-mvp-frontend-dev` | 前端开发 |
| `kf-mvp-vue-components` | Vue 组件开发 |
| `kf-mvp-auth-implementation` | 认证实现 |
| `kf-mvp-code-review` | 代码审查 |
| `kf-mvp-tdd-helper` | TDD 辅助 |

### 阶段 4：集成与部署
| 技能名称 | 说明 |
|---------|------|
| `kf-mvp-integration` | 集成测试 |
| `kf-mvp-stage4-coordinator` | Stage4 协调器 |
| `kf-mvp-debug` | 调试技能 |
| `kf-mvp-devops` | DevOps 部署 |
| `kf-mvp-data-migration` | 数据迁移 |

### 质量与优化
| 技能名称 | 说明 |
|---------|------|
| `kf-mvp-code-review` | 代码审查 |
| `kf-mvp-security` | 安全审查 |
| `kf-mvp-performance` | 性能优化 |
| `kf-mvp-error-handling` | 错误处理 |
| `kf-mvp-health-check` | 健康检查 |
| `kf-mvp-refactoring` | 重构技能 |

### 辅助技能
| 技能名称 | 说明 |
|---------|------|
| `kf-mvp-caching` | 缓存策略 |
| `kf-mvp-monitoring` | 监控配置 |
| `kf-mvp-api-doc` | API 文档 |
| `kf-mvp-api-versioning` | API 版本管理 |
| `kf-mvp-onboarding` | 新人引导 |
| `kf-mvp-cli` | CLI 工具 |
| `kf-web-search` | 网络搜索 |
| `kf-skill-design-expert` | 技能设计专家 |

---

## 🗣️ 沟通能力（v2.7 新增）

本技能集借鉴了 manual-driving 项目的沟通能力，强化了 Agent 与用户的认知同步机制：

### 核心特性

1. **反转控制（IoC）**
   - Agent 不替用户做决策
   - Agent 负责分析、整理、建议——用户负责决策
   - 禁止自行假设，必须向用户确认

2. **强制问答协议（MQAP）**
   - 每个环节必须执行理解确认、计划卡片、产出物确认
   - 不清楚的点不允许留空
   - 用户审阅后才能继续

3. **卡片式执行计划（CEP）**
   - 在执行前输出执行计划卡片
   - 包含：全面性、难点、主线计划
   - 用户确认后才能执行

4. **驳回-修正-重审循环（RRR）**
   - 用户可以驳回 Agent 的产出
   - Agent 修正后重新提交
   - 最多 3 轮，超过则升级为人工审查

5. **认知同步检查点（CP）**
   - 每个阶段都有强制的认知同步检查点
   - 用户确认后才能进入下一阶段

6. **决策日志系统**
   - 所有决策都记录在案
   - 可追溯、可复议
   - Agent 间通过决策日志传递上下文

### 使用示例

```bash
# 安装技能后，在项目中使用
qoder

# Agent 会自动执行沟通协议
> 使用 all-in-mvp 创建一个 CRM 系统

# Agent 会：
# 1. 输出理解确认清单
# 2. 等待用户确认
# 3. 输出执行计划卡片
# 4. 等待用户确认
# 5. 执行开发
# 6. 输出产出物确认清单
# 7. 等待用户确认
```

### 沟通质量指标

| 指标 | 目标值 |
|------|--------|
| 认知同步覆盖率 | = 100% |
| 提问充分度 | ≥ 3 |
| 决策记录完整率 | = 100% |
| 用户决策参与率 | ≥ 80% |
| 首次同意率 | ≥ 50% |
| 平均驳回轮次 | ≤ 1.5 |

---

## 🔄 同步机制（v2 双向增强版）

### 三个目录的分工

| 目录 | 角色 | 说明 |
|------|------|------|
| `skills/` | **源码仓库**（canonical source） | Git 管理的权威版本 |
| `.claude/skills/` | **Claude Code 运行时** | 可直接拷到实际项目使用 |
| `.qoder/skills/` | **Qoder 运行时** | 可直接拷到实际项目使用 |

### 你的真实工作流

```
┌──────────────┐    npm run sync     ┌──────────────────┐
│  skills/     │ ──────────────────→ │  .claude/skills/ │
│  (源码仓库)   │ ←────────────────── │  .qoder/skills/  │
└──────────────┘    npm run sync:pull└──────────────────┘
       ↑                                    │
       │ 修改后回粘                           │ 拷贝到实际项目
       │                                    ↓
       └──────────────────── 实际项目中沉淀升级 ──┘
```

### 四种同步模式

```bash
# ① 推送模式（默认）：skills/ → .claude/ + .qoder/
npm run sync

# ② 拉取模式：.claude/ → skills/（把实际项目的改进拉回来）
npm run sync:pull

# ③ 自动合并模式：双向检测，谁新用谁
npm run sync:merge

# ④ 交互模式：逐文件让你决定
npm run sync:interactive
```

### 指定平台

```bash
npm run sync:claude          # 只推送到 Claude Code
npm run sync:qoder           # 只推送到 Qoder
npm run sync -- --target claude --mode pull  # 只从 Claude 拉回
```

### 平台差异化（Overlay 机制）

如果某个技能需要针对不同平台做差异化适配，在技能目录下创建 `.overlay/` 子目录：

```
skills/all-in-mvp/
├── SKILL.md                    # 通用版本（基础层）
├── agents/
├── .overlay/
│   ├── claude/
│   │   └── SKILL.md            # Claude Code 专用覆盖
│   └── qoder/
│       └── SKILL.md            # Qoder 专用覆盖
```

推送时自动融合：`基础层 + .overlay/claude/ → .claude/skills/`

### 安全保护

- `--dry-run`：预览模式，不实际修改
- `--backup`：同步前自动备份到 `.backups/`
- `--verbose`：显示详细日志
- 冲突检测：两边同时修改时提示

---

## 🎯 使用示例

### 示例 1：从零创建 MVP 项目（giget 模式）

```bash
# 1. 拉取项目模板
npx giget gh:1234567KF/all-in-mvp#all-in-mvp my-crm-project --ignore "AGENTS.md,README.md,INSTALL.md,WhyMe.md,MVP*,screenshot-1-full.png,nul,all-in-mvp-*.md,shadcn/**,tools/**,overlays/**,ultra-cost-effective/**"
cd my-crm-project

# 2. 安装技能到 AI Agent
./install.sh

# 3. 启动 AI Agent 并激活技能
qoder
> 使用 all-in-mvp 创建一个 CRM 系统
```

### 示例 2：安装技能到已有项目

```bash
# 在你的项目目录中
cd my-existing-project

# 一键安装（远程）
curl -fsSL https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.sh | bash -- --agent qoder
```

### 示例 3：更新技能到最新版

```bash
# 重新运行安装命令即可覆盖升级
npx giget gh:1234567KF/all-in-mvp#all-in-mvp/skills ~/.qoder/skills --force

# 或拉取最新模板后运行 sync
npx giget gh:1234567KF/all-in-mvp#v2.8.0 . --ignore "AGENTS.md,README.md,INSTALL.md,WhyMe.md,MVP*,screenshot-1-full.png,nul,all-in-mvp-*.md,shadcn/**,tools/**,overlays/**,ultra-cost-effective/**"
./install.sh
```

### 示例 4：锁定版本（团队协作）

```bash
# 指定 tag 确保团队使用相同版本
npx giget gh:1234567KF/all-in-mvp#v2.8.0 my-project --ignore "AGENTS.md,README.md,INSTALL.md,WhyMe.md,MVP*,screenshot-1-full.png,nul,all-in-mvp-*.md,shadcn/**,tools/**,overlays/**,ultra-cost-effective/**"
cd my-project && ./install.sh

# 或直接 clone 仓库
git clone https://github.com/1234567KF/all-in-mvp.git
cd all-in-mvp && npm run sync
```

---

## 📋 系统要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **AI Agent**: Qoder / Claude Code / Gemini

---

## 🔧 开发者指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/1234567KF/all-in-mvp.git
cd all-in-mvp

# 同步技能到本地 AI Agent
npm run sync

# 测试技能
cd test-project
qoder
> 使用 all-in-mvp 测试流程
```

### 发布新版本

```bash
# 1. 更新技能内容
# 2. 更新版本号（package.json）
# 3. 提交更改
git add .
git commit -m "feat: 添加新功能"

# 4. 打 tag（与 package.json 版本对应）
git tag v2.8.0
git push origin all-in-mvp --tags

# 5. 用户通过 tag 拉取
# npx giget gh:1234567KF/all-in-mvp#v2.8.0 my-project
```

---

## ❓ 常见问题

### Q: giget 拉取后项目里没有 README 等文档文件？

A: 这是有意为之。`--ignore` 参数排除了根目录的文档/白皮书/截图等元数据文件，只分发目标项目真正需要的技能、脚本和 IDE 配置。这些文档在 [GitHub 仓库](https://github.com/1234567KF/all-in-mvp) 上可以随时查阅。

### Q: 为什么 giget URL 需要 `#all-in-mvp`？

A: 本仓库的默认分支是 `all-in-mvp`，而不是 GitHub 常见的 `main`。如果不指定分支，giget 默认尝试拉取 `main` 分支，会导致 404。`gh:1234567KF/all-in-mvp#all-in-mvp` 中的 `#all-in-mvp` 就是显式告诉 giget 去拉取哪个分支。

### Q: Windows PowerShell 运行 `npx giget` 报错 `$LASTEXITCODE`？

A: 这是 npm 自带的 `npx.ps1` 脚本与某些 PowerShell 版本的兼容性问题。**解决方法**：用 `npx.cmd` 替代 `npx`：
```powershell
# 错误 ❌
npx giget gh:1234567KF/all-in-mvp#all-in-mvp

# 正确 ✅
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp
```
如果仍然失败，可以用 `node -e` 绕过：
```powershell
npm install -g giget
node -e "require('giget').downloadTemplate('gh:1234567KF/all-in-mvp#all-in-mvp', {dir:'./my-project'})"
```

### Q: 为什么需要同步三个目录？

A: 不同的 AI Agent 工具使用不同的配置目录：
- Qoder: `~/.qoder/skills/`
- Claude Code: `~/.claude/skills/`
- Gemini: `~/.gemini/config/skills/`

为了支持多个平台，我们需要将技能安装到对应的目录。

### Q: 如何确保团队使用相同版本？

A: 
1. 使用 `npx giget` 从同一个 Git 仓库安装
2. 定期运行更新命令
3. 使用提供的同步脚本

### Q: 可以自定义技能吗？

A: 可以！
1. Fork 本仓库
2. 修改 `skills/` 目录中的技能
3. 使用你的仓库地址安装

### Q: 如何卸载技能？

A: 直接删除对应的技能目录即可：
```bash
# Qoder
rm -rf ~/.qoder/skills/all-in-mvp

# Claude Code
rm -rf ~/.claude/skills/all-in-mvp
```

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📞 支持

- GitHub Issues: https://github.com/1234567KF/all-in-mvp/issues
- 版本历史: https://github.com/1234567KF/all-in-mvp/tags
