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
| skip 分支缺 `-Json` 版本 → `[SKIP]` 文本混进机器可读输出；`$matches` 撞自动变量 | `check-api-path-source.ps1:26/35/20` | 两个 skip 分支补 `{"status":"SKIPPED",...}`；`$matches` → `$contractMatches` |
| 全仓自动变量撞名扫描（`^\s*\$(Matches|Home|Host|Input|Error|PSItem)\s*=`）| `.qoder/scripts/*.ps1` + `starters` | 除上述两处外无命中 |
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

## 9. 第三轮执行（v2.25）— 借鉴权威仓库 T1 + 门面技能注册失效（血案 B024）

> 输入：内网 GitLab `<已脱敏>/starters/liquid-glass-starter`（只读克隆到临时目录，HEAD `167e561`）。
> 与我们的 `starters/liquid-glass-frontend` 同源：后者是它 2026-07-16 的快照 —— 179 个同名文件，97 个只在他们那边，41 个同名文件已分叉。
> 本轮按你的要求只做 T1（通用、且不依赖 T2 能力的那一档），T2/T3 只登记不动手。

### 9.1 修掉的 bug：门面技能根本没注册成功（血案 B024 → R029）

- `.qoder/skills/all-in-mvp/SKILL.md` 的 `description` 是 plain scalar，值里含 `Triggers: MVP, …` / `NOT for: …` → 严格 YAML 解析报 `mapping values are not allowed here`，**整块 frontmatter 作废**。
- 全仓 46 个 frontmatter 用 `uv run --no-project --with pyyaml` 逐个严格解析，只有这一个 FAIL —— 恰好是门面技能。
- 后果不对称：App 侧技能列表会 omit 它，Agent 侧加载器仍按文本激活它，所以"能调到"一直掩盖着"没注册"。
- 修复：`description: >-` 折叠块（16 个触发词逐一 round-trip 校验，长度 304，无 BOM）；`sync-qoder-homes.ps1` 同步两个 home，home 副本复查亦为 OK。

### 9.2 新增门禁 R029（可执行 + 声明盲区）

| 项 | 内容 |
|----|------|
| 脚本 | `.qoder/scripts/check-skill-frontmatter.ps1`（无外部依赖，纯行级结构扫描；`-Json` / `-IncludeHomes`） |
| 拦什么 | plain scalar 含 `": "`、引号未闭合、Tab 缩进、UTF-8 BOM、frontmatter 未闭合、`name`/`description` 缺失、保留指示符开头 |
| 注册 | `gate-rules.yaml` R029（BLOCKER，stage3/stage4/fix），盲区 5 条写在 description 里 |
| 接入 | `check-stage3-gate.ps1` / `check-stage4-gate.ps1` 各加一条 `Invoke-Check`（Stage3 由 4 PASS → 5 PASS）；`verify-all-in-mvp.ps1` 新增一行**实际执行**而非查存在；`quality-gate-hook.ps1` 新增 Gate 0 —— 编辑 `SKILL.md`/`agents/*.md` 后**直接跑校验**，失败 `exit 2` 阻断 |
| 有效验证 | 故意写坏一个临时技能 → hook 当场 `[QUALITY-GATE][R029 FAIL] exit 2`（不是只验全绿，见 B022/B023）； fixture 三连（含 `": "` / 未闭合引号 / BOM）全部命中，正例不误报；`rm` 临时技能后 rc=0 |

### 9.3 同族反向坑：`.ps1` 必须带 BOM，`SKILL.md` 必须无 BOM

新写的 `check-skill-frontmatter.ps1` 第一版无 BOM → PowerShell 5.1 按 ANSI 码页读，中文注释吞掉字符串定界符，整个脚本语法报错。全仓审计 `check-*.ps1`：含非 ASCII 的脚本一律带 BOM，`quality-gate-hook.ps1` 因全 ASCII 才可无 BOM。规则写入 R029 的"同族坑"提示与 PLAYBOOK B024 教训④。

### 9.4 starter T1 移植（ESLint 治理层）

| 移植项 | 落点 | 说明 |
|--------|------|------|
| 自定义规则 | `eslint-rules/no-tailwind-raw-colors.js`（新）、`no-raw-viewport-check.js`（新）、`no-toisostring-slice.js`（补盲区） | 每条 JSDoc 带 Rationale / Correct alternatives / **Known blind spots**；替代物逐条核对本仓真实存在（`tag-red/green/blue/purple`、`badge-active/inactive`、`--data-success`、`useIsMobile`），并修掉"提示指向不存在函数"的坑：补上 `formatDate` / `getLocalDayBoundaryISO` |
| 规则测试 | `eslint-rules/*.test.js` × 3，28 用例（`bun test eslint-rules/`，已串进 `bun run test`） | 含把"同串多个违规只报一条"这类**静默漏报**当 bug 修（改 `matchAll`），而不是放松测试 |
| 配置分层 | `eslint.config.js` | UI 作用域 `error` + 三个错误页的**带理由永久豁免**；`reportUnusedDisableDirectives: 'error'` 作豁免棘轮；`globalIgnores(['**/dist'])`（裸 `dist` 只匹配配置目录，`apps/*/dist` 会被当源码扫） |
| lint 覆盖面 | 根 `lint`/`lint:fix` 串 web+api+shared | 立刻抓到长期漏网的 `packages/shared/src/index.ts` export 排序错误（此前根 lint 只跑 web） |
| 存量违规清理 | `kpi-card.tsx`、`OverlaysPage.tsx` | `text-emerald-500`→`text-[var(--data-success)]`、`text-red-500`→`text-destructive`、`className="text-red-400"`→`variant="destructive"` |
| 工程纪律 | `starters/liquid-glass-frontend/AGENTS.md` | 新增 Architecture Gates（ESLint vs arch:check 分工 + 棘轮）、Enum Values、Date & Time、Testing 分层表、Verify After Every Change；只写本仓真实存在的能力 |

### 9.5 独立审查与真实浏览器冒烟（R020/R021）

- `mvp-code-reviewer` 独立审查结论 **PASS**，0 BLOCKER / 0 HIGH，4 条 LOW；其中 L1/L2（规则作用域只覆盖 `.tsx`、`window[\`innerWidth\`]` 与参数解构两条盲区未声明）已补进 JSDoc，L3/L4 记录在案。
- 真实浏览器（browser-use MCP，`bun run dev` web:5173 + api:3000，admin 登录）：
  - `/dashboard` 4 个 KpiCard 趋势元素计算色 `rgb(34,197,94)`（= `--data-success`）与 `rgb(186,26,26)`（= `--destructive`），涨绿跌红正确；
  - `/components/overlays` 对话框内 2 个必填星号 `rgb(186,26,26)`，5 个控件均有正尺寸；DropdownMenu 打开后"移除成员"`rgb(186,26,26)`、其余两项保持 `rgb(25,28,30)`（`variant` 走的是 `data-[variant=destructive]`，图标与焦点态一并生效）；
  - console 无 error（仅 vite 连接与 React DevTools 提示）。
- Starter 四件套复跑：`bun run lint` rc=0（0 error / 15 条存量 jsx-a11y warning）、`typecheck` rc=0、`test` rc=0（28 规则 + web 17 + api 3 + shared passWithNoTests）、`arch:check` rc=0（96 文件）。
- 环境自检：`verify-all-in-mvp.ps1` → **20 PASS / 0 WARN / 0 FAIL**（含新增 R029 行）。

### 9.6 未做（明确留在 T2/T3，不是遗漏）

