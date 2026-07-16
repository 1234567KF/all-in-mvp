# Skill 设计模式完整参考

> 从 SKILL.md 按需加载的详细模式文档。包含 5 大设计模式的核心理念、适用场景、设计要点、完整 YAML 示例及模式组合指南。

---

## 模式 1：Tool Wrapper（工具包装器）

**核心理念**：让 Agent 在需要时精确加载正确知识，而非将所有知识堆进系统提示词。按需提供针对特定库/框架的上下文。

**适用场景**：
- 团队内部编码规范注入
- 特定 SDK/框架的使用约束
- API 参数与调用惯例
- 技术栈最佳实践

**设计要点**：
- 当规则内容较多时，将技术栈规则、惯例、最佳实践整理为参考文档放入 references/（内容少则直接写在 SKILL.md 中）
- SKILL.md 监听用户提示中的特定关键词，仅当用户真正在操作相关代码时才动态加载规则
- 加载的规则作为"绝对真理"应用
- 避免上下文被无关知识长期占用
- 本质是"知识的按需分发"

**参考示例**（FastAPI 专家）：
```markdown
---
name: api-expert
description: FastAPI development best practices and conventions. Use when building, reviewing, or debugging FastAPI applications, REST APIs, or Pydantic models.
metadata:
  pattern: tool-wrapper
  domain: fastapi
---

You are an expert in FastAPI development. Apply these conventions to the user's code or question.

## Core Conventions
Load 'references/conventions.md' for the complete list of FastAPI best practices.

## When Reviewing Code
1. Load the conventions reference
2. Check the user's code against each convention
3. For each violation, cite the specific rule and suggest the fix

## When Writing Code
1. Load the conventions reference
2. Follow every convention exactly
3. Add type annotations to all function signatures
4. Use Annotated style for dependency injection
```

---

## 模式 2：Generator（生成器）

**核心理念**：不是让 Agent 会写，而是让它稳定地写成同一种结构。压制无意义的自由发挥，追求输出一致性。instructions 充当项目管理角色，协调资源检索并强制 Agent 按步骤执行。

**适用场景**：
- 技术报告 / API 文档 / PRD 草稿
- 标准化分析材料 / 项目总结
- 提交信息统一 / 项目架构脚手架
- 任何需要格式统一的批量输出

**设计要点**：
- 当模板/风格指南内容较多时，assets/ 存放输出模板，references/ 存放风格指南（内容少则直接内联到 SKILL.md）
- instructions 负责调度流程：先读风格规则 → 再读模板 → 缺变量就问用户 → 严格按模板填充
- Skill 文件不包含实际布局或规则，仅负责协调资源检索和步骤执行
- 模板中每个 section 都必须出现在最终输出中
- 本质是"模板驱动的交付系统"

**参考示例**（技术报告生成器）：
```markdown
---
name: report-generator
description: Generates structured technical reports in Markdown. Use when the user asks to write, create, or draft a report, summary, or analysis document.
metadata:
  pattern: generator
  output-format: markdown
---

You are a technical report generator. Follow these steps exactly:

Step 1: Load 'references/style-guide.md' for tone and formatting rules.
Step 2: Load 'assets/report-template.md' for the required output structure.
Step 3: Ask the user for any missing information needed to fill the template:
- Topic or subject
- Key findings or data points
- Target audience (technical, executive, general)
Step 4: Fill the template following the style guide rules. Every section in the template must be present in the output.
Step 5: Return the completed report as a single Markdown document.
```

---

## 模式 3：Reviewer（审查器）

**核心理念**：将"检查什么"与"如何检查"分离。将模块化的评分标准存储在外部文件中，而非堆进系统提示词。替换 checklist 即可切换审查领域，无需重写 Skill。

**适用场景**：
- Code Review / PR 审查自动化
- 安全审计（如替换为 OWASP 清单）
- 规范检查 / 文档质量评估
- 输出结果打分 / 内容合规审查

**设计要点**：
- instructions 保持静态，负责审查流程
- 审查标准较多时放入 references/review-checklist.md（可替换）；标准简短则直接写在 SKILL.md 中
- Agent 动态加载清单，逐项检查，按严重程度分级：error（必须修）/ warning（建议修）/ info（可优化）
- 对每个违规要说明 WHY（为什么是问题），而非仅说 WHAT（是什么问题）
- 本质是"可插拔的规则检查框架"

**参考示例**（代码审查器）：
```markdown
---
name: code-reviewer
description: Reviews Python code for quality, style, and common bugs. Use when the user submits code for review, asks for feedback on their code, or wants a code audit.
metadata:
  pattern: reviewer
  severity-levels: error,warning,info
---

You are a Python code reviewer. Follow this review protocol exactly:

Step 1: Load 'references/review-checklist.md' for the complete review criteria.
Step 2: Read the user's code carefully. Understand its purpose before critiquing.
Step 3: Apply each rule from the checklist to the code. For every violation found:
- Note the line number (or approximate location)
- Classify severity: error (must fix), warning (should fix), info (consider)
- Explain WHY it's a problem, not just WHAT is wrong
- Suggest a specific fix with corrected code
Step 4: Produce a structured review with these sections:
- **Summary**: What the code does, overall quality assessment
- **Findings**: Grouped by severity (errors first, then warnings, then info)
- **Score**: Rate 1-10 with brief justification
- **Top 3 Recommendations**: The most impactful improvements
```

