# all-in-mvp 技能安装与分发指南

一个完整的多 Agent 并行 MVP 开发流水线技能集，支持 `npx giget` 一键拉取，开箱即用。

---

## 🏗️ 架构原理

```
开发者修改 skills/ → git push
                      │
                      ▼ pre-push hook 自动执行
                 npm run sync（含 overlay 融合）
                      │
                      ▼ 自动提交
         .claude/skills/  .qoder/skills/  .trae/skills/
                      │
                      ▼ git push + .gitattributes 自动过滤
                 GitHub 仓库（仅三平台 skills/ + install 脚本）
                      │
                      ▼ npx giget 拉取
              用户项目（.claude/.qoder/.trae/skills/ 项目级）
                      │
                      ▼ 启动 Agent
              自动识别项目级技能（优先级高于全局）
```

**核心原则**：推库前自动同步 → 用户一行命令即可，项目级技能不污染全局。

---

## 🚀 快速开始

### 一行命令

**macOS / Linux / WSL：**

```bash
npx giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
```

**Windows PowerShell：**

```powershell
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
```

> 在当前项目根目录执行。`.claude/skills/` `.qoder/skills/` `.trae/skills/` 直接出现在项目中，启动 Agent 即可使用。**项目级优先，不污染全局。**

### 新项目

**macOS / Linux / WSL：**

```bash
npx giget gh:1234567KF/all-in-mvp#all-in-mvp my-project && cd my-project
```

**Windows PowerShell：**

```powershell
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp my-project; cd my-project
```

### 分步操作

<details>
<summary>点击展开分步说明</summary>

#### Step 1：拉取技能到项目

**macOS / Linux / WSL：**

```bash
npx giget gh:1234567KF/all-in-mvp#all-in-mvp my-project
cd my-project
```

**Windows PowerShell：**

```powershell
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp my-project
cd my-project
```

> 💡 `.claude/skills/` `.qoder/skills/` `.trae/skills/` 已在项目中，`.gitattributes` 自动过滤冗余文件。

#### Step 2：启动 Agent

```bash
qoder    # 或 claude
> 使用 all-in-mvp 创建一个后台管理系统
```

Agent 自动识别项目级技能（优先级高于全局），无需额外配置。

#### 可选：验证安装

```bash
./install.sh    # macOS/Linux
.\install.ps1   # Windows
```

脚本会检测技能目录是否就绪，缺失则自动下载补齐。

</details>

---

## 📋 远程安装（不通过 giget）

| 平台 | 命令 |
|------|------|
| **macOS / Linux** | `curl -fsSL https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.sh \| bash` |
| **Windows** | `irm https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.ps1 \| iex` |

> 下载技能到当前目录（项目级），不污染全局。

---

## 📦 技能清单

本技能集包含 42 个技能，覆盖 MVP 开发全流程：

### 核心流程
| 技能 | 说明 |
|------|------|
| `all-in-mvp` | 主技能 - 多 Agent 并行 MVP 流水线 |
| `kf-pipeline-coordinator` | Pipeline 任务调度器 |
| `grill-with-docs` | 交叉审查 |

### 阶段 1：需求与规划
`kf-mvp-product-manager` `kf-mvp-prd-generator` `kf-mvp-arch-expert` `kf-mvp-biz-expert` `kf-mvp-spec-generator` `kf-mvp-task-splitter`

### 阶段 2：设计
`kf-mvp-api-contract` `kf-mvp-schema-design` `kf-mvp-mock-service` `kf-mvp-test-single` `kf-mvp-test-e2e` `kf-mvp-test-review` `kf-mvp-testing-strategy`

### 阶段 3：开发
`kf-mvp-backend-tdd` `kf-mvp-frontend-dev` `kf-mvp-vue-components` `kf-mvp-auth-implementation` `kf-mvp-code-review` `kf-mvp-tdd-helper`

### 阶段 4：集成
`kf-mvp-integration` `kf-mvp-stage4-coordinator` `kf-mvp-debug` `kf-mvp-devops` `kf-mvp-data-migration`

### 质量 & 辅助
`kf-mvp-security` `kf-mvp-performance` `kf-mvp-error-handling` `kf-mvp-health-check` `kf-mvp-refactoring` `kf-mvp-caching` `kf-mvp-monitoring` `kf-mvp-api-doc` `kf-mvp-api-versioning` `kf-mvp-onboarding` `kf-mvp-cli` `kf-web-search` `kf-skill-design-expert`

