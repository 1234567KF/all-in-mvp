# Skill 文件工程规范（精简版）

> 提炼自 create-skill 内置技能的核心规范，供 skill-design-expert 在设计阶段按需加载。

---

## 1. 目录结构

```
skill-name/
├── SKILL.md              # 必需 — 主指令文件
├── references/            # 可选 — 详细参考文档
│   └── conventions.md
├── assets/                # 可选 — 输出模板
│   └── report-template.md
└── scripts/               # 可选 — 工具脚本
    └── validate.py
```

**存放位置**：

| 类型 | 路径 | 作用域 |
|------|------|--------|
| 个人 | `~/.qoder/skills/skill-name/` | 跨项目可用 |
| 项目 | `.qoder/skills/skill-name/` | 仅当前仓库 |

---

## 2. Frontmatter 规范

```yaml
---
name: your-skill-name          # 必填，1-64字符，小写字母/数字/连字符
description: >-                 # 必填，1-1024字符
  功能描述 + 触发条件。
  用祈使句式（Use when...），聚焦用户意图。
license: Apache-2.0             # 可选，许可证名称或 LICENSE 文件引用
compatibility: >-               # 可选，1-500字符，环境要求
  Requires Python 3.10+ and git
metadata:                       # 可选，自定义扩展字段（string→string）
  pattern: generator
  required-rules: "global-rules, java-kotlin-rules"
allowed-tools: Bash(git:*) Read # 可选（实验性），空格分隔的预批准工具列表
---
```

### name 校验规则

- 1-64 字符，仅允许小写字母(a-z)、数字、连字符(-)
- 不得以连字符开头或结尾
- **不得包含连续连字符**（如 `pdf--processing`）
- **必须与父目录名一致**（目录名 `my-skill/` → name 必须是 `my-skill`）

### Description 写法要点

- **祈使句式**：用「Use when...」「Use this skill when...」引导，而非「This skill does...」或「I can help you...」
- **聚焦用户意图**：描述用户想达成什么，而非 Skill 内部如何实现
- **宁可主动一些（pushy）**：显式列举适用场景，包括用户未直接提及领域的情况（如「even if they don't explicitly mention 'CSV'」）
- **WHAT + WHEN**：先说做什么，再说何时触发
- **包含触发词**：确保关键场景词出现在 description 中
- **简洁**：几句话到一小段，≤ 1024 字符

---

## 3. 核心编写原则

### 3.1 只写 Agent 不知道的

Agent 本身很聪明。对每段内容问：「Agent 没有这条指令会做错吗？」如果不会，删掉。聚焦项目专属惯例、领域特定流程、非显而易见的边界情况、特定工具/API 用法。

```markdown
<!-- ❌ 多余 — Agent 本身就知道 PDF 是什么 -->
PDF (Portable Document Format) 是一种常见文件格式...

<!-- ✅ 直接给 Agent 不知道的 -->
Use pdfplumber for text extraction. For scanned documents,
fall back to pdf2image with pytesseract.
```

### 3.2 SKILL.md ≤ 500 行 / < 5000 tokens

官方建议 SKILL.md 主体 < 5000 tokens（约 500 行）。超出部分放入 references/ 按需加载。

### 3.3 渐进式披露（Progressive Disclosure）

三层加载策略（官方规范）：

| 层级 | 加载时机 | Token 预算 |
|------|---------|------------|
| L1 Metadata | Agent 启动时加载所有 Skill 的 name+description | ~100 tokens/skill |
| L2 Instructions | Skill 被激活后加载完整 SKILL.md | < 5000 tokens |
| L3 Resources | 执行过程中按需加载 references/assets/scripts | 按需 |

```markdown
## 快速指引
[核心指令放这里]

## 详细参考
- 完整 API 规范见 [reference.md](references/reference.md)
- 示例见 [examples.md](references/examples.md)
```

**引用深度限制**：从 SKILL.md 直接链接到 reference 文件，不要嵌套引用（reference 引用 reference）。

### 3.4 控制力校准（Specificity ↔ Fragility）

同一个 Skill 中不同部分可以有不同的控制粒度。**按脆弱性校准**：

| 自由度 | 适用场景 | 示例 |
|--------|---------|------|
| 高（文字指令） | 多种正确方式，容错度高 | 代码审查指南 |
| 中（伪代码/模板） | 有偏好但可变通 | 报告生成 |
| 低（具体脚本） | 操作脆弱、一致性关键 | 数据库迁移 |

高自由度时解释 **WHY**（目的）比写死 HOW 更有效。低自由度时直接给出精确命令，禁止修改。

### 3.5 偏好过程而非声明

Skill 应教 Agent **如何处理一类问题**，而非给出特定实例的答案：

