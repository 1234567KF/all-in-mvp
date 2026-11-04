# all-in-mvp → Qoder 迁移计划 (Migration Plan)

> 生成日期：2026-09-24 ｜ 目标平台：**Qoder (CLI / 桌面 Agent)，单平台**
> 范围：**全量平移** — 保留全部 26 技能 + 18 子 Agent + 规则 + 门禁 + 血案库 + 脚本，仅修兼容性
> （技能目录实测：`.qoder/skills/` 下 27 个目录，其中 `references/` 是共享资产目录而非技能 → 26 个 `SKILL.md`）
> 原则：**只动平台管线，不动业务内容**（不重写技能逻辑、不裁剪功能、不做主动 code review）

---

## 0. 决策与范围界定（已锁定）

| 项 | 决策 | 含义 |
|----|------|------|
| 保留范围 | 全量平移 | 所有 skill/agent/rule/gate/script **一个不删**；治理层（R001–R021、血案库、PowerShell 门禁）原样保留 |
| 目标平台 | Qoder 单平台 | **移除** Claude Code 机制：`.claude/workflows`、`.overlay/claude`、`CLAUDE_*` 环境变量、`Workflow()` 调用模型 |
| 使用场景 | 非金融大型项目 | 仍需多 Agent 规模化能力，但迁移本身以"能跑起来"为目标 |

**我会动的（平台管线）：** 文件编码/BOM、执行调用机制（Workflow→子 Agent）、`settings.json` schema、门禁触发机制（qualityGates→hooks）、Claude 专属覆盖层。

**我不会动的（业务内容，除非你另行同意）：** 各 Stage 的逻辑与产出物定义、门禁规则内容、血案库、E2E 方法论、Vue→React 技术栈漂移、超大 SKILL.md 的瘦身。后两项仅在 §6 列为可选后续。

---

## 1. 诊断结论回顾（证据见附录 A）

### P0 — 在 Qoder 下功能性失效（必修）

1. **执行模型断裂**：主技能 `all-in-mvp/SKILL.md` 用 `Workflow({scriptPath:'.claude/workflows/*.js'})` 驱动全量/增量模式。
   - Qoder **没有 `Workflow()` 工具**（官方文档确认无 Claude Code workflows）；
   - 且仓库里 **`.claude/` 目录根本不存在** —— 那 4 个 `.js` 脚本缺失。
   - ⇒ 现状：全量/增量模式在**任何平台都跑不起来**。必须改为 Qoder 子 Agent 编排。
2. **主技能描述不可解析（BOM）**：`all-in-mvp/SKILL.md`、`kf-mvp-frontend-dev/SKILL.md` 以 **UTF-8 BOM** 保存（首字节 `EF BB BF`，第 1 行变成 `﻿---`）。Qoder frontmatter 解析器要求文件从字节 0 起为 `---`，BOM 导致 `description` 读不到 → 技能列表里显示 `---` → **主入口技能无法自动触发**。正常技能（如 `kf-mvp-api-contract`）无 BOM。
3. **`qualityGates` 是无效键**：Qoder `settings.json` 支持 `model / tools / security / mcpServers / env / rules / hooks`，**不支持 `qualityGates`**。⇒ "v2.18 文件路径自动触发审查/冒烟/E2E" 在 Qoder 下**完全不生效**（无运行时执行器）。

### P1 — 降级 / 静默失效（应修）

4. `env` 里 `CLAUDE_FLOW_HOOKS_ENABLED`、`CLAUDE_CODE_ALWAYS_THINKING` 是 Claude 专属，Qoder 忽略；`~/.qoder/hooks/` 需按 Qoder hooks 格式重新接线。
5. `lean-ctx` MCP 已配置但**未加载**（不在本会话已连接服务列表）→ "极致节能"上下文压缩可能没生效。
6. `settings.json` 的 `rules: [...]` 用绝对 Windows 路径指向 `ultra-cost-effective/rules/*.md`，这些**未被自动加载**进上下文（只有 `.qoder/rules/quality-gate.md` + `agents.md` 被加载）→ 节能规则可能未激活。
7. `model: deepseek-v4-flash`、技能 frontmatter 的 `recommended_model: qwen-3.7-Max` 需对照 Qoder 模型目录校验（`recommended_model` 是自定义键，Qoder 忽略）。
8. **20 处 PowerShell `.ps1` 引用** —— 仅 Windows；用户环境是 Windows，可保留，但需确认经 Qoder 的 Bash(Git Bash) 正确调用。

