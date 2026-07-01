# UltraCostEffective AOP 上下文拦截规则

> **always-on: true** | **scope: global** | **priority: high**

## 规则说明

UltraCostEffective 上下文拦截器确保在每次 LLM 调用前，上下文已被压缩。此规则在系统提示中持续生效，是三色灯 AOP 拦截体系的第 1 层（规则层）。

## 三色灯上下文管理

当 `context-interceptor.cjs check` 输出状态时：

| 状态 | 含义 | 行为 |
|------|------|------|
| 🟢 green | 上下文健康 (<60% 窗口) | 正常处理，工具输出压缩已生效 |
| 🟡 yellow | 上下文中度占用 (60-80%) | 优先用 session-memory 索引引用，避免重复原始输出 |
| 🔴 red | 上下文高危 (>80% 窗口) | 立即压缩历史，仅传摘要给子 Agent |

## 工具输出处理规则

### 正常模式（green）
- 工具输出经 tokenforge/headroom 管道自动压缩
- 压缩后的输出直接进入上下文
- 原文存入 session-memory 索引

### 黄色/红色模式
- 工具输出压缩后，额外生成一句紧凑摘要
- 使用 session-memory 记录 ID 标记："[已压缩: tf_xxx, 取回: retrieve tf_xxx]"
- 避免在后续推理中重复引用原始工具输出全文

## Agent Spawn 规则

当 spawn 子 Agent（通过 Agent 工具或 subagent）时：

1. **传递压缩上下文**：传递 session-memory 索引摘要，而非完整工具输出历史
2. **注入取回指令**：告知子 Agent "如需原文，使用 headroom retrieve <id> 取回"
3. **上下文健康检查**：如果主会话上下文为 yellow/red，压缩后再 spawn
4. **继承节省**：子 Agent 自然获得已压缩的上下文，无需额外配置 UltraCostEffective

## 跨技能兼容

- 此规则不影响其他技能的推理能力
- 其他技能看到的工具输出已是压缩版本（通过 PreToolUse Hook）
- 其他技能如需原文，同样通过 session-memory 索引取回
- UltraCostEffective 不控制其他技能的内部 LLM 调用，只控制它们接收到的上下文质量

## 手动检查

```bash
# 查看当前上下文健康
node ultra-cost-effective/helpers/context-interceptor.cjs check

# 生成 LLM 上下文提示
node ultra-cost-effective/helpers/context-interceptor.cjs hint

# Agent spawn 前检查
node ultra-cost-effective/helpers/context-interceptor.cjs pre-agent-spawn
```
