# UltraCostEffective Dynamic Workflow 预压缩规则

> **always-on: true** | **scope: global** | **priority: high**

## 规则说明

当用户使用 Claude Code Dynamic Workflows（`ultracode` 关键词、`/deep-research`、`/workflows` 命令或自然语言请求工作流）时，本规则确保在**工作流脚本生成前**上下文已被压缩，所有子 agent 自动继承压缩上下文。

## 触发检测

当以下关键词出现在用户输入中时，触发预工作流压缩：

| 触发方式 | 示例 |
|----------|------|
| `ultracode` 关键词 | `ultracode: audit every API endpoint` |
| `/deep-research` | `/deep-research What changed in Node.js v22?` |
| `/effort ultracode` | `/effort ultracode` |
| 自然语言 | `run a workflow for...` / `use a dynamic workflow` |
| `/workflows` | 管理已有工作流 |

## 预工作流压缩流程

### 1. 检测触发（自动）

当 `workflow-integrator.cjs detect` 检测到 workflow 触发时：
- 读取当前上下文健康状态（三色灯）
- 评估工作流规模（预期 agent 数量）

### 2. 预压缩（自动注入）

在工作流脚本生成前：
- **green 状态**：正常预压缩，传递 session-memory 索引
- **yellow 状态**：中等压缩，强调 session-memory 索引引用
- **red 状态**：**必须先压缩主会话**，否则子 agent 可能立即超出窗口

### 3. 子 Agent 继承（自动传播）

Dynamic Workflows 运行时 spawn 的子 agent 自动获得：
- 已压缩的上下文（来自 PreToolUse Hook）
- session-memory 索引（来自 AOP Interceptor）
- 压缩摘要引用（来自 Workflow 预压缩）

**无需子 agent 额外配置 UltraCostEffective**。

## 工作流专属预设

| 预设 | 适用场景 | 压缩比 | 特点 |
|------|----------|--------|------|
| `moderate` | 研究、分析 | 65% | 保留引用追溯 |
| `aggressive` | 大量 agent、上下文红色 | 80% | 代码精确，丢弃引用 |
| `codeAudit` | 代码审计 | 75% | 代码精确，文档激进 |
| `migration` | 大规模迁移 | 70% | 代码精确，保留文档引用 |
| `refactor` | 重构 | 60% | 高可靠性，保守压缩 |

## 乘法级节省

Dynamic Workflows 最多 spawn 1000 个子 agent。预压缩的节省是**乘法级**的：

```
单体压缩: 65% 节省
子 agent 数: 50
总节省: 65% × 50 = 3,250% (相对于每个 agent 独立压缩)
```

## ROI 追踪

工作流脚本是**确定性的、可重跑的**，因此可以精确测量 ROI：

```bash
# 记录一次工作流运行
node ultra-cost-effective/helpers/workflow-integrator.cjs track audit-api 320000

# 查看 ROI 报告
node ultra-cost-effective/helpers/workflow-integrator.cjs roi

# 查看特定工作流的 ROI
node ultra-cost-effective/helpers/workflow-integrator.cjs roi audit-api
```

## 手动检查

```bash
# 检测 workflow 触发
node ultra-cost-effective/helpers/workflow-integrator.cjs detect "ultracode: audit API"

# 预工作流压缩策略
node ultra-cost-effective/helpers/workflow-integrator.cjs pre-workflow 20 deep-research

# 工作流专属预设
node ultra-cost-effective/helpers/workflow-integrator.cjs profile audit

# 状态概览
node ultra-cost-effective/helpers/workflow-integrator.cjs
```
