# kf-skill-design-expert

## 技能来源

- **五大设计模式**：Tool Wrapper / Generator / Reviewer / Inversion / Pipeline
  - 来源：OpenClaw 官方 skill-creator 设计模式 + 社区实践提炼
  - 参考：`{openclaw_builtin_skill_dir}/skill-creator/SKILL.md`
- **Kiro Spec 生成模式**：Spec-first 方法论
  - 来源：Kiro IDE (Amazon) 的 spec document generation 最佳实践
  - 核心理念：代码生成前先生成结构化规格文档，作为下游生成的单一真实来源
- **Harness Engineering 五根铁律**：评审体系
  - 来源：项目内部 `references/harness-engineering-audit.md`
- **文件工程规范**：Frontmatter、目录结构、编写原则
  - 来源：OpenClaw 官方 skill-creator `references/file-engineering-spec.md`

## 参考链接

1. OpenClaw Skill Creator — https://github.com/anthropics/claude-code-skills
2. Kiro IDE Spec Document Generation — Amazon Kiro IDE 设计理念
3. Progressive Disclosure 原则 — skill-creator 核心设计原则
4. Claude Code Skills 官方文档 — Anthropic 官方 Skill 设计指南

## 改造说明

- `kf-` 前缀表示经过定制改造
- 本技能基于官方 skill-creator 的设计模式知识，增加了：
  - 五大模式完整知识库（含参考示例和实现要点）
  - 模式选型决策树
  - 模式组合指南
  - Kiro Spec 生成模式（Inversion + Generator 组合）
  - Harness Engineering 评审体系集成
- 重构 v2 变更：将五大模式详细说明和示例拆分到 `references/five-patterns-detail.md`，SKILL.md 主文件保留决策树和工作流，遵循 Progressive Disclosure 原则
