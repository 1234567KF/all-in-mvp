# lean-ctx 工具优先规则 (UltraCostEffective L1 上下文压缩)

> **always-on: true** | **scope: global** | **priority: high**

## 规则概述

当可用工具列表中存在 `lean-ctx` MCP 工具（`ctx_read`、`ctx_shell`、`ctx_search`、`ctx_tree`）时，**必须优先使用 lean-ctx 工具替代原生工具**。此规则在 Claude Code 和 Qoder 中均自动生效。

## 工具映射表

| 优先使用 | 替代 | 原因 | 预计节省 |
|----------|------|------|----------|
| `ctx_read(path, mode)` | `Read` / `cat` / `type` | 缓存 + 10种读取模式，重读仅 ~13 tokens | 70-95% |
| `ctx_shell(cmd)` | `Shell` / `bash` / `Terminal` | git/npm 输出模式压缩，自动管道注入 | 50-80% |
| `ctx_search(pattern, path)` | `Grep` / `rg` / `findstr` | 紧凑 Token 高效结果格式 | 40-70% |
| `ctx_tree(path, depth)` | `ls` / `dir` / `find` / `list_dir` | 紧凑目录映射，层级控制 | 60-85% |
| `ctx_edit(path, search, replace)` | `Edit` / `sed` / `Write` | 增量编辑，无需重读全文 | 80-95% |

## ctx_read 模式说明

lean-ctx 提供 10 种读取模式，按需选择最优模式：

| 模式 | 说明 | 适用场景 | Token 消耗 |
|------|------|----------|-----------|
| `signatures` | 仅提取函数/类签名 | 了解文件结构 | ~1-5% |
| `imports` | 仅提取导入语句 | 检查依赖 | ~2-10% |
| `outline` | 文件大纲 | 快速浏览 | ~5-15% |
| `diffs` | 仅变更部分 | 代码审查 | ~10-30% |
| `full` | 完整内容 | 需要全量上下文 | 100% |
| `range` | 指定行范围 | 定位问题 | 按需 |
| `symbols` | 符号引用 | 追踪引用链 | ~3-8% |

## 使用强制规则

### MUST（强制执行）

1. **文件读取**：首次读取文件时，使用 `ctx_read(file, 'signatures')` 了解结构，如需深入再使用 `ctx_read(file, 'range', start, end)` 或 `ctx_read(file, 'full')`
2. **重复读取**：同一文件再次读取时，**必须使用** `ctx_read`（缓存命中 ~13 tokens vs 原始读取可能数千 tokens）
3. **目录浏览**：使用 `ctx_tree(path, 2)` 替代 `ls` / `list_dir` / `find`
4. **搜索**：使用 `ctx_search(pattern, path)` 替代 `grep` / `rg`

### SHOULD（建议执行）

5. **命令执行**：对大输出命令（test / build / lint）使用 `ctx_shell(cmd)` 以获得自动压缩
6. **编辑**：使用 `ctx_edit` 替代完整重写文件

### MAY（可选执行）

7. **降级**：当 lean-ctx MCP 不可用时，使用原生工具 + tokenforge 管道压缩

## 不可用降级策略

当 lean-ctx MCP 服务不可用时，按以下优先级降级：

```
1. ctx_read    → Read 工具 + 请求时说明"仅需前 100 行"或"仅签名"
2. ctx_shell   → Shell 工具 + | node helpers/tokenforge.cjs compress output
3. ctx_search  → Grep 工具 + | node helpers/tokenforge.cjs compress output
4. ctx_tree    → list_dir 工具 + 手动过滤
5. ctx_edit    → Edit 工具（原生已有增量能力）
```

## 验证清单

- [ ] `ctx_read` 在可用工具列表中 → 优先于 Read 使用
- [ ] `ctx_shell` 在可用工具列表中 → 优先于 Shell/Bash 使用
- [ ] `ctx_tree` 在可用工具列表中 → 优先于 list_dir/find 使用
- [ ] lean-ctx 不可用 → 自动降级到 tokenforge 管道压缩
