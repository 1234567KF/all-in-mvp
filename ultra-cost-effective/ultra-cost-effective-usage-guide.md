# UltraCostEffective 极致节能 — 使用改进建议

> 编写时间：2026-06-24
> 目标读者：需要使用节能体系的开发人员

---

## 一、当前状态评估

### 1.1 功能完整性

项目功能**完整但未激活**。4 个子技能 + 7 层节能架构的文件全部就绪：

| 子技能 | 层级 | 职责 | 文件状态 |
|:------|:----:|------|:--------:|
| `ultra-cost-effective-output` | L1 | tokenforge 输出压缩 | ✅ 就绪 |
| `ultra-cost-effective-cache` | L2+L3 | KV Cache 优化 + 共享前缀 | ✅ 就绪 |
| `ultra-cost-effective-router` | L7 | DeepSeek Pro↔Flash 智能路由 | ✅ 就绪 |
| `ultra-cost-effective-monitor` | L0 | Token 追踪 + 成本可视化 | ✅ 就绪 |

### 1.2 激活状态：❌ 未激活

证据：`perf-tracker --audit` 输出显示 40 次调用中**输入 token 全部为 0**，说明 Hook 数据采集管道处于断路状态，系统并未实际运行节能逻辑。

### 1.3 根本原因

```
项目设计时以 Claude Code 的 PreToolUse Hook 体系为第一平台
Qoder 平台虽然有 hook-adapter.cjs，但需要通过 settings.patch.json 手动接入
当前环境中 settings 未合并 → Hook 未注册 → 数据管道断路
```

---

## 二、启动方法

### 2.1 标准安装流程

```powershell
# Step 1：运行安装脚本
.\ultra-cost-effective\install.ps1 -Preset standard
```

脚本自动完成：
- [x] 环境检测（Node.js 版本）
- [x] 安装 lean-ctx MCP 工具（上下文压缩）
- [x] 加载预设配置（standard 预计节省 70-85%）
- [x] 配置验证

### 2.2 项目集成（多项目切换）

```powershell
# 将节能引擎接入目标项目
.\ultra-cost-effective\quick-setup.ps1 -Target "D:\path\to\your-project" -Platform qoder -Preset standard

# 卸载
.\ultra-cost-effective\quick-setup.ps1 -Target "D:\path\to\your-project" -Remove
```

### 2.3 重启生效

安装完成后必须**重启 Qoder / Claude Code** 使 Hook 注册生效。

### 2.4 验证是否生效

```powershell
# 验证核心文件完整性
node .\ultra-cost-effective\helpers\prefix-validator.cjs --check-all

# 查看各层运行状态
# 在对话中说：ultra-cost-effective status
```

### 2.5 日常使用命令

| 你说 | 效果 |
|:----|:-----|
| `token report` / `成本报告` | 查看本次会话 Token 节省统计 |
| `节能` / `省token` | 切换节能预设（quick / standard / extreme） |
| `ultra-cost-effective status` | 查看各层运行状态与缓存命中率 |
| `\$env:ULTRA_COST_EFFECTIVE_OFF=1` | 临时关闭节能（PowerShell） |

---

## 三、改进建议（使用层面，不改代码）

### 建议 1：完善一键安装后的验证闭环

**问题**：`install.ps1` 执行完成后没有反馈"是否真的能用了"。

**建议**：在安装脚本末尾追加一条快速验证：

```powershell
# 自动化验证：执行一次 tokenforge 压缩测试 + 数据管道连通性测试
node .\helpers\tokenforge.cjs --test          # 验证压缩引擎
node .\helpers\perf\perf-tracker.cjs --smoke   # 验证数据采集管道
```

如任一验证失败，直接提示用户排查方向，而不是"安装完成"。

### 建议 2：增加场景化 Quick Start

**问题**：SKILL.md 上来就是七层架构图，用户需要自己推断"我该怎么用"。

**建议**：在 SKILL.md 或安装脚本输出中增加按场景分类的速查表：

| 你的场景 | 一句话命令 |
|:---------|:-----------|
| "我就想省 token，别让我研究架构" | `.\install.ps1 -Preset standard -Quick` |
| "我要极致节能，不在乎一点点质量损失" | `.\install.ps1 -Preset extreme` |
| "我已经装好了，看看省了多少" | 说 `token report` |
| "我有个新项目要接入" | `.\quick-setup.ps1 -Target <路径> -Platform qoder` |
| "临时关掉，我要全量输出" | `\$env:ULTRA_COST_EFFECTIVE_OFF=1` |

### 建议 3：预设切换脚本化

**问题**：切换预设需要用户重新安装，不够灵活。

**建议**：封装一条轻量切换命令：

```powershell
# 举例（一行脚本，无需改动代码）
node .\helpers\perf\perf-tracker.cjs --preset extreme
# 输出：已从 standard 切换为 extreme，预计节省 85-95%
# 提示：重启后生效
```

### 建议 4：卸载流程标准化

**问题**：当前只有一句话"删除 ultra-cost-effective/ 目录，移除 settings 配置"，容易遗漏。

**建议**：`quick-setup.ps1` 增加 `-Remove` 参数，自动完成：

```powershell
.\quick-setup.ps1 -Target <路径> -Remove
# 自动：删除引擎目录 → 从 settings.json 中移除 Hook/MCP 配置 → 输出"已卸载，重启生效"
```

### 建议 5：多项目环境的管理

**问题**：在多个项目间切换时，每个项目都要单独安装/卸载。

