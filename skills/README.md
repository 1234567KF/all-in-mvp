# MVP 多Agent并行开发流程 — 技能清单

> 本目录包含 all-in-mvp 项目多 Agent 并行开发流程所需的所有技能。

## 概述

基于 MVP白皮书 v2.4.0 定义的 13 种 Agent 角色和 5 个 Stage 的完整流程，设计了以下技能体系：

| Stage | 技能 | 用途 |
|-------|------|------|
| **Stage0** | kf-mvp-product-manager | 需求精炼（轻量模式入口） |
| **Stage1** | kf-mvp-product-manager, kf-mvp-prd-generator | 需求对齐 |
| **Stage2** | kf-mvp-arch-expert, kf-mvp-spec-generator, kf-mvp-biz-expert, kf-mvp-task-splitter, kf-pipeline-coordinator, grill-with-docs, kf-mvp-mock-service, kf-mvp-test-single, kf-mvp-test-e2e, kf-mvp-test-review, kf-mvp-testing-strategy | 计划 |
| **Stage3** | kf-mvp-backend-tdd, kf-mvp-frontend-dev, kf-mvp-code-review, kf-mvp-debug, kf-mvp-tdd-helper, kf-mvp-error-handling, kf-mvp-vue-components, kf-mvp-auth-implementation | 执行 |
| **Stage4** | kf-mvp-stage4-coordinator, kf-mvp-integration, kf-mvp-devops, kf-mvp-security, kf-mvp-health-check, kf-mvp-data-migration, kf-mvp-monitoring, kf-mvp-performance, kf-mvp-refactoring, kf-mvp-onboarding, kf-mvp-api-doc, kf-mvp-caching, kf-mvp-cli | 集成与验收 |
| **Stage5** | kf-mvp-retrospective | 复盘与经验沉淀 |

---

## 核心流程技能

### Stage1: 需求对齐

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-product-manager](kf-mvp-product-manager/SKILL.md) | Inversion | 产品经理技能，驱动需求发现和优先级排序 |
| [kf-mvp-prd-generator](kf-mvp-prd-generator/SKILL.md) | Inversion + Generator | PRD 生成技能，输出完整 MECE 需求文档 |

### Stage2: 计划阶段

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-arch-expert](kf-mvp-arch-expert/SKILL.md) | Generator + Tool Wrapper | 架构专家技能，生成 spec.md + schema.sql + api-contract.yaml |
| [kf-mvp-spec-generator](kf-mvp-spec-generator/SKILL.md) | Generator + Tool Wrapper | 技术规格生成技能，Spec-first 设计方法论 |
| [kf-mvp-biz-expert](kf-mvp-biz-expert/SKILL.md) | Inversion + Pipeline | 业务领域专家技能，模块拆分和验收标准制定 |
| [kf-mvp-task-splitter](kf-mvp-task-splitter/SKILL.md) | Pipeline + Inversion | 任务拆分技能，WBS 工作分解结构 |
| [kf-pipeline-coordinator](kf-pipeline-coordinator/SKILL.md) | Pipeline | 任务调度器，依赖图驱动 + 专家匹配 |
| [grill-with-docs](grill-with-docs/SKILL.md) | Reviewer + Pipeline | 拷问审查技能，交叉校验 ① 和 ② 的产出物 |
| [kf-mvp-api-contract](kf-mvp-api-contract/SKILL.md) | Tool Wrapper + Reviewer | API 契约设计技能 |
| [kf-mvp-schema-design](kf-mvp-schema-design/SKILL.md) | Tool Wrapper | 数据库设计技能 |
| [kf-mvp-api-versioning](kf-mvp-api-versioning/SKILL.md) | Tool Wrapper | API 版本管理技能 |

### Stage2 并行任务

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-mock-service](kf-mvp-mock-service/SKILL.md) | Generator | Mock 服务生成技能 |
| [kf-mvp-test-single](kf-mvp-test-single/SKILL.md) | Generator + Reviewer | 单模块测试编写技能（③b-1） |
| [kf-mvp-test-e2e](kf-mvp-test-e2e/SKILL.md) | Generator | 业务条线端到端测试技能（③b-2） |
| [kf-mvp-test-review](kf-mvp-test-review/SKILL.md) | Reviewer | 测试用例静态审查技能（③c） |
| [kf-mvp-testing-strategy](kf-mvp-testing-strategy/SKILL.md) | Tool Wrapper | 测试策略设计技能 |

### Stage3: 执行阶段

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-backend-tdd](kf-mvp-backend-tdd/SKILL.md) | Pipeline | 后端 TDD 开发技能，Red-Green-Refactor 循环 |
| [kf-mvp-frontend-dev](kf-mvp-frontend-dev/SKILL.md) | Tool Wrapper | 前端开发技能，Vue 3 + Vite |
| [kf-mvp-code-review](kf-mvp-code-review/SKILL.md) | Reviewer | 代码审查技能 |
| [kf-mvp-debug](kf-mvp-debug/SKILL.md) | Pipeline + Investigator | Bug 修复技能，根因分析四阶段 |
| [kf-mvp-tdd-helper](kf-mvp-tdd-helper/SKILL.md) | Tool Wrapper | TDD 辅助技能，测试模式参考 |
| [kf-mvp-error-handling](kf-mvp-error-handling/SKILL.md) | Tool Wrapper | 错误处理技能 |
| [kf-mvp-vue-components](kf-mvp-vue-components/SKILL.md) | Tool Wrapper | Vue 组件技能 |
| [kf-mvp-auth-implementation](kf-mvp-auth-implementation/SKILL.md) | Tool Wrapper | 认证实现技能，JWT + RBAC |
| [kf-mvp-refactoring](kf-mvp-refactoring/SKILL.md) | Tool Wrapper + Reviewer | 重构技能 |
| [kf-mvp-architecture](kf-mvp-architecture/SKILL.md) | Reviewer + Tool Wrapper | 架构审查技能 |