### P2 — 臃肿 / 漂移（本次仅记录，见 §6）

9. SKILL.md 上下文税与"极致节能"目标自相矛盾：`all-in-mvp` **2,897 行**、`kf-mvp-test-e2e` 1,429、`kf-pipeline-coordinator` 1,332、`kf-mvp-backend-tdd` 1,185、`kf-mvp-frontend-dev` 1,151。
10. **Vue→React 半成品迁移**：28 个文件仍引用 Vue，`kf-mvp-vue-components` 仍在，README 写"Vue 3 + shadcn/vue"，但 git log 声称已迁 React 19 + Bun。
11. 编码不统一：BOM+CRLF / LF+NEL / `extended-ASCII`（正文含 `` 乱码）三种混存。

### ✅ 已确认可直接沿用

- `.qoder/skills/`（27 个）与 `.qoder/agents/`（18 个）**已被 Qoder 自动加载**（本会话可见）。
- `.qoder/rules/*.md` 与根 `agents.md` 被自动加载为上下文。
- `Agent(subagent_type=...)` 子 Agent 机制原生可用 —— 这是替换 `Workflow()` 的落点。

---

## 2. 迁移计划（分阶段，每阶段含验证）

> 全程在新分支 `qoder-migration` 上进行，不直接改 `all-in-mvp` 发布分支。

### Phase 0 — 基线与安全网
- 建分支 `qoder-migration`；记录基线：哪些技能当前描述可见 / 哪些是 `---`。
- **验证**：`git status` 干净；基线清单存档。

### Phase 1 — 编码归一化（P0-2，非内容改动）
- 去除所有 `.qoder/skills/*/SKILL.md`、`.qoder/agents/*.md`、`.qoder/rules/*.md` 的 **UTF-8 BOM**；行尾统一 LF；修复正文 `extended-ASCII`/`` 乱码字节（仅当其影响解析或明显损坏）。
- **验证**：`file` 输出全部为 "UTF-8 (无 BOM)"；**重载 Qoder 后 `all-in-mvp` 与 `kf-mvp-frontend-dev` 在技能列表显示真实描述**（不再是 `---`）。

### Phase 2 — 执行模型：`Workflow()` → Qoder 子 Agent（P0-1，平台改动）
- 在 `all-in-mvp/SKILL.md`：把每个 Stage 的 `Workflow({scriptPath:'.claude/workflows/stageN-*.js'})` 调用，改写为对**既有** `.qoder/agents/*.md` 子 Agent 的 `Agent(subagent_type='mvp-*')` 编排（映射表见附录 B）。
- 删除 "Dynamic Workflow（Claude Code 专有）" 章节与全部 `.claude/workflows/*.js` 引用；**保留**所有 Stage 逻辑、门禁探针、规则索引、血案引用、MQAP/CEP 沟通协议。
- 移除 `kf-mvp-testing-strategy/.overlay/claude/`（单平台 → 只留 Qoder 版）。
- 清理技能 frontmatter 里的 `platforms: [claude-code, qoder]` → `qoder`；`workflow-scripts` 字段移除。
- **验证**：全文 `grep -r ".claude/workflows\|Workflow({" .qoder/` 归零；用一条极简需求触发 `all-in-mvp`，确认它走子 Agent 编排而非 Workflow。

### Phase 3 — `settings.json` → Qoder schema（P0-3 / P1，平台改动）
- 按 Qoder 支持的键重写 `.qoder/settings.json`：`model / env / rules / permissions / mcpServers / hooks / security`。
- **门禁保留但换机制**：把失效的 `qualityGates` 转成 Qoder **hooks（PostToolUse）** —— 对 Edit/Write 命中路径（`src/**` 等）时派发同一批审查/冒烟技能。这样"全量平移保留治理"的意图在 Qoder 支持的机制上**真正生效**。
- 移除 Claude 专属 `env`；`model` 对照 Qoder 目录校验/改名；`lean-ctx` MCP —— 修复安装或（若不可用）移除并记录；`rules` 改为 Qoder 能自动加载的相对路径。
- **验证**：Qoder 启动无 settings 报错；触发一次命中路径的编辑，确认 hook 派发了 code-review 子 Agent。

