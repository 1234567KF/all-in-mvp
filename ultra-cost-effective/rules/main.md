---
name: ultra-cost-effective-main
description: UltraCostEffective 极致节能主规则 — 单文件导入所有七层节能规则
always-on: true
scope: global
priority: high
platforms: [claude-code, qoder]
---

# UltraCostEffective 极致节能 — 主规则集

> 导入此文件即激活全部七层节能规则。向项目 CLAUDE.md 添加一行：
> `@ultra-cost-effective/rules/main.md`

---

## 工具优先级（强制）

当 MCP 工具 `lean-ctx` 可用时，必须使用 lean-ctx 工具替代原生工具：

| 优先使用 | 替代 | 节省 |
|----------|------|------|
| `ctx_read(path, mode)` | `Read` / `cat` | 70-95% |
| `ctx_shell(command)` | `Shell` / `bash` | 50-80% |
| `ctx_search(pattern, path)` | `Grep` / `rg` | 40-70% |
| `ctx_tree(path, depth)` | `ls` / `find` | 60-85% |
| `ctx_edit(path, old, new)` | `Edit`（当 Read 不可用时） | 80-95% |

### ctx_read 模式速查

| 模式 | 用途 | 消耗 |
|------|------|------|
| `signatures` | 了解文件 API 结构 | ~1-5% |
| `map` | 依赖+导出 | ~2-10% |
| `full` | 需要完整上下文 | 100% |
| `lines:N-M` | 定位问题 | 按需 |
| `aggressive` | 最大压缩，仅上下文 | ~5-15% |
| `diff` | 代码审查 | ~10-30% |

### 降级策略

lean-ctx MCP 不可用时：Read/Grep/Shell 正常使用，tokenforge PreToolUse Hook 自动管道注入。

---

## 上下文管理（三色灯）

UltraCostEffective 在每次 PostToolUse 后评估上下文健康度：

| 状态 | 阈值 | 行为要求 |
|------|------|---------|
| 🟢 green | <60% | 正常处理，压缩已自动生效 |
| 🟡 yellow | 60-80% | 优先引用 session-memory 索引，避免重复原始输出 |
| 🔴 red | >80% | 立即压缩历史，spawn agent 时仅传摘要 |

### Agent Spawn 规则

当 spawn 子 Agent 时：
1. 传递 session-memory 索引摘要，非完整工具输出历史
2. 告知子 Agent：「如需原文，使用 `retrieve <id>`」
3. 上下文 yellow/red 时先压缩再 spawn
4. 子 Agent 自然继承已压缩上下文

---

## 共享前缀（KV Cache 优化）

所有 Agent 系统提示的固定前缀部分必须逐字一致，确保 DeepSeek KV Cache 命中。

```
### SHARED PREFIX START [ultra-cost-effective-l2-cache-v1]
### 项目上下文
- 项目根目录: {PROJECT_ROOT}
- 技术栈: {TECH_STACK}
- 代码规范: 遵循项目已有风格

### 工具约束
- 可用工具: 遵循平台提供的工具集
- 只读优先: 先理解再修改
- 安全边界: 不执行破坏性操作

### 通信协议
- 响应语言: 中文
- 输出格式: Markdown
- 简洁优先: 避免冗余解释

### 节能策略 (UltraCostEffective)
- KV Cache: 共享前缀已启用，命中率目标 > 70%
- 输出压缩: tokenforge 自动管道注入已激活
- 上下文压缩: lean-ctx 工具优先于原生工具
- 技能加载: 非活跃技能压缩为元数据 stub
### SHARED PREFIX END
```

---

## 跨技能兼容

- UltraCostEffective 不控制其他技能的推理能力
- 其他技能看到的工具输出已被压缩，如需原文通过 session-memory 索引取回
- 检测到第三方压缩器时自动跳过，避免双重压缩
- 所有命令执行前自动进行冲突检测

---

## 手动命令

| 关键词 | 效果 |
|--------|------|
| `token report` / `成本报告` | 查看 Token 消耗与节省明细 |
| `节能` / `省token` | 切换节能预设 |
| `ultra-cost-effective status` | 查看各层运行状态 |
| `ultra-cost-effective off` | 临时关闭（调试用）|
| `ultra-cost-effective on` | 恢复节能 |

## 验证

```bash
node ultra-cost-effective/helpers/prefix-validator.cjs --check-all
node ultra-cost-effective/helpers/tokenforge.cjs --help
```