- T2（依赖我们脚手架里没有的能力，硬搬会变成死代码）：TanStack Query 数据层与 `query-keys` 体系、`OpCtx`/审计/权限注册表、`ResponsiveDialog`/`MobileCard`/`StatusBadge` 等响应式原语、6 主题色系统与 `ThemeColorPicker`、`usePagedList`。
- T3（不该进 MVP 脚手架）：`audit_logs` 表与审计写穿、dnd-kit 拖拽、权限树业务页、GitLab SSH 部署、Go/Kotlin 模板。
- 我们**领先**的两项，无需回搬：`arch-check.ts` 的 Windows 修复（对方仍是 `URL.pathname` + 反斜杠 `relative()`，Rule 1/2/4 在 Windows 静默不触发）、Claude 残留清理。
- 对方 ROADMAP 自己标 E2E 为 `🔲 待做 (P0)`，且 `useAsyncData` 已被他们标为 Breaking Change 移除（我们仍在 `apps/web/src/hooks/useAsyncData.ts` 使用）→ 不跟。
- Playwright 二进制本轮已在（`ms-playwright\chromium-1248`，`verify-all` 由 FAIL 转 PASS），但**一次真实 E2E 运行仍未执行**（遗留项 #9）。


## 10. 第四轮执行（v2.26）— 全量同步权威 starter + 门禁被真实代码反向校准 + 锁定"去前后端分离"

> 输入：内网 GitLab `<已脱敏>/starters/liquid-glass-starter`，HEAD `167d77c`（上一轮基线是 `167e561`）。
> 你的指令：「不必前后端了。但要达到前置可交互检查正常分支和异常分支；从权威 starter 拉最新版本，我现在优势的地方保留。」
> 本轮只做"拉最新 + 保留优势"，方向改造（#19）另起增量，不与同步混在一个提交里。

### 10.1 同步做法：按文件三方比对，不是盲覆盖也不是盲挑选

我们 starter 的真相对方是**导入快照** `04d5279b`（2026-07-16 同源），因此每个同名文件按三方判定：

| 判定 | 处理 |
|------|------|
| 对方改、我们没改 | 取对方（新版为准） |
| 我们改、对方没改 | 保留我们（优势不丢） |
| 双方都改 | 逐文件人工合并（如 `DESIGN.md`：拿对方新版，再重贴我们的 `(Qoder subagents such as mvp-frontend-dev…)` 措辞） |
| 只有对方有 | 新增（除非属明确排除项，见 10.3） |
| 只有我们有 | 核对是否已被对方以别的形式取代，取代则删 |

落点规模（`starters/liquid-glass-frontend/`）：**96 新增 / 10 删除 / 86 修改**。删除的都是被取代物：`apps/api/{src/routes,data,drizzle,sqlite.db}`（对方迁到 `src/modules` + 单份 `init.sql`）、`apps/web/src/hooks/useAsyncData.ts`（对方已标 Breaking 移除，被 TanStack Query 取代）、3 个 `src/**/__tests__/` 目录（对方改为测试同目录 colocation）。

### 10.2 需要更正的自我判断：我们上轮宣称"领先"的 4 项，有 3 项对方已独立采纳

`no-toisostring-slice`、`no-tailwind-raw-colors`（基础版）、`no-raw-viewport-check` 这 3 条规则，对方在同一时间窗内自己写了，实现基本一致。上一轮 §9.6 把它们记为"我们领先、无需回搬"是错的判断——真实差集只剩下面 4 项（都保住了）：

| 真实优势 | 证据 |
|----------|------|
| `scripts/arch-check.ts` Windows 路径修复 | 对方仍是 `URL.pathname` + 反斜杠 `relative()`，在 Windows 上 Rule 1/2/4 会 ENOENT/静默不触发；本轮重贴我们的 `fileURLToPath` + `toPosix` |
| `no-tailwind-raw-colors` 全量上报 | 对方用 `RAW_COLOR_RE.exec` → 一行多个违规只报 1 条；我们用 `matchAll` 报全部。对方的规则测试恰好把这条"静默漏报"测出来（期望 2 得 1）→ 保留我们版本，36/36 通过 |
| 4 条规则的 `Known blind spots` JSDoc | 对方实现相同但注释较薄；保留我们的盲区说明，作为 R032/R033/R034 的声明依据 |
| 规则测试覆盖 | 本轮补 `no-service-import-in-ui.test.js` → `eslint-rules/` 5 个规则文件全部有测试，49 用例 |

结论写成教训：**"我们领先"必须逐文件比对后才可声称**，凭上轮记忆声称会带出错误决策（同族见 B025）。

### 10.3 有意不带回来的东西（不是遗漏）

`skills/wecode-project-scaffolder/`（16 文件 / 2092 行）——我们在 `526d4da2` 主动删除过，本轮同步时继续保持排除。对方那侧同期把 `scripts/scaffold.ts` 扩了 +291 行并加了 Go/Kotlin/Taskfile 模板；要不要重新引入是你的决策，见 10.7。

### 10.4 反向校准：真实代码把我们的门禁打出了 4 次误报（血案 B026）

同步后 Stage3/Stage4 回归 FAIL，根因不是业务代码，而是 R015 把对方的资源拆除惯用法 `body?.cancel().catch(() => {})` 当"静默吞错误"。处理方式：修门禁，不改业务；给拆除类调用一条**具名**白名单（`cancel|abort|close|destroy|releaseLock|return`），并用 4 行探针证明校准（业务行仍在 :2 命中 FAIL，两行拆除惯用法被豁免）。

同时把 R015 从"整文件一次 `if` + 只报首行"改成逐行扫描（一处违规一行报告）。教训登记 `PLAYBOOK.md` B026：**只在自家代码上验证过的门禁等于没验证过**。

### 10.5 另一条血案：假"已清零"活了两个回合（B025）

上轮我声称"全仓 `$matches`/自动变量遮蔽已清零"，实际扫描正则大小写敏感，而 PowerShell 变量名大小写不敏感 → 3 处小写写法（`check-api-endpoints.ps1:24/49`、`check-api-path-source.ps1:54`）漏网。本轮：全部改为 `$regexMatches`；扫描改成大小写不敏感并**升级为 `verify-all-in-mvp.ps1` 的可执行行**，不再靠口头声称；`check-silent-catch.ps1` 里的死变量 `$lineNum` 与恒等于第一条分支的第二个 `if` 一并清掉。教训：**"现在不报错" ≠ "没踩自动变量"**；清洁性声明必须是门禁，不是 grep 结果。

### 10.6 本轮新增/接入的门禁（`gate-rules.yaml` 31 → 34 条）

| 规则 | 级别 | 拦什么 | 来源 |
|------|------|--------|------|
| R032 | HIGH | UI 层禁止 value 导入 `services/`（`no-service-import-in-ui`），服务端状态必须走 `hooks/queries/*`；4 条盲区已在测试里钉为 valid | 对方新规则 + 我们补的测试 |
| R033 | BLOCKER | 导出函数首参调审计必须 `OpCtx`（`no-audit-fn-without-opctx`）；对应真实事故 `requestId: ""` | 对方新规则+测试 |
| R034 | BLOCKER | `no-restricted-syntax` 禁绕过注册表直调 `writeLog`/`hasPermission`（盲区按实际 esquery selector 写） | 对方配置 |

三条都追加进 `gates.stage3 / stage4 / fix`。框架侧脚本同步适配新布局：`quality-gate-hook.ps1` Gate 2 路径新增 `apps/api/src/(routes|modules|shared)` + `packages/shared/src/`（`routes` 保留以兼容历史项目）；`verify-all-in-mvp.ps1` 新增两行**实际执行**——R022–R026 风格门禁以 `-TargetDir starters\liquid-glass-frontend` 跑（输出含 SKIPPED 记 WARN），以及上面的自动变量遮蔽扫描。