---

## 模式 4：Inversion（反转控制）

**核心理念**：Agent 天生倾向于立即猜测和生成。Inversion 翻转这种动态——Agent 扮演面试官角色，通过明确且不可协商的门控指令（如"DO NOT start building until all phases are complete"）强制优先收集上下文。

**适用场景**：
- 系统设计 / 项目规划
- 需求分析 / 方案制定
- 产品设计 / 架构决策
- 任何信息不充分就不应动手的复杂任务

**设计要点**：
- 按顺序提出结构化问题，每次问一个，等待回答后再继续
- 设置明确的阶段门控（Phase Gate）：Phase 1/2 问完所有关键问题之前，严禁进入生成阶段
- Agent 拒绝在掌握完整需求和约束之前合成最终输出
- 注意：阶段门控依赖提示词约束，建议在关键阶段设置显式确认点
- 本质是"结构化访谈器"

**参考示例**（项目规划器）：
```markdown
---
name: project-planner
description: Plans a new software project by gathering requirements through structured questions before producing a plan. Use when the user says "I want to build", "help me plan", "design a system", or "start a new project".
metadata:
  pattern: inversion
  interaction: multi-turn
---

You are conducting a structured requirements interview. DO NOT start building or designing until all phases are complete.

## Phase 1 — Problem Discovery (ask one question at a time, wait for each answer)
Ask these questions in order. Do not skip any.
- Q1: "What problem does this project solve for its users?"
- Q2: "Who are the primary users? What is their technical level?"
- Q3: "What is the expected scale? (users per day, data volume, request rate)"

## Phase 2 — Technical Constraints (only after Phase 1 is fully answered)
- Q4: "What deployment environment will you use?"
- Q5: "Do you have any technology stack requirements or preferences?"
- Q6: "What are the non-negotiable requirements? (latency, uptime, compliance, budget)"

## Phase 3 — Synthesis (only after all questions are answered)
1. Load 'assets/plan-template.md' for the output format
2. Fill in every section of the template using the gathered requirements
3. Present the completed plan to the user
4. Ask: "Does this plan accurately capture your requirements? What would you change?"
5. Iterate on feedback until the user confirms
```

---

## 模式 5：Pipeline（流水线）

**核心理念**：复杂任务不能靠"自觉"，要靠流程闸门。通过明确的钻石门控条件（diamond gate conditions）强制执行严格的顺序工作流，确保 Agent 无法跳过中间步骤直接呈现未经验证的结果。

**适用场景**：
- 文档生成流水线
- 多阶段代码处理
- 需要审批确认的任务
- 复杂分析流程
- 任何不能"一步到位"完成的工作流

**设计要点**：
- instructions 本身即工作流定义
- 将任务拆成不能跳步的流水线，每步明确动作
- 在关键节点加显式 gate condition（如：用户确认 docstring 前不能进入组装阶段）
- 利用所有可选目录，仅在特定步骤加载对应的 references/assets，保持上下文窗口简洁
- 可在最后加 Reviewer 步骤做自检
- 本质是"受约束的流程执行引擎"

**参考示例**（文档生成流水线）：
```markdown
---
name: doc-pipeline
description: Generates API documentation from Python source code through a multi-step pipeline. Use when the user asks to document a module, generate API docs, or create documentation from code.
metadata:
  pattern: pipeline
  steps: "4"
---

You are running a documentation generation pipeline. Execute each step in order. Do NOT skip steps or proceed if a step fails.

## Step 1 — Parse & Inventory
Analyze the user's Python code to extract all public classes, functions, and constants. Present the inventory as a checklist. Ask: "Is this the complete public API you want documented?"

## Step 2 — Generate Docstrings
For each function lacking a docstring:
- Load 'references/docstring-style.md' for the required format
- Generate a docstring following the style guide exactly
- Present each generated docstring for user approval
Do NOT proceed to Step 3 until the user confirms.

## Step 3 — Assemble Documentation
Load 'assets/api-doc-template.md' for the output structure. Compile all classes, functions, and docstrings into a single API reference document.

## Step 4 — Quality Check
Review against 'references/quality-checklist.md':
- Every public symbol documented
- Every parameter has a type and description
- At least one usage example per function
Report results. Fix issues before presenting the final document.
```

---

# 模式组合指南

这些模式并非互斥，而是可以组合使用：

| 组合 | 场景 | 说明 |
|------|------|------|
| Pipeline + Reviewer | 流水线最后加审查步骤 | Pipeline 在末尾包含 Reviewer 步骤自我核对工作成果 |
| Inversion + Generator | 先采访再按模板生成 | Generator 在最开始依赖 Inversion 收集填充模板所需的变量 |
| Tool Wrapper + Generator | 加载规范后按模板生成 | 先注入专业知识，再驱动模板化输出 |
| Inversion + Pipeline | 先收集需求再分步执行 | 先结构化访谈，再按流水线分步落地 |
| Pipeline + Generator + Reviewer | 完整流水线 | 收集→生成→审查的全链路 |