```markdown
<!-- ❌ 声明式 — 只能用于这一个查询 -->
Join orders to customers on customer_id, filter region='EMEA', sum amount.

<!-- ✅ 过程式 — 适用于任何分析查询 -->
1. Read schema from references/schema.yaml to find relevant tables
2. Join tables using the _id foreign key convention
3. Apply user's filters as WHERE clauses
4. Aggregate numeric columns and format as markdown table
```

### 3.6 提供默认方案，而非菜单

当多种工具/方式可行时，选一个默认方案，备选简要提及：

```markdown
<!-- ❌ 菜单式 — Agent 不知道选哪个 -->
You can use pypdf, pdfplumber, PyMuPDF, or pdf2image...

<!-- ✅ 默认方案 + 逃逸路径 -->
Use pdfplumber for text extraction.
For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

---

## 4. 常用编写模式

| 模式 | 用途 | 关键点 |
|------|------|--------|
| **模板模式** | 统一输出格式 | 提供完整模板，每个 section 必须出现 |
| **示例模式** | 质量依赖参照 | 提供 2-3 个输入→输出示例 |
| **工作流模式** | 多步骤任务 | 用 checklist 跟踪进度 |
| **条件分支模式** | 决策点 | 明确分支条件和各分支流程 |
| **反馈循环模式** | 质量关键任务 | 执行→验证→修复→重新验证 |
| **Gotchas 模式** | 环境/项目特有陷阱 | 高价值：Agent 没有就会犯错的具体事实 |

### Gotchas 章节示例

很多 Skill 中最有价值的内容就是 Gotchas — 违反常理假设的项目/环境特有事实：

```markdown
## Gotchas

- The `users` table uses soft deletes. Queries MUST include
  `WHERE deleted_at IS NULL` or results will include deactivated accounts.
- User ID is `user_id` in DB, `uid` in auth service, `accountId` in billing API.
  All three refer to the same value.
- `/health` returns 200 as long as web server runs, even if DB is down.
  Use `/ready` for full service health check.
```

> 判断标准：如果是通用常识（「handle errors appropriately」）→ 删掉。如果不说 Agent 就会做错 → 保留。

---

## 5. 反模式清单

| 反模式 | 正确做法 |
|--------|---------|
| Windows 路径 `scripts\helper.py` | Unix 路径 `scripts/helper.py` |
| 列举多个可选工具让 Agent 困惑 | 给一个默认方案 + 特殊场景备选 |
| 时间敏感信息（「如果在 2025 年之前...」） | 用 current/deprecated 分区 |
| 术语不一致（混用 API endpoint/URL/route） | 全篇统一用一个术语 |
| 模糊命名（helper、utils、tools） | 具体命名（processing-pdfs、analyzing-spreadsheets） |

---

## 6. Skill 创建方法论

### 6.1 从真实经验提炼（非凭空生成）

**方式一：从真实任务中提炼**
先在对话中完成一次真实任务，过程中注意：成功的步骤序列、你对 Agent 的纠正、输入输出格式、你提供的项目上下文。然后将可复用模式提取为 Skill。

**方式二：从项目工件中合成**
好素材：内部文档/Runbook/风格指南、API 规范/Schema、Code Review 评论、版本历史（尤其是修复补丁）、真实故障案例及修复方案。

> 关键：用项目专属材料，不要用通用「best practices」文章。

### 6.2 execute-then-revise 迭代验证

首版 Skill 通常需要打磨。对真实任务执行后：
1. 阅读 Agent **执行轨迹**（不只是最终输出）
2. 问：哪些触发了误判？哪些被遗漏？哪些可以删？
3. 如果 Agent 在无效步骤上浪费时间 → 指令太模糊 / 不相关指令太多 / 缺少默认方案

即使只做一轮 execute→revise，质量也会显著提升。

---

## 7. 交付检查清单

### 核心质量
- [ ] Description 用祈使句式（Use when...）+ 包含触发词
- [ ] Description 聚焦用户意图而非实现细节
- [ ] SKILL.md ≤ 500 行 / < 5000 tokens
- [ ] 术语全篇一致
- [ ] 示例具体而非抽象
- [ ] 每条指令都能回答「Agent 没有这条会做错吗？」

### 结构
- [ ] 引用文件保持一层深度（SKILL.md → reference，不嵌套）
- [ ] 渐进式披露合理使用
- [ ] 工作流步骤清晰
- [ ] 无时间敏感信息

### 脚本（如有）
- [ ] 依赖包已文档化
- [ ] 错误处理明确
- [ ] 无 Windows 路径

### 验证
- [ ] 使用 `skills-ref validate ./skill-name` 校验 frontmatter 合规性（[官方工具](https://github.com/agentskills/agentskills/tree/main/skills-ref)）
- [ ] name 与父目录名一致
- [ ] 无连续连字符