### 10.7 框架知识对齐 starter（避免技能教出旧写法）

`kf-mvp-frontend-dev/SKILL.md`：测试布局从 `src/__tests__/{components,pages,e2e}` 改为同目录 colocation（`DataTable.test.tsx`、`vi.mock("@/lib/api")`），仅 FT3 保留在 `e2e/`。`kf-mvp-react-components/SKILL.md` §8：删掉 30 行 `useAsyncData` 自研 hook（对方已 Breaking 移除），换成 `useCustomers`（`useQuery` + `queryKeys.customers.list(params)`）与 `useCreateCustomer`（`useMutation` + `invalidateQueries` + `onError: showError`），并补消费方式/分页/R015 说明。R028 设计 token 镜像重新同步（`DESIGN.md` + 3 个 css）。

### 10.8 验证（全部真实执行，退出码取自文件）

- Starter：`arch:check` rc=0（扫描 125 文件）、`lint` rc=0（0 error / 19 条存量 jsx-a11y warning，三包）、`test:eslint` rc=0（49/49，5 文件）、`test:web` rc=0（270 用例 / 32 文件）、`test:api` rc=0（195 pass / 0 fail）、`typecheck` rc=0。
- 框架：`check-token-sync.ps1` PASS（比对 4 文件）、`check-skill-frontmatter.ps1` PASS（46 文件）、R022–R026 风格门禁对 starter PASS（125 文件）、Stage3 **rc=0**（5 PASS / 0 FAIL）、Stage4 6 PASS / 3 FAIL —— 三条 FAIL 是 R010（框架仓无 `seeds/`）、R011（框架仓无 `.env`，且 `templates/e2e/playwright.config.ts` 的示例端口）、R014（拿框架仓的 `api-contract.yaml` 去校验 starter 前端服务层），都是"门禁跑在错的对象上"，不是代码缺陷；`verify-all-in-mvp.ps1` **22 PASS / 0 WARN / 0 FAIL** rc=0。
- 未验证项照旧：真实 Playwright E2E 一次运行仍未执行（#9）。

### 10.9 待你决策（已在推送前停住，未动手）

1. **内部引用清洗**：内网 GitLab 主机 git URL、内网测试机 `IP:11070`、`wecode-cloud` registry、`~/.claude`/`.gemini` 路径。证据：这些在**本轮同步之前就已存在**（同步前 starter README 10 处、`.gitlab-ci.yml` 9 处），但本轮把它们放大了（新增 `ci-tools/`、`compose.self.yml`、`deploy.sh` 等）。GitHub 是公开仓，推送前需要你定清洗边界还是只推框架层。
2. `skills/wecode-project-scaffolder/` 是否重新引入（见 10.3）。
3. 同步带入的 `change-password` 缺陷怎么处理（见 10.11）。
4. 方向改造 #19：见下。

### 10.10 锁定的方向（下一增量，本轮未改流水线）

你已定：**不做前后端分离**。理由是 Mock 不是技术必需，而是"前后端分派"这一调度形态的产物；分离真正不可替代的是「并行分派 + 可门禁的显式契约」，而契约可以由 `packages/shared` 的 Zod schema 单一定义承担（同仓类型贯通），从而消掉第二真相源。原型确认这一收益不丢，改由对方已上线的机制承担：`DEMO_MODE` + 幂等 `demo-seed` + dev-only 造数/重置端点（`POST /notifications/dev/push`、`POST /notifications/dev/reset`，非 development/test/DEMO_MODE 一律 404）——这正好是"前置可交互检查异常分支"的落点，且对方 starter 里没有任何独立 mock 层（只有测试内 `vi.mock`），与我们要走的形状一致。

落到流水线的改动（#19）：Stage2 的 `api-contract.yaml + mock` 收敛为 `packages/shared` Zod + `init.sql` + `demo-seed` 单定义；Stage3 前后端两个 agent 合并为按模块的纵向切片（模块间仍并行）；Stage4/MSVP 升级为**正常分支 + 异常分支双清单**的前置可交互硬门禁。涉及 `all-in-mvp/SKILL.md`（Stage2/3/4/MSVP 段落）、`kf-mvp-mock-service`、`mvp-mock-service.md`、`mvp-verifier.md`，以及依赖契约文件的 R002/R012/R014。

本轮拿到一条支持该方向的实证：R014（前端调用路径必须在 `api-contract.yaml` 里存在）对同步后的 starter 报了 6 条违规。逐条核对后 **5 条是假阳性、1 条是真 bug**：`/auth/login`、`/users/me`、`/notifications`、`/notifications/unread-count`、`/notifications/read-all` 都是 starter 后端真实存在且有测试覆盖的路由（`/auth`、`/users`、`/notifications` 三个 route 挂在 `apps/api/src/index.ts:90-92`），只是因为框架仓的 `api-contract.yaml` 是我们自己 demo 的契约，才被判成"Agent 自创端点"。也就是说：契约一旦作为独立文件存在，它就开始与代码漂移，而门禁只能把漂移读成违规。把契约定义收进 `packages/shared` 的 Zod schema（类型即契约、门禁读同一份）是这类假阳性的根因修复，不只是少一个文件。

第 6 条 `/api/auth/change-password` 是真问题，见 10.11。


### 10.11 同步带入的一个真实缺陷（未擅自修改，等你定）

`apps/web/src/services/auth.ts:24` 的 `changePassword()` 是对方新增的（`ProfileSettingsPage` 的"修改密码"入口调用它）。两个独立错误叠在一起：

1. **路径重复前缀**：`api` 实例的 baseURL 已是 `/api`（`apps/web/src/lib/api.ts:13`），这里又写了 `/api/auth/change-password` → dev 下实际请求 `/api/api/auth/change-password`，Vite 代理剥掉一层后打到后端的 `/api/auth/change-password`。同文件里 `login()` 写的是 `/auth/login`，两种写法并存。
2. **后端根本没有这个路由**：`apps/api/src/modules` 下只有 auth（`/login`、`/refresh`）、user（`/me`）、notification 三个模块，全量枚举注册路径没有任何 `change-password`。

真实运行验证（起 `bun run src/index.ts`，端口 3000，curl 实测，非静态推断）：

| 请求 | 状态码 |
|------|--------|
| `POST /auth/change-password` | **404** |
| `POST /api/auth/change-password` | **404** |
| `POST /auth/login`（对照组） | 400 `VALIDATION_ERROR`（路由存在，进到了 Zod 校验） |

而 `bun run test:web` 的 270 个用例全绿，包括 `apps/web/src/services/auth.test.ts:41`「changePassword 调用正确的 API 路径」—— 它 mock 掉 axios，断言的是 `toHaveBeenCalledWith("/api/auth/change-password", input)`，把错误字面量钉死当"正确路径"。这是 AGENTS.md 规则 9 的教科书写法：**测试验的是 WHAT（传了什么字符串），不是 WHY（后端接不接）**。

对 #19 的直接含义：这个缺陷 Mock 层永远抓不到 —— mock 是按前端期望写的，前端要 `/api/auth/change-password`，mock 就给 `/api/auth/change-password`，双向自洽、皆大欢喜，真接口上线才炸。能抓住它的只有"前置到真实后端跑异常分支"。所以它既是同步的产出，也是新方向的第 0 个测试用例。