---

## 🗣️ 沟通能力

本技能集具备完整的 Agent-用户认知同步机制：**反转控制（IoC）**、**强制问答协议（MQAP）**、**卡片式执行计划（CEP）**、**驳回-修正-重审循环（RRR）**、**认知同步检查点（CP）**、**决策日志系统**。

---

## 🔄 同步机制

### 目录分工

| 目录 | 角色 | 说明 |
|------|------|------|
| `skills/` | **源码仓库** | Git 管理的权威版本 |
| `.claude/skills/` | **Claude Code 运行时** | 含 overlay 融合，即拷即用 |
| `.qoder/skills/` | **Qoder 运行时** | 含 overlay 融合，即拷即用 |
| `.trae/skills/` | **Trae 运行时** | 项目内自动识别，无需额外配置 |

### pre-push hook（自动化）

```bash
git push → 自动触发 npm run sync → 自动提交变更 → 推送
```

开发者无需手动运行 sync，推库时自动完成。

### 手动同步

```bash
npm run sync              # 推送到所有平台
npm run sync:claude       # 只推送到 Claude Code
npm run sync:qoder        # 只推送到 Qoder
npm run sync:trae         # 只推送到 Trae
npm run sync:merge        # 双向合并
npm run sync:interactive  # 逐文件确认
```

### Overlay 机制

在技能目录下创建 `.overlay/` 子目录实现平台差异化：

```
skills/all-in-mvp/
├── SKILL.md                 # 通用版本（基础层）
└── .overlay/
    ├── claude/
    │   └── SKILL.md         # Claude Code 专用覆盖
    └── qoder/
        └── SKILL.md         # Qoder 专用覆盖
```

推送时自动融合：基础层 + `.overlay/claude/` → `.claude/skills/`

---

## 🔧 开发者指南

### 工作流

```bash
# 1. 修改技能
vim skills/all-in-mvp/SKILL.md

# 2. 推库（pre-push hook 自动 sync + commit）
git add skills/
git commit -m "feat: 更新 all-in-mvp 技能"
git push
# → pre-push hook 自动运行 npm run sync
# → 自动提交 .claude/.qoder/.trae 变更
# → 推送完成

# 3. 打 tag 发布新版本
git tag v2.9.0
git push origin all-in-mvp --tags
```

### 发布新版本

```bash
npm version patch   # 或 minor / major
git push origin all-in-mvp --tags
```

用户通过 tag 锁定版本：

```bash
npx giget gh:1234567KF/all-in-mvp#v2.9.0 my-project
```

---

## ❓ 常见问题

### Q: 为什么 giget 拉取后的项目只有 skills 目录？

A: `.gitattributes` 的 `export-ignore` 规则让 GitHub tarball 自动排除文档/白皮书/源 skills 等文件。只保留 `.claude/skills/` `.qoder/skills/` `.trae/skills/` `install.sh` `install.ps1` `.gitignore`。文档在 [GitHub 仓库](https://github.com/1234567KF/all-in-mvp) 随时可查。

### Q: 技能是全局的还是项目级的？

A: **项目级**。技能在项目根目录 `.claude/skills/` `.qoder/skills/` `.trae/skills/`，Agent 自动识别且优先级高于全局。每个项目独立拥有，互不影响。

### Q: 为什么 giget URL 需要 `#all-in-mvp`？

A: 仓库默认分支是 `all-in-mvp`（非 `main`），giget 默认拉取 `main` 会导致 404。`#all-in-mvp` 显式指定分支。

### Q: Windows PowerShell 运行 `npx giget` 报错 `$LASTEXITCODE`？

A: 用 `npx.cmd` 替代 `npx` 即可绕过 npx.ps1 兼容性问题：
```powershell
# 错误 ❌
npx giget gh:1234567KF/all-in-mvp#all-in-mvp

# 正确 ✅
npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp
```

### Q: pre-push hook 如何安装？

A: 运行 `npm install` 时自动安装（`prepare` 脚本）。也可手动安装：`node scripts/setup-hooks.js`。

---

## 📄 许可证

MIT License
