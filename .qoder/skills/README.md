# MVP 多Agent并行开发流程 — 技能清单

> 本目录包含 all-in-mvp 项目多 Agent 并行开发流程所需的所有技能。

## 概述

本目录实际存在 **26 个技能**（每个都有可解析的 `SKILL.md`，Qoder 会自动识别并按 `description` 触发词召回）。
白皮书早期版本规划过 43 项，其中 17 项至今未落地 —— 它们在旧版清单里以"技能"出现但没有目录，链接全部失效，现统一列在文末「规划中（尚无 SKILL.md）」。

| Stage | 技能 | 用途 |
|-------|------|------|
| **核心** | all-in-mvp, kf-pipeline-coordinator, grill-with-docs | 流水线编排 + 调度 + 交叉审查 |
| **Stage1 需求** | kf-mvp-prd-generator, kf-mvp-arch-expert, kf-mvp-biz-expert | 需求 → 架构 → 模块划分 |
| **Stage2 规划** | kf-mvp-api-contract, kf-mvp-schema-design, kf-mvp-mock-service, kf-mvp-test-single, kf-mvp-test-e2e, kf-mvp-test-review, kf-mvp-testing-strategy, kf-mvp-playwright-infra | 契约 + Mock + 测试设计 |
| **Stage3 开发** | kf-mvp-backend-tdd, kf-mvp-frontend-dev, kf-mvp-code-review, kf-mvp-vue-components, kf-mvp-auth-implementation, kf-mvp-error-handling | TDD 开发 + 审查 |
| **Stage4 集成** | kf-mvp-stage4-coordinator, kf-mvp-security, kf-mvp-performance | 联调 + 安全 + 性能 |
| **辅助 / Stage5** | kf-mvp-retrospective, kf-skill-design-expert, kf-web-search | 复盘 + 技能设计 + 检索 |

---

## 核心流程技能

### 核心

| 技能 | 模式 | 描述 |
|------|------|------|
| [all-in-mvp](all-in-mvp/SKILL.md) | Pipeline + Inversion + Reviewer + Generator | 主入口：4 Stage 流水线、模式判定矩阵、门禁探针 |
| [kf-pipeline-coordinator](kf-pipeline-coordinator/SKILL.md) | Pipeline | 任务调度器，依赖图驱动 + 专家匹配 |
| [grill-with-docs](grill-with-docs/SKILL.md) | Reviewer + Pipeline | 拷问审查，交叉校验架构产出与 PRD |

### Stage1: 需求对齐

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-prd-generator](kf-mvp-prd-generator/SKILL.md) | Inversion + Generator | PRD 生成，输出完整 MECE 需求文档 |
| [kf-mvp-arch-expert](kf-mvp-arch-expert/SKILL.md) | Generator + Tool Wrapper | 生成 spec.md + schema.sql + api-contract.yaml |
| [kf-mvp-biz-expert](kf-mvp-biz-expert/SKILL.md) | Inversion + Pipeline | 模块拆分与验收标准制定 |

### Stage2: 计划阶段

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-api-contract](kf-mvp-api-contract/SKILL.md) | Tool Wrapper + Reviewer | API 契约 / DTO / 错误码设计（路径唯一真源） |
| [kf-mvp-schema-design](kf-mvp-schema-design/SKILL.md) | Tool Wrapper | 数据库表结构与 Drizzle/SQLite schema 设计 |
| [kf-mvp-mock-service](kf-mvp-mock-service/SKILL.md) | Generator | 按锁定契约生成 Mock 服务（③a） |
| [kf-mvp-test-single](kf-mvp-test-single/SKILL.md) | Generator + Reviewer | 单模块集成测试编写（③b-1） |
| [kf-mvp-test-e2e](kf-mvp-test-e2e/SKILL.md) | Generator | 业务条线端到端场景测试（③b-2 / Stage3.5 适配） |
| [kf-mvp-test-review](kf-mvp-test-review/SKILL.md) | Reviewer | 测试用例静态审查（③c） |
| [kf-mvp-testing-strategy](kf-mvp-testing-strategy/SKILL.md) | Tool Wrapper | 测试策略与分层 |
| [kf-mvp-playwright-infra](kf-mvp-playwright-infra/SKILL.md) | Tool Wrapper | playwright.config、CI、截图基线、浏览器池 |

### Stage3: 执行阶段

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-backend-tdd](kf-mvp-backend-tdd/SKILL.md) | Pipeline | 后端 TDD，Red-Green-Refactor 循环 |
| [kf-mvp-frontend-dev](kf-mvp-frontend-dev/SKILL.md) | Tool Wrapper | 前端开发，React + Vite + Mock API（默认栈） |
| [kf-mvp-code-review](kf-mvp-code-review/SKILL.md) | Reviewer | 代码审查 + 契约合规 + 异常覆盖 |
| [kf-mvp-vue-components](kf-mvp-vue-components/SKILL.md) | Tool Wrapper | Vue 3 组件模式（仅当项目显式选 Vue 时） |
| [kf-mvp-auth-implementation](kf-mvp-auth-implementation/SKILL.md) | Tool Wrapper | 认证与授权实现，JWT + RBAC |
| [kf-mvp-error-handling](kf-mvp-error-handling/SKILL.md) | Tool Wrapper | 错误处理与响应模式 |