处理方式（需要你选，我没有擅自改）：a) 只报对方，我们保持与权威 starter 一致；b) 我们侧先修（把路径改对需要后端补路由，属于新增业务功能，不是改一行）；c) 我们侧至少把这个错误字面量的测试改成会失败的断言，避免技能/Agent 抄到错误范式。默认建议 a + c 的轻量版：不改业务功能，只在门禁层拦"前端调用路径必须能在后端路由枚举里找到"。


---

## 11. 第五轮执行（v2.27）— 权威 starter 重大更新二次同步 + 领先项逐条实证

**上游范围**：`167d77c..0005fa1`，9 commits / 93 files / **+14945 −873**。提交 `6858aed1`（分支 `qoder-migration`，未推送）。

### 11.1 对方这次带来了什么（我们原先没有的能力）

| 能力 | 落点 | 对我们流水线的意义 |
|------|------|-------------------|
| 业务模块一键生成器 `gen:module` | `scripts/gen-module.ts`（4457 行）+ `.test.ts`（747 行，含真实锚点断言）；注册位置靠源码 `[gen:module:*]` 锚点定位 | 纵向切片的"骨架"不再由 Agent 手写，#19 的切片产出可以直接从这条命令起步，漂移面收窄到字段与业务规则 |
| AST 架构门禁 + **450 行棘轮** | `arch-check.ts` 的 `MAX_LINES` / `LONG_FILE_RATCHET`，四种失败态 `overlong-ratchet-{exceeded,stale,unlowered,missing}`；scaffold 侧 `pruneMissingLongFileRatchet()` 剪枝 | "切片太大"变成可执行判据，而不是复盘时才发现的抱怨 |
| `shared/oss.ts` 双模对象存储 + `shared/sqlite-ops.ts` | 三键同时配置才走 OSS，否则本地降级；stats / `VACUUM INTO` / 热备 | 造数与演示环境不再需要假 SDK；生产/演示同一份代码路径 |
| 只读审计 API + 三态 Diff | `modules/log`（`GET /logs`，需 `audit:view`）+ `AuditDiffViewer` | 异常分支走查有了可核对的现场证据 |
| 前端权限体系统一 | `usePermission` / `PermissionGate` / `menu-config.ts` 按 `user.permissions` 过滤，`permissionsForRole` 只在后端解析 | 消灭"前端自行推导角色"这第二真相源（已固化为 R038） |
| 5 要素规格书模板 + `business-feature-builder` 技能 + `WORKFLOW.md` | `docs/specs/_template.md` 等 | 与 #19 的"正常/异常双分支清单"天然对齐，可直接作为清单载体 |
| 3 个 **flat-config 集成测试** | `eslint-rules/{api-oss-import-guard,route-db-guard,web-permission-import-guard}.test.js` | 加载真实 `eslint.config.js` 用 `Linter.verify` 断言"配置块 + 内置规则 + selector"的组合行为——正是 B026 教训的制度化：门禁自己也要被门禁 |
| README 重写（+1078 行） | — | 我们 v2.25 补的治理文案被对方更完整的版本覆盖，如实让位（见 11.3） |

### 11.2 三方合并做法（不是覆盖，是逐文件比对）

以我们自己的导入提交为 base，对每个文件三方比对：对方新增 96 / 删除 10 / 修改 86。取对方树后手工还原领先项，并排除 `skills/wecode-project-scaffolder`（内部交付工具，不属于本仓）。

还原的领先项（3 个 ESLint 规则的 JSDoc 与指针、`DESIGN.md` 的 Qoder 措辞、以及下面两个必须重打的 Windows 补丁）：

1. **`arch-check.ts` 路径处理**（上游新版把这个问题带回来了）：
   ```ts
   import { fileURLToPath } from "node:url"
   const ROOT = fileURLToPath(new URL("..", import.meta.url))   // URL.pathname 在 Windows 得 "/D:/..." → join 后 "\D:\..." → ENOENT
   const toPosix = (p: string) => p.replace(/\\/g, "/")
   const relOf = (base: string, target: string) => toPosix(relative(base, target))
   ```
   Rule 1 的文件键、Rule 4 的 `pageFile.split("/")`、`pathHint`、棘轮白名单比对全部改走 `relOf`。
   **实测证据**：同一目录 `bun` 脚本跑 `new URL("..", import.meta.url).pathname` → `ENOENT`，`fileURLToPath` → 正常列 16 项。
   特别注意 **Rule 4 的静默失效**：Windows 绝对路径 `split("/")` 返回 1 个元素，循环体一次都不进，扫描"通过"但其实什么都没查——典型的 B025 类假绿。
2. **`no-tailwind-raw-colors.js` 全量上报**：保留对方新增的 250 行规则本体，把 `exec` 循环换回 `matchAll`，并加了一条回归用例（同一 `className` 内两个原色类必须报 2 次）。实测 `exec` 写法漏报。

### 11.3 如实让位的部分

我们 v2.25 写进 starter README / AGENTS.md 的治理段落，被对方本轮的扩写版本覆盖——对方写得更完整且已在 CI 上跑。按"兼容性平移、不擅自重写"的既定约束，**接受对方版本**，不再保留我们的措辞。这不是失去领先，而是原本那点领先已被对方吸收并超越（同 §10.2 的教训：上一轮宣称的 4 项领先有 3 项对方已独立采纳）。

### 11.4 实测验证（全部真实执行，非声称）

`bun install` rc=0（60 pkgs）· `arch:check` rc=0（135 + 28 files）· `typecheck` rc=0 · `test:eslint` 92 用例/8 文件 · `lint` 0 errors / 19 warnings · `test:web` 347/42 · `test:api` 308/26 · `test:scripts` 35/1 · `check-token-sync` PASS(4)。
Playwright E2E 仍未真实跑过（task #9，两侧 CI 都不跑 E2E）。

### 11.5 框架门禁对上权威 starter 的收尾校准（R010 / R011，血案 B029）

首轮 `check-stage4-gate.ps1 -TargetDir starters/liquid-glass-frontend` = 9 条里 **6 PASS / 3 FAIL**，其中 R014 是真缺陷，R010、R011 是我们自己的规则文本把「项目形状」当成了规则本身。

**R011（端口）改了两轮，第二轮才是关键**：

1. 第一轮：`.env` 被 gitignore、提交 `.env.example` 即认可；env 里声明过的端口值（starter 的固定 `PORT=3000`）降为例外清单 → starter 转 PASS。
2. 我拿反例试它：`vite.config.ts` 里写 `port: 5177`（不在任何声明里）→ 仍然 PASS。原因不是例外清单，而是**扫描面写死成六个端口号** `@("3333","5555","2222","5173","3000","3001")`，B009 那类漂移恰好发生在清单之外。这正是 B025/B027 的同一病根：门禁声称覆盖，实际覆盖不到。
3. 第二轮改为扫「端口字面量的形态」（`://host:PORT` 与 `port: PORT`），env 声明值才是例外；同端口同行去重。
4. 四个 fixture 实跑：starter PASS（allowlisted 1，且逐行核对确认扫到的正是 `apps/web/vite.config.ts:55`）· `port: 5177` FAIL · proxy 指向已声明的 3000 PASS · 无 env 文件 FAIL（报"缺 env"而非"0 处硬编码"，避免空覆盖冒充绿）。