### Stage4: 集成与验收

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-stage4-coordinator](kf-mvp-stage4-coordinator/SKILL.md) | Pipeline | Stage4 协调器，模块合并、迁移、回滚的总调度 |
| [kf-mvp-integration](kf-mvp-integration/SKILL.md) | Pipeline | 集成验证技能 |
| [kf-mvp-devops](kf-mvp-devops/SKILL.md) | Tool Wrapper | DevOps 技能，Docker + CI/CD |
| [kf-mvp-security](kf-mvp-security/SKILL.md) | Reviewer + Tool Wrapper | 安全审查技能 |
| [kf-mvp-health-check](kf-mvp-health-check/SKILL.md) | Tool Wrapper | 代码健康检查技能 |
| [kf-mvp-data-migration](kf-mvp-data-migration/SKILL.md) | Tool Wrapper | 数据迁移技能 |
| [kf-mvp-monitoring](kf-mvp-monitoring/SKILL.md) | Tool Wrapper | 监控与告警技能 |
| [kf-mvp-performance](kf-mvp-performance/SKILL.md) | Tool Wrapper | 性能优化技能 |
| [kf-mvp-onboarding](kf-mvp-onboarding/SKILL.md) | Generator | 项目入门技能 |
| [kf-mvp-api-doc](kf-mvp-api-doc/SKILL.md) | Generator | API 文档生成技能 |
| [kf-mvp-caching](kf-mvp-caching/SKILL.md) | Tool Wrapper | 缓存策略技能 |
| [kf-mvp-cli](kf-mvp-cli/SKILL.md) | Tool Wrapper | CLI 工具技能 |

---

## 技能设计原则

基于 [kf-skill-design-expert](../kf-skill-design-expert/SKILL.md) 的六大步骤：

1. **写 Evals First** — 先定义评估用例
2. **写 Description** — Description = Router（路由触发器）
3. **写 Body** — Gotchas 优先（项目特定陷阱）
4. **使用目录层级** — Hub-and-Spoke 模式
5. **迭代分支** — Branch → Evals → Tweak → Merge
6. **Quality Self-Check** — 质量自检清单

---

## 五种设计模式

| 模式 | 适用场景 | 技能示例 |
|------|----------|----------|
| **Tool Wrapper** | 需要特定技术/框架知识 | kf-mvp-schema-design, kf-mvp-tdd-helper |
| **Generator** | 输出结构需要一致 | kf-mvp-prd-generator, kf-mvp-mock-service |
| **Reviewer** | 检查/审查任务 | kf-mvp-code-review, grill-with-docs |
| **Inversion** | 需要收集大量信息 | kf-mvp-prd-generator, kf-mvp-task-splitter |
| **Pipeline** | 多阶段流程 | kf-pipeline-coordinator, kf-mvp-integration |

---

## 使用方式

每个技能目录下包含：
- `SKILL.md` — 技能主文件
- `references/` — 可选参考资料
- `assets/` — 可选模板文件

激活技能时，Qoder 会自动加载对应目录下的 `SKILL.md`。

---

## 技能统计

- **总技能数**: 42
- **Stage0 技能**: 1（需求精炼，轻量模式共用）
- **Stage1 技能**: 2
- **Stage2 技能**: 14（含 ③c 测试审查）
- **Stage3 技能**: 13
- **Stage4 技能**: 12（含 Stage4 Coordinator）
- **Stage5 技能**: 1（复盘 Agent）

---

## 跨平台安装

本技能库通过叠加层（Overlay）机制同时支持三个 Agent 平台：

| 平台 | 技能目录 | 安装方式 |
|------|---------|---------|
| **Qoder** | `.qoder/` | 直接使用（本目录即为 Qoder 技能库） |
| **Claude Code** | `.claude/skills/` | 复制 `.claude/skills/` 到项目根目录 |
| **Trae** | `.trae/skills/` | 复制 `.trae/skills/` 到项目根目录 |

### 架构

```
skills/              ← 唯一源码（你只改这里）
overlays/            ← 平台差异覆盖层（仅写差异）
  qoder/             ← Qoder 特定内容
  claude-code/       ← Claude Code 特定内容
  trae/              ← Trae 特定内容
tools/generate.sh    ← 生成脚本（跨平台 Bash）
.qoder/skills/          ← 生成产物（Qoder 用户直接复制）
.claude/skills/      ← 生成产物（Claude Code 用户直接复制）
.trae/skills/        ← 生成产物（Trae 用户直接复制）
```

### 维护者

编辑 `skills/` 下的技能后，运行一次生成脚本同步到三个平台：

```bash
bash tools/generate.sh
```

### 用户

1. Clone 本仓库
2. 将 README.md 发给你的 AI Agent，说"安装 all-in-skills 技能库"
3. 或手动复制对应平台目录到项目根目录

### 平台差异适配

如果某个技能需要在特定平台有不同实现，在 `overlays/<平台>/<技能名>/` 下创建对应文件。生成脚本会自动优先使用覆盖层文件。详情见仓库根目录 [README.md](../README.md)。

---

### Stage5: 复盘与持续改进

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-retrospective](kf-mvp-retrospective/SKILL.md) | Pipeline + Investigator | Stage5 复盘 Agent，6 项产出 + 4 项异常检测 |

---

*最后更新: 2026-05-24*
*基于 MVP白皮书最终融合版.md v2.4.0*