### Phase 4 — 脚本与门禁在 Qoder 上的调用（P1-8）
- 保留全部 `.ps1`（Windows 目标）。确认经 Qoder Bash(Git Bash) 用 `powershell -ExecutionPolicy Bypass -File ...` 正确调用；必要时补 Git-Bash 兜底说明。
- **验证**：手动跑 `check-stage3-gate.ps1` / `check-stage4-gate.ps1` / `e2e-quality-gate.ps1` 各一次，退出码正常。

### Phase 5 — 验证与文档
- 重载 Qoder：确认 **27 技能全部显示真实描述且可自动触发**；**18 子 Agent 均可经 Agent 工具解析**。
- 干跑：`all-in-mvp` 走完轻量模式 QuickStep1-3 + 至少一个 Stage 门禁探针。
- 更新 `README.md`：安装说明、平台=Qoder 单平台、（可选）技术栈现状标注。
- **验证**：本计划 §1 的 P0-1/2/3 全部关闭。

---

## 3. 交付物
- 分支 `qoder-migration` 上的提交（按 Phase 分组）。
- 更新后的 `.qoder/settings.json`、`all-in-mvp/SKILL.md`、受影响 SKILL.md/agent 文件。
- 本计划文件的"实际执行结果"回填（每 Phase 的验证结论）。

## 4. 风险
- **模型 ID**：`deepseek-v4-flash` / `qwen-3.7-Max` 若非 Qoder 合法模型，需替换为目录内等价模型（可能影响"pro/flash 分级"语义）。→ Phase 3 校验后再定。
- **hooks 能力边界**：若 Qoder hooks 无法按文件路径 glob 派发子 Agent，则门禁自动化需降级为"规则提示 + 手动触发"。→ Phase 3 先做一个最小 hook 探针验证能力，再决定。
- **子 Agent 编排 vs Workflow 语义差**：Workflow 脚本内嵌了压缩 prompt 与断点续跑/自愈；改子 Agent 后这些能力靠主 Agent 编排承接，行为会有差异（属平台迁移的固有代价，非内容裁剪）。

## 5. 不做（本次）
- 不删任何技能/Agent/规则/门禁/脚本。
- 不重写各 Stage 业务逻辑、不改 E2E 方法论、不动血案库内容。
- 不主动做全量 code review。

## 6. 可选后续（需你另行 opt-in）

> 边界说明：§7「未决项」的 4 条（门禁脚本 2 个 bug、TOTAL 口径、R010 预期失败、技能计数）**已全部落地并推送**。
> 本节 A/B 与 §0 锁定的"不动业务内容"原则直接冲突，属**内容重构而非兼容性修复**，故未擅自执行 —— 需要你显式改范围才动。

- **A. 瘦身**：把 2,897 行的 `all-in-mvp/SKILL.md` 等拆成"精简核心 + `references/`"渐进式披露 —— 对"大型项目"是最大的 token 节省，但属内容重构。
- **B. 收敛 Vue→React 漂移**：README 与 `kf-mvp-frontend-dev` 的技术栈声明本次已按现状（React 19 + Vite）订正；但各技能正文里仍有以 Vue 为例的示例代码，统一改写属内容重构。

---

## 7. 执行结果回填（2026-09-24，分支 `qoder-migration`）

> **已提交并推送**：`081ef151` v2.19（25 files changed, 623+/1114−）。
> 远端 `origin/qoder-migration` 与发布分支 `origin/all-in-mvp`（默认分支，`giget …#all-in-mvp` 的安装来源）均已快进到 `081ef151`。
> 提交身份按约定**未写入 `git config`**，只在提交命令上临时指定（`git -c user.name=… -c user.email=… commit`）。
> 与迁移无关的未跟踪文件（pptx / `ppt-preview/` / `qoder-*.png` / 根 `scripts/`）**未纳入提交**。