**R010（种子单源）重写**：根目录 `seeds/` 从硬要求降为候选定位，改按「账号记录的定义形状」定位种子源；删除 v2.26 后恒不可能命中的 Mock-vs-DB 子检查（空门禁）；新增「非种子文件里 `insert(users)` 带字面量 values」与「init.sql 等派生脚本必须有生成器」两条；多个种子源之间要求存在 import 关系。五个 fixture 实跑：规范单源 PASS · 第二套账号定义 FAIL · 无种子 FAIL · 手写 init.sql FAIL · 两种子源互不 import FAIL。
收紧过程中撞出两个新假阳性，已作数据形态限定并写进「已声明盲区」：i18n 字段标签 `email: "邮箱"`（现限定 ASCII 值）、`scripts/` 下代码生成器里的凭证模板（按产物模板放行，实测 `gen-module.ts`）。

**终局**：`check-stage4-gate.ps1` 对权威 starter = **7 PASS / 2 FAIL，且两条 FAIL 都是真实缺陷**——
R014 孤端点 `/api/auth/change-password`（§11.4/B028）、R010 `apps/api/src/db.ts` 结构自举 inline 插入 admin 与 `apps/api/scripts/seed-dev.ts` 构成两套账号定义。按既定处置原则，**业务代码只报不修**。
`gate-rules.yaml` 的 R010/R011 描述重写并升版 v2.27、`applies_to` 去掉已废弃的 mock-service；严格 YAML 复核：39 条规则、无重复 ID、无未知引用。PLAYBOOK 新增 **B029**，血案 27 → **28** 条。
对照跑框架仓自身（`check-stage4-gate.ps1` 无 `-TargetDir`）= **6 PASS / 3 FAIL，与校准前同数**：R010/R011/R014 会同时扫 `demo-frontend` + `templates` + `starters` 三棵互不相干的树（如 `templates/e2e/seed.ts` 与 starter 的 `seed-dev.ts` 被判成"两种子源"），这是既定事实——这三条门禁的目标是生成的 MVP 应用，不是框架仓。框架仓自身的 R010 命中 `scripts/smoke-test.js` / `scripts/check-e2e-env.js` 里写死的 `admin123`，属真问题，留作后续清理，本轮不动。

---

## 12. 第六轮执行（#19）— 去前后端分离落地：纵向切片 + 前置可交互双分支门禁

**用户锁定方向**（原话）：「不必前后端了。但是要达到前置可交互检查正常分支和异常分支……我现在优势的地方保留。」

### 12.1 论证：Mock 不是技术必需，是调度形态的副产品

前后端分离真正不可替代的是**并行分派 + 可门禁的显式契约**。Mock 只是"两条队列并行"的产物——前端不等后端就得有假接口。把并行度从「前端↔后端」改成「模块↔模块」（纵向切片），Mock 的三个理由同时消失：
契约由 `packages/shared` 的 Zod schema 单一定义承担（同仓类型贯通，`api-contract.yaml` 降为派生视图）；原型确认可用已上线的 `DEMO_MODE` + 幂等 `demo-seed` + dev-only 造数/重置端点承担；对方 starter 里根本没有独立 mock 层（只有测试内 `vi.mock`），形状与我们要走的一致。

**决定性证据（B028）**：权威 starter 的改密功能真实 404，而 270 个前端单测全绿。mock 是按前端期望写的，所以"mock 全绿"在结构上无法证明"被调用方存在"。这类缺陷加多少测试都补不上，只能取消假接口这一档。

### 12.2 落地清单

| 层 | 改动 |
|----|------|
| Stage 2 | 删掉 ③a Mock 阶段；产出收敛为 `packages/shared` Zod + `init.sql` + `demo-seed` + dev-only 造数端点；GATE_PROBE 第 2 行改探 `z.object`；新增「契约单源一致性」「异常分支可造数」两条评审行；明文规定 Stage 2 之后自行搭 Mock = 违规 |
| Stage 3 | 前后端两个 Agent 合并为**按模块纵向切片**（后端 TDD → 前端 hooks/queries → 异常分支造数 → 双分支自测）；`mvp-frontend-dev` 降级为切片内步骤；切片 `DONE` 硬条件＝清单里每条异常分支都能真实复现，否则 `BLOCKED(造数缺失)`；并行度来自模块依赖图分批 |
| Stage 4 | 4.2 重写为「全链路联调 + 双分支可交互门禁」，异常清单固定覆盖 400 逐字段 / 401 / 403 / 404 / 409 / 空态 / 超长与特殊字符 / 5xx 断网；Bug 分类表里「Mock偏差」换成「造数缺失」 |
| MSVP | A 类新增 **A10 异常分支不可复现**；新增 **Step 3.5 双分支可交互走查**（真实浏览器打真实后端） |
| 门禁 | 新增 **R035**（前置可交互双分支，BLOCKER）+ 本轮从对方同步的四条 **R036** route 禁直连 DB / **R037** 业务禁直连 `ali-oss` / **R038** 前端只消费 `user.permissions` / **R039** 450 行棘轮，均写满「已声明盲区」；规则总数 34 → **39**；stage3/stage4/fix 分别 25/35/19 条 |
| R014 脚本 | `.qoder/scripts/check-api-endpoints.ps1` 真相源从 `api-contract.yaml` 改为**后端实际注册路由**（两遍枚举 `app.route()` 挂载前缀 + `app.get/post/...`，`:param` → `[^/]+`，尾斜杠折叠，`/api` 前缀候选剥离）；发现 0 条后端路由时输出 `degraded` + `[WARN]`，**绝不允许静默降级成弱检查** |
| 资产状态 | `kf-mvp-mock-service` 技能与 `mvp-mock-service` Agent 标注废弃（保留文件与历史血案引用，不删），description 加引号规避 R029 的 `": "` 坑 |
| 文档 | SKILL.md 内所有"规定用 Mock"的行清空（残留 6 处全是否定句或历史引用）；PLAYBOOK 新增 B027（5 条规则挂着从不存在的 `check_script`，聚合脚本 SKIP 当绿）与 B028；README 计数更新 R001–R039 / 血案 27 条（§11.5 补 B029 后为 28 条）/ mock 技能废弃注记 |

### 12.3 仍需你决策（未擅自动手）

1. `changePassword` 缺陷：报上游 / 本地补后端路由（属新增业务，不是改一行）/ 只靠 R014+R035 拦。当前选择是**只在门禁层拦，不改业务**。
   → 作者随后改选「本地修」，落地见 §13。
2. 推送前的脱敏边界：内网 GitLab IP git URL、内网测试机 IP:11070、`wecode-cloud` registry、`~/.claude`/`~/.gemini` 路径——本轮同步把它们带进了更多文件；`skills/wecode-project-scaffolder` 是否继续排除在发布树外。
   → 决策为「内网 GitLab IP 涉及到的都要脱敏」，见 §14（进行中）。
3. `gen:module` 是否正式纳入 Stage 3 切片分派（目前是"可用"而非"默认"）。
4. task #9：一次真实 Playwright E2E 运行仍未做。

---

## 13. 第七轮执行（v2.28）— 「本地修」落地：补全密码功能 + 种子单源 + 存量库漂移守卫（血案 B030、B031）

作者对 §12.3 第 1 条改选「本地修」，并对口令方案定了 `process.env.SEED_ADMIN_PASSWORD || dev默认值`。
本轮范围严格限定为两个已点名缺陷**及其必要后果**，不做任何业务内容改写。

### 13.1 缺陷 A：`changePassword` 孤端点 → 按上游自己的延后计划补全

`apps/web/src/services/auth.ts` 的两个错叠在一起（§11.4/B028）：路径多写 `/api` 前缀、后端根本没有该路由。
上游 `auth.service.ts` 头注释里写着"引入认证后用 `SEED_ADMIN_PASSWORD || dev默认值` 模式"，本轮就是照这句话落地：