**建议**：利用 `quick-setup.ps1` 的已有架构，为每个项目创建一个 `.ultra-cost-effective-link` 标记文件，集中管理：

```powershell
# 查看所有已接入项目
Get-ChildItem -Path ~\.ultra-cost-effective-links -Name
# 输出：WeCRM, my-other-project, ...
```

---

## 四、预设对照速查

| 预设 | 层级开启 | 预计节省 | 适用场景 |
|:----:|:--------:|:--------:|:---------|
| `quick` | L1 输出压缩 | 50-70% | 日常编码，快速启动 |
| `standard` | L1+L2+L3 含 KV Cache | 70-85% | 标准项目开发，**推荐** |
| `extreme` | L1-L7 全开 + Headroom | 85-95% | 大型项目/长会话 |

---

## 五、常见问题

| 问题 | 原因 | 解决 |
|:----|:-----|:-----|
| `token report` 显示全部为 0 | Hook 管道未连接 | 重启 Qoder/Claude Code |
| 安装后感觉没有变化 | 当前环境未接入 Hook 体系 | 确认 settings.json 已合并 |
| 想用但不想装 lean-ctx | lean-ctx 是增强可选 | 跳过：`install.ps1 -SkipLeanCtx` |
| 影响输出质量怎么办 | 压缩级别过高 | 切到 quick 预设或临时关闭 |

---

## 六、标准化部署流程（AI 可执行）

> 面向新机器 / 新用户的可靠部署步骤。每步均可由 AI Agent 通过 Shell 命令完成，无需人工判断。

### 6.1 前置条件

| 条件 | 检查命令 | 要求 |
|------|---------|------|
| Node.js | `node --version` | ≥ 18.0 |
| lean-ctx（推荐） | `lean-ctx --version` | 可选，不安装则 L1 上下文压缩降级 |

### 6.2 一键部署到目标项目

```powershell
# 在 ultra-cost-effective 仓库根目录执行
.\quick-setup.ps1 -Target "D:\path\to\your-project" -Platform qoder -Preset standard
```

脚本自动完成：

| 步骤 | 操作 | 说明 |
|------|------|------|
| [1/5] | 环境检测 | Node.js 版本、引擎完整性 |
| [2/5] | 复制引擎 | robocopy 将 `ultra-cost-effective/` 复制到目标项目 |
| [3/5] | 安装 lean-ctx | 全局安装 lean-ctx-bin MCP 工具 |
| [4/5] | 合并 settings | **自动合并** `settings.patch.json` 到 Qoder 全局配置，无需手动编辑 |
| [5/5] | 验证安装 | 核心文件校验 + prefix-validator |

### 6.3 部署后验证

```powershell
# 1. 验证核心文件完整性
node .\helpers\prefix-validator.cjs --check-all

# 2. 测试 Hook 适配器管道
echo '{"tool":"Bash","command":"npm test"}' | node .\adapters\qoder\hook-adapter.cjs

# 3. 测试命令分类
node .\helpers\tokenforge-hook.cjs --test

# 4. 重置追踪数据（从零开始统计）
node .\helpers\perf\perf-tracker.cjs --reset
```

### 6.4 重启生效

**必须重启 Qoder/Claude Code** 使 Hook 注册生效。重启后在对话中说 `token report` 确认系统激活。

### 6.5 卸载

```powershell
.\quick-setup.ps1 -Target "D:\path\to\your-project" -Remove
```

自动完成：删除引擎目录 + 从 settings.json 移除相关配置。

---

## 七、Token 统计机制说明

### 7.1 统计范围

| 维度 | 说明 |
|------|------|
| 存储位置 | 项目根目录下的 `.ultra-cost-effective-tracker.json` |
| 隔离边界 | **按项目目录** — 每个项目独立统计，互相不干扰 |
| 会话概念 | 自上次 `--reset` 以来的累计数据（非 Qoder conversation ID） |
| 累积行为 | 同项目内所有 Qoder 对话共享同一份统计数据 |
| 重置方式 | `node helpers/perf/perf-tracker.cjs --reset` |

### 7.2 统计涵盖的节省层级

| 层级 | 计入默认报告 | 说明 |
|------|:-----------:|------|
| L1 tokenforge 输出压缩 | ✅ | 管道注入后的 Token 节省估算 |
| L2 KV Cache 缓存命中 | ✅ | DeepSeek 缓存命中 Token 数 |
| L4 技能按需加载 | ✅ | 非活跃技能 stub 化节省 |
| L7 模型路由 Pro→Flash | ⚠ 排除 | 默认不计入（动态定价不可靠），设置 `ULTRA_COST_EFFECTIVE_INCLUDE_ROUTER=1` 可开启 |

### 7.3 定价数据

成本计算从 [helpers/perf/pricing.json](file:///d:/ultra-cost-effective/helpers/perf/pricing.json) 读取，报告中会标注定价基准和更新日期。更新定价只需修改该文件，无需改代码。

### 7.4 环境变量速查

| 变量 | 作用 | 默认值 |
|------|------|--------|
| `ULTRA_COST_EFFECTIVE_PRESET` | 节能预设 | `standard` |
| `ULTRA_COST_EFFECTIVE_LEVEL` | 压缩级别 | `medium` |
| `ULTRA_COST_EFFECTIVE_OFF` | 临时关闭 (`=1`) | 未设置 |
| `ULTRA_COST_EFFECTIVE_INCLUDE_ROUTER` | 报告含 L7 路由节省 (`=1`) | 未设置（排除） |
| `ULTRA_COST_EFFECTIVE_PROJECT_ROOT` | 指定项目根目录 | 自动检测 |
