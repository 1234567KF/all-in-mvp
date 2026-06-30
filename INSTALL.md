# all-in-mvp 技能安装与分发指南

一个完整的多 Agent 并行 MVP 开发流水线技能集，支持一键安装到多个 AI Agent 平台。

---

## 🚀 快速安装（推荐）

### 方式一：一键安装所有技能

使用 `npx giget` 命令，直接将技能下载并安装到对应 AI Agent 的全局配置目录中：

#### macOS / Linux / Git Bash / WSL

* **Qoder：**
  ```bash
  npx giget github:your-username/all-in-mvp/skills ~/.qoder/skills --force
  ```

* **Claude Code：**
  ```bash
  npx giget github:your-username/all-in-mvp/skills ~/.claude/skills --force
  ```

* **Gemini / Antigravity：**
  ```bash
  npx giget github:your-username/all-in-mvp/skills ~/.gemini/config/skills --force
  ```

#### Windows (PowerShell)

* **Qoder：**
  ```powershell
  npx giget github:your-username/all-in-mvp/skills "$HOME\.qoder\skills" --force
  ```

* **Claude Code：**
  ```powershell
  npx giget github:your-username/all-in-mvp/skills "$HOME\.claude\skills" --force
  ```

* **Gemini / Antigravity：**
  ```powershell
  npx giget github:your-username/all-in-mvp/skills "$HOME\.gemini\config\skills" --force
  ```

#### Windows (CMD - 命令提示符)

* **Qoder：**
  ```cmd
  npx giget github:your-username/all-in-mvp/skills "%USERPROFILE%\.qoder\skills" --force
  ```

* **Claude Code：**
  ```cmd
  npx giget github:your-username/all-in-mvp/skills "%USERPROFILE%\.claude\skills" --force
  ```

* **Gemini / Antigravity：**
  ```cmd
  npx giget github:your-username/all-in-mvp/skills "%USERPROFILE%\.gemini\config\skills" --force
  ```

> 💡 **提示**：若技能后续有更新，只需重新运行上述对应助手的命令即可完成覆盖升级。

---

### 方式二：安装单个技能

如果你只需要特定的技能，可以单独安装：

```bash
# 安装 all-in-mvp 主技能
npx giget github:your-username/all-in-mvp/skills/all-in-mvp ~/.qoder/skills/all-in-mvp --force

# 安装 Pipeline Coordinator
npx giget github:your-username/all-in-mvp/skills/kf-pipeline-coordinator ~/.qoder/skills/kf-pipeline-coordinator --force

# 安装 E2E 测试技能
npx giget github:your-username/all-in-mvp/skills/kf-mvp-test-e2e ~/.qoder/skills/kf-mvp-test-e2e --force
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

### 示例 1：创建新项目

```bash
# 1. 安装技能
npx giget github:your-username/all-in-mvp/skills ~/.qoder/skills --force

# 2. 在新项目目录中启动 AI 助手
cd my-new-project
qoder

# 3. 激活技能
> 使用 all-in-mvp 创建一个 CRM 系统
```

### 示例 2：更新技能

```bash
# 重新运行安装命令即可覆盖升级
npx giget github:your-username/all-in-mvp/skills ~/.qoder/skills --force
```

### 示例 3：团队协作

```bash
# 团队成员各自安装
npx giget github:your-username/all-in-mvp/skills ~/.claude/skills --force

# 确保使用相同版本
git clone https://github.com/your-username/all-in-mvp.git
cd all-in-mvp
node scripts/sync-skills.js
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
git clone https://github.com/your-username/all-in-mvp.git
cd all-in-mvp

# 安装依赖
npm install

# 同步技能到本地 AI Agent
npm run sync-skills

# 测试技能
cd test-project
qoder
> 使用 all-in-mvp 测试流程
```

### 发布新版本

```bash
# 1. 更新技能内容
# 2. 提交更改
git add .
git commit -m "feat: 添加新功能"

# 3. 推送到远程
git push origin main

# 4. 团队成员更新
npx giget github:your-username/all-in-mvp/skills ~/.qoder/skills --force
```

---

## ❓ 常见问题

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

- GitHub Issues: https://github.com/your-username/all-in-mvp/issues
- 文档: https://github.com/your-username/all-in-mvp/wiki