| 层 | 落点 |
| --- | --- |
| 契约 | `packages/shared` 新增 `ChangePasswordSchema`（`min(1)` / `min(6)` / refine 新旧不同）+ `ChangePasswordInput`；前端删掉手写 interface，改从 shared 导入 |
| 结构 | `users` 新增**可空** `password` 列（NULL = 该账号不启用密码登录，保留被企微/飞书/SSO 替换的契约边界），`init.sql` 由生成器重出并通过 `db:init:check` |
| 种子 | 新建 `apps/api/src/db/seed-users.ts` 作账号定义唯一真源；`env.ts` 加 production 缺失即拒绝启动的守卫（与既有 `JWT_SECRET` 守卫对称，`.env.example` 与 `compose.self.yml` 早已备好该变量） |
| 认证 | `login` 改 async 并严格 bcrypt 校验；无 `password` 值显式拒绝而非当空串比对 |
| 端点 | `POST /auth/change-password`，route 级 `authMiddleware`（不用 `use("*")`，login/refresh 仍匿名可达）；opCtx 必须在鉴权**之后**现取，否则 `operatorAccount` 为空 |
| 出 wire | `user.service.ts` 的 `toWireUser` 投影剔除哈希；审计 `excludeColumns` 同时排除 `password`，防 bcrypt 落进 `audit_logs.changes` 被 `GET /logs` 读出 |
| 会话 | 改密后按 email 吊销该账号全部 refreshToken，成功/失败都写 `change_pwd` 审计（severity warning） |

### 13.2 缺陷 B：`db.ts` 双套账号定义 → 单一真源，且**保住启动语义**

`seedUsers(d, opts)` 用一个 `onlyIfEmpty` 开关把两种语义分开，而不是把它们折中：
启动兜底 = 只在空库播种（`onlyIfEmpty: true`，与重构前 `existing.length === 0` 等价）；
手动播种 = 按 email 幂等补齐（`includeDevOnly: true`，与重构前 `onConflictDoNothing` 直插 3 行等价）。

这是交叉审查抓出来的 **A1 阻断项**：合并账号定义时顺手把"缺失即补"当成了等价重构，
实际后果是运维删掉默认 admin 之后，一次容器重启会静默复活一个能用 `SEED_ADMIN_PASSWORD` 登录后门的管理员。
教训同 B027 族：**"两处定义合成一处"不等于行为不变，被合并的那个条件判断才是语义本体**。
反例已固化为测试（`seed-users.test.ts`：存量库缺 admin → 返回 0 且不复活）。

复审追出该修复的 P1：**开关写在调用方字面量里 = 没有测试覆盖**。`seedUsers(db, { onlyIfEmpty: true })` 留在
`db.ts`，而 `db.ts` 的惰性自举路径没有任何测试经过——把那个参数删掉不会有测试变红。
处置：把语义收进 `seedUsersOnStartup(d)`（`db.ts` 只调它），并做变异验证——临时去掉函数体内的
`onlyIfEmpty` 开关后 `1 fail`（"存量库缺 admin → 不回填"），恢复后 `324 pass / 0 fail`。
同一轮把 `seed-users.test.ts` 手写的建表 DDL 换成直接执行真源 `init.sql`（`applyInitSql`），
避免 schema 演进时测试结构静默失真；顺带这条路径也验证了漂移守卫对 `init.sql` 不误报。

### 13.3 附带后果：存量库缺列的静默误读（血案 B030）

加列后在**存量 dev 库**上登录返回 401「密码错误」，看着完全像业务失败。真实原因是 SQLite 的
double-quoted-string 包袱把"解析不到的双引号标识符"降级成字符串字面量，缺列不报错、返回 `"password"` 真值。
落点：`bootstrap.ts` 的 `assertCoreTableMatchesSchema()` 用 `getTableColumns()` 与 `pragma_table_info` 比对，
缺列即抛含处置指令的错误。已声明局限：DB 惰性初始化，API 消费方拿到的是 `500 INTERNAL_ERROR`，
可操作文案在服务端日志/控制台；改成启动即失败属新的行为设计，未获授权，不动。

### 13.4 实测验证（全部真实执行）

- 测试：api `bun test src/` **324 pass / 0 fail**（27 文件，含新增 `seed-users.test.ts` 7 例、`bootstrap.test.ts` 漂移正反 2 例、`auth.route.test.ts` 改密 6 例）· web vitest **347 pass** · shared **70 pass** · scripts 35 pass · eslint-rules 92 pass
- 静态：tsc（shared / web / api / scripts）均 rc=0 · `arch:check` 通过（135 文件 / 28 行数文件）· `db:init:check` 一致
- 门禁：stage4 对 starter **9 PASS / 0 FAIL**（上一轮为 7 PASS / 2 FAIL，两条 FAIL 正是本轮这两个缺陷）· R010 种子单源 PASS（种子源定位到新文件，派生脚本 1 个有生成器）· R014 端点一致性 PASS（7 个前端端点全部命中后端 34 条注册路由）· R029 frontmatter 47 文件 PASS · `verify-all-in-mvp.ps1` **22 PASS / 0 WARN / 0 FAIL**
- 真实 HTTP 冒烟（空库起服）：登录 200 → 错口令 401「密码错误」→ `/users/me` 响应体无 `password` 键 → 改密四分支（未认证 401 / 原密码错 400 / 新旧相同 400 + `errors.newPassword` / 成功 200）→ 新口令登录 200、旧口令 401、旧 refreshToken 401 `TOKEN_EXPIRED` → `GET /logs` 里 `change_pwd` 的 success 与 failure 两条都在（severity 均 warning）
- 漂移守卫实跑：保留旧结构库启动 → 日志 `已缺失列：password` + `db:reset` 指引，响应 `500`；换空库 → `Seeded 1 user account(s)`，登录恢复正常
- `DATA_DIR=<tmp> bun scripts/seed-dev.ts`：首跑 3 账号均为 `$2b$10$…`；轮换 admin 口令后复跑 → 新口令仍可登录、种子口令失效（幂等且不覆盖，实测非推断）
- 交叉审查（quality-gate 规则 1/2 的派发项）：首轮 `mvp-code-reviewer` = **PASS_WITH_FIXES**（A1 后门复活 + B3 审计侧哈希防线 + 文案口径，本轮已修；B1/B2/B4 与 5 条 C 项判定为超范围或事实前提不成立，见 §13.5）；复审 = **PASS**（P0 清零，唯一 P1 是启动兜底调用点无覆盖，已按上文处置并做变异验证）。审查者在无 bun 环境下独立复现不了运行类结论，已要求其标注为静态审；上述运行数字由本会话实测给出。

### 13.5 本轮明确不做的（越界项，留给作者定）

1. **第三处缺陷（新发现，未修）**：`bunx eslint eslint.config.js` 稳定报
   `Definition for rule '并附理由。' was not found` —— 配置第 227 行的注释字面量
   `//    eslint-disable-next-line 并附理由。` 被 ESLint 当指令解析。
   该文件本轮未触碰（`git status` 干净），属上游既有；后果是根目录 `bun run lint`（目标 `.`）恒红。
   一行改注释措辞即可修，但不在「两个指定缺陷」内，**只报不修**。
2. 账号枚举面（登录失败文案区分「用户不存在 / 密码错误」）：改动前旧 starter 任意密码皆 200，本就可枚举，非本轮引入；改文案属业务内容。
3. `demo-refresh-${Date.now()}` 同毫秒碰撞：上游 demo 设计，新增的吊销逻辑未扩大该面。
4. 前端 `ProfileSettingsPage` 手写 `length < 6 || > 128` 与后端 `min(6)` 无 max 的规则双真相源问题（类型已收口 shared，规则未收口）。
5. 存量 dev 库的结构漂移不做自动迁移：模板仓的结构来源是 `init.sql`，自动 `ALTER` 属新的行为设计。

