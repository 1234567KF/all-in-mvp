# 共享前缀规则 (UltraCostEffective L2 KV Cache 层)

> **always-on: true** | **scope: global** | **priority: high**

## 规则概述

所有 Claude Code / Qoder Agent 的系统提示必须使用**统一共享前缀模板**，确保 DeepSeek KV Cache 最大化命中。
共享前缀（前 200-500 tokens）在所有 Agent 间**逐字相同**，差异化内容放在前缀标记之后。

## 共享前缀模板

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

## 差异化内容区

前缀标记之后的内容可以因 Agent 角色/阶段/任务而异：

```
[角色描述]    — 当前 Agent 的角色定位
[阶段上下文]   — 当前 pipeline 阶段信息
[任务描述]    — 具体任务要求
[工具调用]    — 实际执行的操作
```

## 前缀一致性要求

### MUST（强制执行）

1. **前缀逐字相同**：所有 Agent/技能的系统提示中，SHARED PREFIX START 到 SHARED PREFIX END 之间的内容必须完全相同（包括空格和换行）
2. **前缀在前**：共享前缀必须是系统提示的最前面部分，差异化内容不得出现在前缀之前
3. **版本一致**：所有文件使用相同的版本号 (`ultra-cost-effective-l2-cache-v1`)，版本升级需同步所有文件
4. **变量填充**：`{PROJECT_ROOT}` / `{TECH_STACK}` 等变量需在加载时统一替换，确保替换后内容一致

### SHOULD（建议执行）

5. **前缀顺序**：项目上下文 → 工具约束 → 通信协议 → 节能策略 的顺序不可变
6. **前缀长度**：保持在 200-500 tokens 范围内，过短缓存收益低，过长降低灵活性

## KV Cache 机制说明

DeepSeek API 的 KV Cache 按请求前缀匹配：

| 场景 | 价格 | 说明 |
|------|------|------|
| Cache 命中 (Hit) | ¥0.025 / M tokens | **120x 杠杆** |
| Cache 未命中 (Miss) | ¥3.0 / M tokens | 全价 |
| 部分命中 | 按比例混合计费 | 前缀长度决定命中比例 |

## 命中率优化策略

1. **固定前缀最大化**：将最多的不变信息放在前缀中
2. **变量最小化**：前缀中尽量减少动态变量，使用加载时替换
3. **排序防御**：工具列表按固定顺序排列（字母序），避免加载顺序导致前缀不同
4. **TTL 利用**：DeepSeek KV Cache TTL 5 分钟，高频任务可充分利用

## 验证

```bash
node helpers/prefix-validator.cjs --check-all
# 检查所有技能/规则文件的前缀一致性
```