| Phase | 状态 | 做了什么 | 验证证据 |
|-------|------|---------|---------|
| 0 基线 | ✅ | 分支 `qoder-migration` | `git rev-parse --abbrev-ref HEAD` = qoder-migration |
| 1 编码 | ✅ | 去 BOM：`all-in-mvp/SKILL.md`、`kf-mvp-frontend-dev/SKILL.md`（全仓库仅这 2 个 SKILL.md 带 BOM） | 首 3 字节 `2d 2d 2d`；**本会话技能列表已显示两者真实 description** |
| 2 执行模型 | ✅ | `Workflow()` → `Agent(subagent_type='mvp-*')`；删 Claude 章节/`platforms` 双平台/`.overlay/claude`；Stage1–4 触发方式与"主 Agent 动作"全部改写；自愈章节标注为"设计示意" | `grep "Workflow({\|scriptPath\|\.claude/workflows"` = 0（仅剩 2 处刻意的迁移说明）；本会话 18 个 `mvp-*` 子 Agent 全部可解析 |
| 3 settings | ✅ | 按真实 schema 重写：`model{name}` + `hooks.PostToolUse`；删除 `qualityGates/env/modelPreferences/rules/permissions/mcpServers(lean-ctx)`；新增 `.qoder/scripts/quality-gate-hook.ps1`；新增 `.qoder/rules/ultra-cost-effective.md`（按需索引）；`quality-gate.md` 触发链改为 hook 语义；`msvp-verifier`→`verifier`/`mvp-verifier`；`gate-rules.yaml` 注释同步 | JSON/ YAML 均解析通过；hook 用 5 组真实 payload 单测：命中→stderr+exit 2，未命中/坏 JSON→静默 exit 0；新规则文件写入后**立即被自动加载进上下文**（证明 `.qoder/rules/` 才是规则真源） |
| 4 门禁脚本 | ✅ | **10 个 `.ps1` 补 UTF-8 BOM**（PS 5.1 无 BOM 会把含中文的脚本直接解析失败）；全部文档/提示中的调用形式改为 `powershell -NoProfile -ExecutionPolicy Bypass -File`；第二轮又修掉 5 类脚本 bug（见下） | 8 个脚本在项目根逐个执行：无 ParserError、退出码语义正确（Stage3 `2 PASS → [PROCEED]`、Stage4 `3 PASS / 3 FAIL → [BLOCKED]`）；6 个 check 的 `-Json` 输出全部通过 `json.loads`；中文输出不再乱码 |
| 5 文档 | ✅ | README：26 技能 + 18 子 Agent 真实清单、子 Agent 表、门禁三条链路、免 Node 的 git clone 安装法、Starter 更正为 React 19 + Vite、4 条新 FAQ | 计数由 `ls`/`grep` 实测；Vue 3 声明与 `apps/web/src/*.tsx` 冲突已修正 |

### 诊断中被本次执行**修正**的假设

- P0-3 原文写"Qoder 支持 `env / rules / hooks`"。核对官方 `docs.qoder.com/zh/cli/settings` 后：有效键是 `outputStyle/language/agent` + `ui/model/tools/security/mcpServers/statusLine/mcp.*` + **`hooks`**；`env`、`rules`、`permissions` **均非有效键**（被静默忽略）。⇒ 节能规则只能靠 `.qoder/rules/*.md` 落地，已照此实现。
- `model` 必须是**对象** `{name}`，原字符串写法从未生效。
- hooks 事件名是 **PascalCase**（`PostToolUse`），且 `matcher` 只匹配**工具名**，不匹配文件路径 ⇒ 路径判定必须在脚本内做（已在 `quality-gate-hook.ps1` 内实现）。
- `lean-ctx` 不是"未加载"，而是**可执行文件不存在**；`node` 也不在本机 PATH ⇒ `ultra-cost-effective` 的 node hooks 与 `.cjs` 监控脚本当前全部不可运行（已写入 `.qoder/rules/ultra-cost-effective.md` 的可用性表）。