---

## 14. 第八轮执行（v2.28）— 推送前脱敏 + 新增 R040 防回归门禁（血案 B032）

作者对 §12.3 第 2 条的裁决是「内网 GitLab 那台机器涉及的坐标都要脱敏」+「都只推到 github 上」。
公开仓库里的自建内网坐标同时是两件事：**指向不可达主机的死链**和**基础设施暴露面**，
所以这一轮不是"改文案"，是把判据固化成门禁。

### 14.1 脱敏边界：删了什么、留了什么（留的都是刻意的）

| 处置 | 内容 | 理由 |
|---|---|---|
| 删除/替换 | 内网 GitLab 的 git URL（`README.md` 12 处 `npx giget` / `git clone` 示例）、内网测试机 IP × 端口、内网主机别名、内网设计源链接 | 公开仓不可达且暴露拓扑 → RFC 2606 占位域（`gitlab.example.com` / `test-host.example.com`） |
| 改为注入 | `.gitlab-ci.yml` 的 `TEST_HOST/TEST_PORT/TEST_USER/TEST_PATH` 变量值、`scripts/reset-test-db.sh` 的 `SSH_*` 常量 | 部署坐标属于环境配置，仓里只留**变量名与缺失即报错**的约束，不留真值（`${TEST_HOST:?}` 而不是内网默认值——留默认值等于没脱敏） |
| 保留 | `registry.cn-beijing.aliyuncs.com/wecode-cloud` 命名空间、`FLOW_WEBHOOK_URL` 的 `.../REPLACE_ME` 形态、模板自身端口 11070、`wecode` 项目/用户名命名、本地未入库的记忆与备份文件 | 公共云地址不是内网坐标；`REPLACE_ME` 已是脱敏形态；11070 是 compose 模板自绑端口，换成别的反而与文档不一致 |
| 保留叙事 | `MIGRATION-PLAN-qoder.md` 里 4 处「内网 `<已脱敏>` / 内网测试机 IP」措辞 | 记录本身要能追溯"当初同步了什么"，但不含可用坐标 |

### 14.2 R040 的门禁形态（写法直接继承 B025/B027/B028/B029 的教训）

- **判据按形态，不按已知违规串**：内网段的点分 / 横线 / 下划线 / URL 百分号编码四种书写形态都命中，
  把 `.` 换成 `-` 不是逃逸通道。通用 RFC1918（文档示例、测试夹具）判 WARN 单独计数，不阻断，但绝不并入 PASS。
- **覆盖面不写死在检查器里**：文件清单取 `git ls-files`（尊重 .gitignore，天然排除 node_modules/dist），
  非 git 目录退回递归扫描；`-c core.quotepath=false` 是必须的——否则非 ASCII 路径被转义成
  `"\346\226\207"` 形态，`Join-Path` 打不开就被静默跳过，**漏检比误报更糟**。
- **SKIPPED ≠ PASS**：一个文件都没扫到时 exit 2，聚合脚本按非 0 计入 FAIL（B022）。
- **放行要带理由**：`R040-allow` 同行无理由仍判 FAIL；例外清单不写进脚本。
- **例外与盲区写全**：未登记的新内网主机名、二进制内嵌字符串、多变量拼接、进制改写（八/十六进制、无点单整数）、
  未入库文件——全部逐条写进脚本注释与 `gate-rules.yaml`「已声明盲区」。

### 14.3 审查抓到的自命中（本轮唯一 BLOCKER，血案 B032）

评审者要求"脚本 `git add` 之后再跑一次"，才暴露门禁注释里写着完整内网 CIDR：
untracked 状态下 `git ls-files` 扫不到自己，所以两轮 PASS 都是真的、也都没用——**入库那一刻起门禁永久红**。
处置：注释改成不成形写法（不用 `R040-allow` 自我豁免，登记处自带放行样本会削弱示范意义），
并把「检查器的注释/文档/夹具都在自己的扫描范围内」写进 R040 盲区 ⑥。
顺带修掉 FAIL 行双计入 WARN 的统计噪声（夹具断言从 WARN 2 变 1 就是这次修复的回归信号）。

### 14.4 实测验证（全部真实执行）

- 负面夹具 7 个 + 空目录：点分/横线/百分号编码/内网主机名/无理由放行 共 **5 处 FAIL**（rc=1），
  占位域样本与带理由放行样本不误报（显式放行 1 处），空目录 **SKIPPED rc=2**。
- 全仓：新脚本入库后 `-TargetDir .` **PASS，扫描 559 个文件**（比入库前多 1 个，正是脚本自己）；
  独立 grep 复核 `192.168.110` / 主机别名 / 非 `REPLACE_ME` 的 webhook 令牌 = 0 命中。
- stage4 聚合门禁对 starter：本轮结束时报的是 **10 PASS / 0 FAIL / 10 TOTAL**（R040 是新增的第 10 条）。
  **这个数字后来被更正**：§15.4 发现聚合脚本把"检查根本没执行"的 SKIP 与 PASS 混记，
  同一条命令的真实分布是 **6 PASS / 0 FAIL / 4 SKIP**（R012 无 api-contract.yaml、R005 无 E2E spec、
  R028/R029 待检查文件数为 0）。R040 本身是真跑过的（559 文件 + 7 个负面夹具 + 空目录 SKIPPED）。
- `verify-all-in-mvp.ps1`：**22 PASS / 0 WARN / 0 FAIL**（门禁脚本计数 12 个 `check-*.ps1`）；R029 frontmatter 47 文件 PASS。
- `sync-qoder-homes.ps1`：两个 home 的 skills/agents/scripts 与仓库**逐字节一致**。
- 交叉审查：`mvp-code-reviewer` 首轮 **1 BLOCKER（自命中）+ 3 P2**（README 脚本计数陈旧、进制改写未列盲区、WARN 双计），
  本轮全部修完并复跑验证；脱敏彻底性、无过度脱敏、CI 变量注入可用性、越界检查四项均判"未发现"。

### 14.5 本轮明确不做的

1. 不改 `shadcn/DESIGN.md` 里"Vue 3 + shadcn/vue"的旧栈声明——本轮只换掉其中的内网链接，
   技术栈口径属 §13.5 同类的既有问题（B021 家族），不在脱敏授权内。
2. 不把 `check-private-refs.ps1` 挂进 `hooks.PostToolUse`：全仓扫描实测 5.7s，每次编辑 CI/文档就跑一次不可接受；
   改为 `rules/quality-gate.md` 强制行为第 8 条（改动者自跑）+ stage4 聚合门禁兜底。
3. 不给 `skills/wecode-project-scaffolder` 之类"发布树排除"另建机制——§12.3 第 2 条的后半问句仍未决，当前它随仓入库且内容已无内网坐标。
4. **不做 git 历史重写**：脱敏只保证工作树与新提交干净。旧的内网坐标仍存在于历史提交对象里，
   而推送会把历史一并带上——真要抹除需要 `git filter-repo` 级别操作（重写全部提交、强推、通知所有克隆），
   不在本轮授权范围内，且属于不可逆动作。若 GitHub 侧可见性有风险，需作者单独决策。

---

## 15. 补齐一件拖了三轮的事：真实浏览器 E2E 跑通（task #9 / #22 收尾）

