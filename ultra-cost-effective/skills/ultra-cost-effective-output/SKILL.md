---
name: ultra-cost-effective-output
description: tokenforge输出压缩引擎 — 4模压缩，3级可调，Shell/JSON/Code/Context全覆盖。
triggers: output, 压缩, tokenforge, compress
role: infrastructure
scope: global
always-on: true
platforms: [claude-code, qoder]
helper: helpers/tokenforge.cjs
hook: helpers/tokenforge-hook.cjs
---

# UltraCostEffective Output · Token 输出压缩 (L1)

> 纯 Node.js 4 模压缩引擎，零外部依赖。自动化 Shell 输出、JSON 响应、源代码和对话历史的 Token 压缩。

## 压缩模式

| 模式 | 目标 | 策略 | 典型压缩率 |
|------|------|------|-----------|
| **output** | Shell/Terminal | ANSI剥离→空行折叠→重复去重→栈折叠→长行截断→行数限制 | 60-95% |
| **json** | API响应/JSON | 深度限制→数组采样→大对象摘要→键压缩 | 70-98% |
| **code** | 源代码 | 保留导入+签名→函数体折叠→块注释移除→行数限制 | 50-85% |
| **context** | 对话历史 | 早期消息摘要→保留最近N轮完整 | 40-75% |

## 压缩级别

| 级别 | 行数限制 | 行宽限制 | JSON深度 | 上下文保留 | 预期压缩率 |
|------|----------|----------|----------|-----------|-----------|
| light | 300 | 500 | 8 | 15轮 | ~50% |
| medium | 120 | 300 | 5 | 8轮 | ~80% |
| aggressive | 60 | 150 | 3 | 4轮 | ~95% |

## 自动注入规则

PreToolUse Hook 自动为以下命令注入 tokenforge 管道：

| 命令类型 | 压缩级别 | 示例 |
|----------|----------|------|
| 测试/构建 | aggressive | `npm test`, `cargo build`, `pytest` |
| 代码检查 | medium | `eslint`, `tsc`, `cargo clippy` |
| 搜索 | medium | `grep`, `rg`, `find` |
| 目录浏览 | light | `ls`, `dir` |
| API调用 | auto | `curl -s api.example.com` |

## 排除命令（不压缩）

交互式命令、编辑器、密码操作自动跳过：`git push/commit`, `npm install`, `vim`, `ssh`, `sudo`, `mysql`...

## 手动使用

```bash
# 管道压缩
npm test 2>&1 | node helpers/tokenforge.cjs compress output --level aggressive

# 预览模式
cat data.json | node helpers/tokenforge.cjs compress json -l medium --dry-run

# 上下文压缩
cat chat.log | node helpers/tokenforge.cjs compress context -l light
```