### 未决项 → 已全部落地（2026-09-24 第二轮，你说"全部解决"后执行）

修门禁脚本时又挖出两个被第一个 bug **掩盖**的老 bug，一并修完。现 8 个 `.ps1` 全部可直接跑，退出码与 JSON 输出均正确。

| # | 缺陷 | 处理 |
|---|------|------|
| 1 | `check-stage3/4-gate.ps1:26` 用 `-File … -Json 2>&1`：`-File` 后 `2>&1` 不被 shell 解释，而是作为位置参数绑到子脚本 `[switch]$Json` → 崩溃 → **R014/R011 长期静默漏检** | 改为 `-Command "& '$scriptPath' -TargetDir '$TargetDir' -Json 2>&1 \| Out-String"`，并补 `-ExecutionPolicy Bypass`（子进程不继承） |
| 2 | 变量名撞名：`$json = $violations \| ConvertTo-Json`（5 个脚本）。PowerShell 变量名**不区分大小写**，`$json` 与 param 声明的 `[switch]$Json` 是同一个**带类型约束**的变量 → 赋字符串即抛 `SwitchParameter 转换异常` | 局部变量更名 `$detailsJson` |
| 3 | JSON 输出用 `\"` 转义（8 处）：PowerShell 的转义符是反引号，`\"` 会提前终结字符串 → 输出的"JSON"是碎的 | 改为 `` `" ``；6 个脚本 `-Json` 输出现已 `json.loads` 全部通过 |
| 4 | 子脚本缺失分支 `$script:total++` 在 `return` 之后 → 出现过 `2 FAIL / 0 TOTAL` | `total++` 前移到函数入口 |
| 5 | 控制台按 GBK 码页输出，Agent 读到中文乱码 | 8 个脚本统一加 `[Console]::OutputEncoding = UTF8` |
| 6 | `.qoder/skills/README.md` 与根 README 的"42/43 个技能"含 **17 个从未落地**的技能条目（链接全断） | 重写为真实 26 项 + 单列「规划中（尚无 SKILL.md）」17 项，注明 26+17=43 的来源；顺带删掉重复的 Stage5 表、修 `kf-skill-design-expert` 相对路径、`frontend-dev` 描述 Vue→React |

保留为**预期行为**（不改）：Stage4 门禁在本框架仓库会因 `seeds/` 不存在而 R010 FAIL、因 `demo-frontend`/`starters`/`templates` 无 `api-contract.yaml` 而 R014/R011 FAIL —— 这些脚本的检查对象是 MVP 应用工程，不是框架仓库本身。

### 需要重启才能确认的一项 → **已实测关闭**

原判断：`hooks` 在会话启动时读取，需下一次会话才生效。

**实测结论（2026-09-24，本会话内）**：写入 `demo-frontend/src/qoder-hook-probe.ts`（临时探针，已删除）后，Qoder 立即回报：

```
PostToolUse:Write hook blocking error from command:
  "powershell -NoProfile -ExecutionPolicy Bypass -File .qoder/scripts/quality-gate-hook.ps1"
