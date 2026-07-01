# UltraCostEffective · 极致节能 — Claude Code 项目引导

## 项目概述

UltraCostEffective（省工）是一个 **Claude Code / Qoder 双平台通用** 的 Token 节省技能体系。以 `1234567KF/ccmvp` 的七层节能架构为核心，融合 Headroom、lean-ctx、RTK 等国际高星项目能力。核心目标：**不降低 LLM 输出质量，综合节省 60-90% Token**。

## 快速接入（在目标项目中）

在目标项目的 `CLAUDE.md` 中添加一行：

```markdown
@ultra-cost-effective/rules/main.md
```

然后合并 settings：

```bash
# 将 adapters/claude/settings.template.json 中的内容合并到 .claude/settings.json
```

## 目录结构

```
ultra-cost-effective/
├── SKILL.md                  ← 主技能入口（触发词：ultra-cost-effective / 节能 / 省token）
├── CLAUDE.md                 ← 本文件：项目引导
├── README.md                 ← 用户安装使用文档
├── adapters/                 ← 平台适配层
│   ├── claude/               ← Claude Code 适配
│   │   └── settings.template.json
│   └── qoder/                ← Qoder 专用适配器
│       ├── SKILL.md
│       ├── hook-adapter.cjs
│       └── settings.patch.json
├── rules/                    ← 规则层
│   ├── main.md               ← ★ 主规则入口（目标项目 CLAUDE.md 导入此文件）
│   ├── shared-prefix.md      ← L2: 共享前缀
│   ├── cache-optimization.md ← L2+L3: KV Cache策略
│   ├── lean-ctx.md           ← L1: 上下文压缩规则
│   ├── compression-default.md← L1: 压缩默认开启
│   ├── interceptor-aop.md    ← AOP: 上下文拦截规则
│   └── workflow-compress.md  ← WF: Dynamic Workflows 预压缩规则
├── helpers/                  ← 可执行脚本（纯Node.js，零外部依赖）
│   ├── tokenforge.cjs        ← L1: Token压缩引擎核心
│   ├── tokenforge-hook.cjs   ← L1: PreToolUse自动注入钩子
│   ├── context-interceptor.cjs← AOP: 上下文拦截器
│   ├── workflow-integrator.cjs← WF: Dynamic Workflows 集成引擎
│   ├── skill-loader.cjs      ← L4: 技能按需加载
│   ├── cache-monitor.cjs     ← L2: KV Cache命中率监控
│   ├── prefix-validator.cjs  ← L2: 共享前缀一致性校验
│   ├── compressor-selector.cjs← L6: 智能压缩器选择
│   ├── session-memory.cjs    ← L6: 统一会话压缩记忆
│   ├── ultra-cost-effective-guard.cjs ← 跨技能生效保障
│   ├── headroom-adapter.cjs  ← L6: Headroom CCR适配器
│   ├── preset-switch.cjs     ← 预设切换
│   └── perf/                 ← 性能追踪子系统
│       ├── perf-tracker.cjs
│       ├── pricing.json
│       └── optimization-registry.json
├── skills/                   ← 子技能
│   ├── ultra-cost-effective-output/         ← L1: 输出压缩
│   ├── ultra-cost-effective-cache/          ← L2+L3: KV Cache优化
│   ├── ultra-cost-effective-router/         ← L7: DeepSeek双模型路由
│   └── ultra-cost-effective-monitor/        ← L0: 成本监控
├── presets/                  ← 预设配置
│   ├── quick.json
│   ├── standard.json
│   └── extreme.json
└── bench/                    ← 基准测试 (187项, 全部通过)
```

## 七层节能架构

| 层级 | 名称 | 机制 | 节省比例 | Claude Code 集成方式 |
|------|------|------|----------|---------------------|
| L7 | 模型智能路由 | DeepSeek Pro↔Flash 按需切换 | 40-60% 成本 | 配置层（presets） |
| L6 | A2A通信压缩 | session-memory + compressor-selector | 60-70% | 手动/LLM自觉 |
| L5 | 阶段智能跳过 | CCP Skip 跳过低价值阶段 | 30-50% | 配置层 |
| L4 | 技能按需加载 | 非活跃技能 → ~25 token stub | 85-96% | skill-loader CLI |
| L3 | 长上下文预热 | PRD/Spec 触发 KV Cache Checkpoint | 80-90% | 配置层 |
| L2 | 共享前缀缓存 | 200-500 token 固定前缀 | 120x 差价杠杆 | rules/main.md |
| L1 | 输出+上下文压缩 | tokenforge + lean-ctx | 80-99% | **PreToolUse Hook + MCP** |

## Claude Code 集成点

### 1. PreToolUse Hook → tokenforge 自动管道注入
```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "node ultra-cost-effective/helpers/tokenforge-hook.cjs"
  }]
}
```
触发时自动将 `npm test` 改为 `npm test | node tokenforge.cjs compress output --level aggressive`

### 2. PostToolUse Hook → 上下文健康监控
```json
{
  "matcher": "",
  "hooks": [
    {
      "type": "command",
      "command": "node ultra-cost-effective/helpers/perf/perf-tracker.cjs --capture"
    },
    {
      "type": "command",
      "command": "node ultra-cost-effective/helpers/context-interceptor.cjs post-tool-use"
    }
  ]
}
```

### 3. MCP Server → lean-ctx 上下文压缩
```json
{
  "lean-ctx": {
    "command": "lean-ctx",
    "args": ["mcp"]
  }
}
```

### 4. Rules → 自动加载
目标项目 CLAUDE.md 中：`@ultra-cost-effective/rules/main.md`

## 快速验证

```bash
# 运行全部测试 (187项)
node ultra-cost-effective/bench/test-workflow.cjs
node ultra-cost-effective/bench/test-interceptor.cjs
node ultra-cost-effective/bench/test-guard.cjs
node ultra-cost-effective/bench/test-session-memory.cjs
node ultra-cost-effective/bench/test-hotswitch.cjs
node ultra-cost-effective/bench/test-hook-pipe.cjs

# 验证核心引擎
node ultra-cost-effective/helpers/prefix-validator.cjs --check-all
node ultra-cost-effective/helpers/tokenforge.cjs --help

# 测试 tokenforge-hook 命令分类
node ultra-cost-effective/helpers/tokenforge-hook.cjs --test

# 查看上下文健康
node ultra-cost-effective/helpers/context-interceptor.cjs health
```

## 关键设计决策

1. **模型范围**：仅 DeepSeek-v4-pro + DeepSeek-v4-flash
2. **PreToolUse Hook**：使用 `updatedInput` 字段（Claude Code API）修改命令输入
3. **Headroom**：`extreme.json` 预设的可选增强，需手动安装 `pip install headroom-ai[all]`
4. **lean-ctx**：跟随最新稳定版，规则层向后兼容，不可用时自动降级
5. **核心引擎零平台依赖**：所有 helper 使用 `__dirname` 自定位