`Playwright E2E 仍未真实跑过` 从 Phase 0 起就一直挂在待办上。本轮真跑，判据只有一个：**拿到真实退出码**。

### 15.1 环境上的两个坑（不写下来下次还会踩）

1. **`@playwright/test` 版本必须对上本机已缓存的 chromium revision**：本机只有 `ms-playwright/chromium-1248`
   （上一轮下载过），而 1.65 要 1254、1.63 要 1243。`bunx playwright install --dry-run chromium` 可以直接读出
   各版本期望的 revision，据此把运行器钉到 **1.64（↔ 1248）**，不必再赌 CDN。
2. **缓存里只有完整 chromium，没有 `chrome-headless-shell`** → 默认 headless 启动必然
   `Executable doesn't exist at ...chromium_headless_shell-xxxx`。配置里 `use.channel: 'chromium'`
   让 headless 走完整 Chrome for Testing 二进制（新无头模式），加上 `--no-sandbox`
   （这台机器直接跑 chrome.exe 会报 `Sandbox cannot access executable … 拒绝访问`）。

顺带：`bun --filter web dev` / `bun run build:shared` 在这个 Bash 会话里报 `bun: unknown error`（而 `bun test`、
`bunx vitest`、`bunx vite` 都正常）——绕过方式是从 `apps/web` 直接 `bunx vite`。未深挖，属 bun 在该
shell/工作区组合下的调用问题，不影响本轮结论（shared 的 `dist` 上一轮已构建，API 直接消费）。

### 15.2 跑的是什么（不新增仓内资产，harness 放在仓外 `D:/e2e-smoke-playwright/`）

对 starter 的真实 dev 链路：**浏览器 → Vite 5173（`/api` 代理重写）→ Hono 3000 → SQLite**，
`DATA_DIR` 指到仓外空库，因此同一次运行顺带验证了「空库启动只播 `admin` 一个账号」的 R010 语义。

6 条用例 = 6 passed / 0 failed，**rc=0**：
1. 登录页控件全可见 + 默认账号提示与实际口令一致
2. 前端校验异常分支（空字段 / 短口令）不发请求
3. 后端异常分支：错误口令 → 真实 401，文案落到 `role=alert`，仍停在 `/login`
4. 正常分支：`admin/admin123` 进 `/dashboard`，侧边栏三项齐全，reload 后仍登录态，控制台零 error
5. 鉴权异常分支：未登录直连 `/dashboard` 被送回 `/login`
6. **改密全链路**（上一轮补的 `POST /auth/change-password` 此前只在 HTTP 冒烟验过）：
   UI 改密 → toast → 跳登录 → 旧口令 401 → 新口令可登录 → 复原回 `admin123` 保证可重复跑

### 15.3 不轻信"绿"：两条独立证据

- **反向对照**：临时加一条故意写错的断言（"错误口令也能进仪表盘"）→ **1 failed / rc=1**，
  证明确实是应用在决定红绿，而不是用例在自说自话（B022/B024/B027 纪律）。对照文件跑完即删。
- **落库复核**（只读查 SQLite）：`users` 表仅 `admin` 且口令是 `$2b$10$` 60 位哈希；
  `audit_logs` 聚合 = `login/success` 5 条、`login/failure` 3 条、`change_pwd/success` 2 条，
  `userAgent` 全部是本次驱动 Chrome/156.0.8078.4、`ipAddress` 127.0.0.1，
  改密两条 detail 均为「密码已更新，该账号全部会话（含当前）的续期凭证已作废」。

### 15.4 真实数字（更正上一节写的 10 PASS / 0 FAIL）

上一节写"stage4 对 starter 10 PASS / 0 FAIL"——**这个数字是错的**，不是数字漂移，是聚合脚本的语义缺陷：
它只看子脚本退出码，而 7 个 `check-*.ps1` 里有 5 个在"没有可检查对象"时 `exit 0` 并自报
`{"status":"SKIP"|"SKIPPED"}`（这正是 B027 教训 ② 要求过的"SKIP 不能渲染成绿"，
但**聚合脚本自己没实现这条**）。加上 SKIP 分类后同一条命令的真实分布：

| TargetDir | PASS | FAIL | SKIP | 备注 |
|---|:--:|:--:|:--:|---|
| `starters/liquid-glass-frontend`（stage4，10 条） | 6 | 0 | 4 | SKIP = R012（v2.26 后 starter 无 api-contract.yaml，契约真相源改为 shared Zod）、R005（starter 无 E2E spec）、R028/R029（该目录下待检查文件数为 0） |
| `starters/liquid-glass-frontend`（stage3，5 条） | 2 | 0 | 3 | 同上三类 |
| 框架仓根（stage4） | 5 | 2 | 3 | 2 FAIL 为 §11.5 已记录的"三棵树混扫"边界（R011 命中 `demo-frontend` / `templates/e2e` 的模板端口 + 根目录无 `.env.example`），非本轮引入 |

两个聚合脚本（`check-stage3-gate.ps1` / `check-stage4-gate.ps1`）现在的行为：rc≠0 → FAIL；
rc=0 且输出含 `"status":"SKIP*"` → 记入 SKIP 并打印原因（有 `message` 用 `message`，只有 `checked:0` 就写"待检查文件数为 0，检查未执行"），
结论从 `[PASS] 全部通过` 降级为 `[PASS*] 无 FAIL，但下列规则没有真正检查过`（仍 exit 0，跳过不阻断交付，但不再冒充通过）。
子脚本的退出码在调用后立即取存入 `$childRc`——原来在 `if ($LASTEXITCODE -eq 0)` 之后才用，会被后续 cmdlet 刷新（B022 同族）。

**结论更正**：starter 至今没有任何 Playwright 资产，R005 对它永远是 SKIP；本轮这次真实 E2E
是在仓外 harness（`D:/e2e-smoke-playwright/`）跑的，**没有**进入 starter，因此不能作为 R005 通过的证据。

### 15.5 仍然没做的事

- 没把 Playwright 依赖/配置写进 starter，也没把 harness 放进仓内：本轮目标是"真跑一次"，
  不是给模板仓新增 E2E 资产（新增 devDependency 会改变 starter 的依赖面，属另一个决策）。
  若要固化，需要一并决定 `@playwright/test` 版本与浏览器 revision 的约束方式（`playwright install` 走 CDN，本机不稳）。
- R012 对权威 starter 判 SKIP 是 v2.26 去契约文件后的遗留校准缺口：真相源已改为 `packages/shared` 的 Zod，
  门禁却仍在找 `api-contract.yaml`。改成读 shared schema 是一次真实的检测面改造，不在本轮授权内，**只报不修**。
- `bun --filter *` 在本会话报 unknown error 的根因未查。

---

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
| Stage2 规划 | stage2-planning.js | `mvp-architect` + `mvp-domain-expert` + `mvp-grill-review` + `mvp-test-writer`/`mvp-scenario-test` + `mvp-test-review`（v2.26 起 `mvp-mock-service` 已废弃，不再进 Stage2） |
| Stage3 开发 | stage3-execution.js | `mvp-pipeline-coordinator` + 按模块的纵向切片（`mvp-backend-tdd` 主，`mvp-frontend-dev` 降为切片内步骤）+ `mvp-code-reviewer` |
| Stage3.5 E2E | （主 Agent 直接执行） | `mvp-scenario-test` / kf-mvp-test-e2e 技能 |
| Stage4 集成 | stage4-integration.js | `mvp-stage4-coordinator` + `mvp-debug-fixer` + `mvp-verifier` |
| Stage5 复盘 | （主 Agent） | `mvp-retrospective-agent` |