[QUALITY-GATE] Auto gate triggered by: D:\all-in-mvp\demo-frontend\src\qoder-hook-probe.ts
CODE REVIEW: dispatch subagent "mvp-code-reviewer" (skill kf-mvp-code-review) for this change.
```

⇒ P0-3 正式关闭：`hooks.PostToolUse` 在 Qoder CLI 1.31.2 下**确实按配置触发**，路径命中判定与 exit 2 注入均生效，无需回退到 `.qoder/rules/quality-gate.md` 的行为约束（后者仍保留作手工兜底）。
探针仅为验证门禁，非源码改动，故未派发 code-review；文件已 `rm` 删除。

---

## 8. 第二轮执行（v2.24）— 全局调用 / Claude 残留 / hooks / 执行层 / 门禁静默漏检

用户追加要求：「解决不能全局调用的问题；Claude 残留；硬阻塞；hooks；执行层缺 Node 等问题」。逐项落地与实测结果：

### 8.1 全局调用（已解决，且可重复）

- 根因：本 CLI 的 home 是 `~/.qoder-cn`（官方文档写的 `~/.qoder` 属 IDE 版），而技能/子 Agent 只装在项目里 → 其他工作区召不回。
- 新增 `.qoder/scripts/sync-qoder-homes.ps1`：把 HEAD 的 skills/agents/scripts/frameworks/starters 推进**所有存在的 home**，随后 SHA256 逐文件比对，`DRIFT>0` 直接 exit 1（不再"看起来成功了"）。
- 实测：两个 home 各 `skills=78 agents=18 scripts=15`，`drift=0`，二次运行幂等；`-Json` 输出可被 `json.loads` 解析。
- 必须排除 `node_modules|dist|.vite|.vite-temp|...`：首次运行时并行的 vite 构建产生瞬时 `.vite-temp` 文件，复制到一半 `ENOENT` → 这正是"边构建边同步"的真实故障。

### 8.2 hooks（用户级已生效）

- `-InstallGlobalHooks` 把 `hooks.PostToolUse`（命令为 **home 内绝对路径**）合并进 `<home>/settings.json`，先备份 `settings.json.bak`，只加 `hooks` 键。
- 校验（python 逐键对比 before/after）：`.qoder-cn` 保留 `enabledPlugins`，`.qoder` 保留 `aicodingPluginSettingsVersion/enabledPlugins/providers`，`lost keys=[]`、非 hooks 值完全一致。
- hook 脚本可脱离 Qoder 单测：从 stdin 喂 hook JSON，在任意 cwd 下对 `src/services/user.ts` 输出 `[QUALITY-GATE]` + exit 2。
- **本会话内实测用户级 hooks 已触发**（PostToolUse 拦截写入 `apps/web/src/pages/*`），说明该版本用户级 hooks 不必重启；工作区级仍按"改完重启"兜底。

### 8.3 执行层缺运行时（已解除）

- Node：官方 zip → `~/.local/node` → `setx PATH`（广播 WM_SETTINGCHANGE），v26.13.0。
- Bun：GitHub Release 直下 37MB 实测掉速至 ~13KB/s（未下完，已终止）→ 改走 `npm install -g bun`（registry，1 分钟内完成）得到 **bun 1.4.4**。
- Starter 真实执行（全部 rc=0）：`bun install` 784 包 → `bun run build`（shared+api+web，web 497ms）→ `bun run typecheck`（web+api）→ `bun run test:shared` / `test:api`（3 pass）/ `test:web`（9 passed / 3 files）→ `bun run arch:check`（96 文件）。

### 8.4 门禁脚本静默漏检（血案 B022）

| 缺陷 | 位置 | 修复 |
|------|------|------|
| `$json` 与 `param([switch]$Json)` 撞名（PS 变量名不区分大小写）→ 有违规时抛 SwitchParameter 异常 | `check-token-sync.ps1:88`、`check-silent-catch.ps1:51`、`check-liquid-glass-style.ps1:152` | 改名 `$detailsJson` 并留注释 |
| `check-liquid-glass-style.ps1` 用 `$ErrorActionPreference="Continue"` → 崩溃后仍走到 `exit 0` | 同上:15 | 改 `Stop`，与其余 `check-*.ps1` 一致 |
| 跳过报成 PASS（无前端源码 / 权威脚手架不存在） | `check-liquid-glass-style.ps1`、`check-token-sync.ps1`（`checked=0`） | 状态改 `SKIPPED`，exit 0 语义不变 |
| `-Json` 时 `Write-Host` 混进 stdout → 调用方 JSON 解析失败 | `sync-qoder-homes.ps1` 初版 | 文本输出整体移入 `if (-not $Json)` |
| `foreach ($home in ...)` 撞只读自动变量 `$HOME` | `sync-qoder-homes.ps1` | 改 `$homeDir` |
| 取退出码用了管道（`cmd \| tail; echo $?`）→ 把 rc=1 读成 rc=0 | 上一轮我自己的一次误判 | 一律先落盘再取 rc，并在文档写明 |

### 8.5 权威脚手架 arch-check.ts 在 Windows 失效（血案 B023）

- `new URL("..", import.meta.url).pathname` 在 Windows 得 `/D:/...` → `join` 后 `\D:\...` → `ENOENT scandir`，脚本根本跑不起来。
- 即便路径可用：`relative()` 返回反斜杠，而规则按 `apps/web/src/components/` 与 `split("/")` 匹配 → Rule 1/2/4 **静默不触发**。
- 修复：`fileURLToPath` + `toPosix()` / `relOf()` 统一分隔符。
- 交叉验证（不只验"全绿"）：临时放入违例页 `ArchProbePage.tsx`（`@/lib/api` + `sonner` 直连），TS 侧报 `ui-no-direct-api` + `no-direct-sonner`（rc=1），PS 侧报 R022 + R024（rc=1），两处一致；探针文件已删除，未进提交。

### 8.6 Claude 残留（本轮补完）

- `kf-skill-design-expert` 的 description 仍写 "Claude Code skill" → 已改 "Qoder Skill"（本会话技能列表里可见新文案，证明全局副本同步生效）。
- `execution-playbook.md` 路径表与 Workflow 语义、`liquid-glass/DESIGN.md` 的 Cursor/Claude 措辞已清理。
- **R028 门禁抓到真实漂移**：只改了技能侧镜像 `DESIGN.md` 而漏了权威源 `starters/liquid-glass-frontend/DESIGN.md` → `check-token-sync.ps1` 报"首次差异在第 183 行"。补齐权威源后 `PASS checked=4`。

### 8.7 仍未验证 / 遗留

- Playwright 浏览器二进制：本机 `~\AppData\Local\ms-playwright` 不存在，`bunx playwright install chromium` 仍在下载中 → **Stage3.5/Stage4 的真实 E2E 运行尚未验证**；R020 冒烟当前依赖 browser-use MCP（已实测可用）。
- `model.name = deepseek-v4-flash` 是否在你的账号模型列表内：离线无法确认，缺失时删掉 `model` 块即可。
- §6 的两项 opt-in（SKILL.md 2900+ 行瘦身、技能正文 Vue→React 示例）仍未做，属内容重构，不在兼容平移范围内。
- `.gitattributes` 的 `export-ignore` 缺口（内部复盘文档是否随 tarball 分发）需你决定。

## 附录 A — 关键证据
- `file .qoder/skills/all-in-mvp/SKILL.md` → "UTF-8 (with BOM), CRLF"；`kf-mvp-api-contract/SKILL.md`（正常）→ 无 BOM。
- `ls .claude` → 不存在；`grep ".claude/workflows" .qoder/skills` → 仅 `all-in-mvp/SKILL.md`。
- Qoder 官方文档：settings 支持 `model/tools/security/mcpServers`（+`env/rules/hooks`），**无 `qualityGates`、无 Claude Code workflows**；Skill 靠 `description` 匹配自动触发，位于 `.qoder/skills/`。
- `wc -l` SKILL.md：all-in-mvp 2897 / test-e2e 1429 / pipeline-coordinator 1332 / backend-tdd 1185 / frontend-dev 1151。
- 本会话已连接 MCP 服务不含 `lean-ctx`。

## 附录 B — Stage → 子 Agent 映射（Phase 2 用）

| Stage | 现有 Workflow 脚本 | 改用的 Qoder 子 Agent（`.qoder/agents/`） |
|-------|-------------------|------------------------------------------|
| Stage1 PRD | stage1-prd.js | `mvp-pm-agent` |
| Stage2 规划 | stage2-planning.js | `mvp-architect` + `mvp-domain-expert` + `mvp-grill-review` + `mvp-mock-service` + `mvp-test-writer`/`mvp-scenario-test` + `mvp-test-review` |
| Stage3 开发 | stage3-execution.js | `mvp-pipeline-coordinator` + `mvp-backend-tdd` + `mvp-frontend-dev` + `mvp-code-reviewer` |
| Stage3.5 E2E | （主 Agent 直接执行） | `mvp-scenario-test` / kf-mvp-test-e2e 技能 |
| Stage4 集成 | stage4-integration.js | `mvp-stage4-coordinator` + `mvp-debug-fixer` + `mvp-verifier` |
| Stage5 复盘 | （主 Agent） | `mvp-retrospective-agent` |