### Stage4: 集成与验收

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-stage4-coordinator](kf-mvp-stage4-coordinator/SKILL.md) | Pipeline | 后端合并、前后端联调、Bug 派发、回滚的总调度 |
| [kf-mvp-security](kf-mvp-security/SKILL.md) | Reviewer + Tool Wrapper | 安全审查（OWASP / 认证授权 / 敏感数据） |
| [kf-mvp-performance](kf-mvp-performance/SKILL.md) | Tool Wrapper | 性能优化与 profiling |

### 辅助 / Stage5

| 技能 | 模式 | 描述 |
|------|------|------|
| [kf-mvp-retrospective](kf-mvp-retrospective/SKILL.md) | Pipeline + Investigator | Stage5 复盘：6 项产出 + 4 项异常检测 |
| [kf-skill-design-expert](kf-skill-design-expert/SKILL.md) | Meta | 技能设计六步法 + 上下文税评估 |
| [kf-web-search](kf-web-search/SKILL.md) | Tool Wrapper | 多引擎智能搜索（国内/文档/国际三场景） |

---

## 技能设计原则

基于 [kf-skill-design-expert](kf-skill-design-expert/SKILL.md) 的六大步骤：

1. **写 Evals First** — 先定义评估用例
2. **写 Description** — Description = Router（路由触发器），Qoder 全靠它自动召回
3. **写 Body** — Gotchas 优先（项目特定陷阱）
4. **使用目录层级** — Hub-and-Spoke，重内容放 `references/` 按需加载
5. **迭代分支** — Branch → Evals → Tweak → Merge
6. **Quality Self-Check** — 质量自检清单

---

## 五种设计模式

| 模式 | 适用场景 | 技能示例 |
|------|----------|----------|
| **Tool Wrapper** | 需要特定技术/框架知识 | kf-mvp-schema-design, kf-mvp-frontend-dev |
| **Generator** | 输出结构需要一致 | kf-mvp-prd-generator, kf-mvp-mock-service |
| **Reviewer** | 检查/审查任务 | kf-mvp-code-review, grill-with-docs |
| **Inversion** | 需要收集大量信息 | kf-mvp-prd-generator, kf-mvp-biz-expert |
| **Pipeline** | 多阶段流程 | all-in-mvp, kf-pipeline-coordinator |

---

## 使用方式

每个技能目录下包含：
- `SKILL.md` — 技能主文件（frontmatter 首字节必须是 `---`，**不能带 UTF-8 BOM**，否则 description 解析不到、技能不会自动触发）
- `references/` — 可选参考资料（不进上下文，按需读取）
- `assets/` — 可选模板文件

激活技能时，Qoder 会自动加载对应目录下的 `SKILL.md`。

---

## 技能统计

- **实际存在**: 26（核心 3 / Stage1 3 / Stage2 8 / Stage3 6 / Stage4 3 / 辅助+Stage5 3）
- **子 Agent**: 18（见 `.qoder/agents/`）
- **门禁规则**: 21（R001–R021，见 `.qoder/gate-rules.yaml`）
- **血案**: 20（B001–B020，见 `.qoder/PLAYBOOK.md`）

### 规划中（尚无 SKILL.md，旧清单曾计入）

kf-mvp-product-manager, kf-mvp-spec-generator, kf-mvp-task-splitter, kf-mvp-api-versioning,
kf-mvp-debug, kf-mvp-tdd-helper, kf-mvp-refactoring, kf-mvp-architecture, kf-mvp-integration,
kf-mvp-devops, kf-mvp-health-check, kf-mvp-data-migration, kf-mvp-monitoring, kf-mvp-onboarding,
kf-mvp-api-doc, kf-mvp-caching, kf-mvp-cli — 共 17 项。26 + 17 = 43，即历史 README 中"43 个技能"的来源。


---

## 安装（Qoder 单平台）

本技能库直接以 Qoder 项目级技能形式提供，无需生成脚本或覆盖层：

| 平台 | 技能目录 | 安装方式 |
|------|---------|---------|
| **Qoder** | `.qoder/skills/` | 直接使用（本目录即为 Qoder 技能库） |

### 架构

```
.qoder/
├── skills/          ← 技能源码（你只改这里）
├── agents/          ← 子 Agent 定义（流水线角色）
├── rules/           ← 门禁行为规则
├── gate-rules.yaml  ← 规则单一真源（R001-R021）
├── PLAYBOOK.md      ← 血案库
└── settings.json    ← 项目配置（model + hooks 门禁）；scripts/ 存放 .ps1 门禁脚本
```

### 用户

1. 在项目根目录执行安装命令（见仓库根目录 [README.md](../../README.md)）
2. 或将本 `.qoder/` 目录整体复制到目标项目根目录
3. 重启 Qoder 后，技能的 `description` 触发词即可自动召回

---

*最后更新: 2026-09-24（Qoder 单平台迁移；技能清单按仓库实际内容校正）*
*基于 MVP白皮书最终融合版.md v2.5.0*