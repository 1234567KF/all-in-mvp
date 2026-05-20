---
name: kf-skill-design-expert
description: >-
  Load when user asks to design, create, review, or optimize a Claude Code
  skill (触发: "设计Skill", "创建Skill", "优化Skill", "审查Skill", "skill design",
  "固化经验", "技能设计"). Also load when evaluating whether a skill's benefit
  exceeds its context-window tax.
metadata:
  pattern: inversion + tool-wrapper + reviewer
  domain: skill-design
recommended_model: pro
graph:
  dependencies:
    - target: kf-add-skill
      type: dependency
    - target: kf-code-review-graph
      type: semantic
---

# Skill Design Expert — Perplexity-Inspired Six-Step Methodology

> **Core belief**: A Skill is a **model-facing runtime context unit** — not code, not a config file, not documentation. It encapsulates team experience, rules, and processes into a structure an Agent can reliably execute at runtime. And **every Skill is a tax** — every session and every user pays its token cost. The only question: does the benefit exceed the tax?

**Division of labor**: This Skill focuses on **content architecture design** (which pattern, how to organize execution logic, what to include vs. exclude). File engineering conventions (frontmatter, directory structure, description format) follow the file-engineering-spec in `references/file-engineering-spec.md`.

---

# Core Philosophy

Derived from Perplexity's *"Designing, Refining, and Maintaining Agent Skills at Perplexity"* and our own Harness Engineering system:

1. **Skill ≠ documentation** — It's a runtime context unit injected into the model. The model reads it and acts on it. Write for the model, not for humans.
2. **Description = Router** — A wrong description degrades ALL other skills (off-target loading causes action-at-a-distance). This is the hardest and most important line in the entire Skill.
3. **Gotchas > Instructions** — The model already knows how to do things. What it doesn't know are your project's specific traps, naming inconsistencies, and edge cases. Gotchas are the highest-signal content.
4. **Every Skill is a tax** — Before adding anything, ask: *"Would the Agent get this wrong without it?"* If not, it cannot afford to be there. "I have only made this letter longer because I have not had the time to make it shorter."
5. **Evals before content** — Write evaluation cases first. Negative examples (when the Skill should NOT load) often matter more than positive ones.
6. **Multi-model reality** — Skills must work across model families (Claude Opus, Claude Sonnet, DeepSeek, etc.). They behave differently with the same Skill.
7. **Append-mostly maintenance** — After shipping, the gotchas section accrues the most value. Failure → add gotcha. Wrong load → tighten description. Missed load → add keyword.

---

# Six-Step Skill-Building Methodology

> This replaces the old 5-step workflow. It's inspired by Perplexity's process + our Harness verification loop.

## Step 0: Write Evals First

**Do not write a single line of the Skill before you have evaluation cases.**

Source eval cases from three places:

| Source | Description | Example |
|--------|-------------|---------|
| **Real user queries** | Sampled from production or your team's common requests | "帮我写个 FastAPI 的 CRUD" |
| **Known failures** | Cases where the Agent failed because this Skill didn't exist | "上次没装这个 Skill，Agent 用了错误的 API" |
| **Neighbor confusion** | Queries close to your domain boundary that should route to ANOTHER skill | "这个请求应该触发 X Skill，不是我们" |

**Eval structure** (one JSON/Markdown file per Skill):

```markdown
# Evals for {skill-name}

## Positive (Skill SHOULD load)
| # | User Query | Expected: loads? | Notes |
|---|-----------|-----------------|-------|
| 1 | "帮我用 FastAPI 写个登录接口" | YES | Core trigger |
| 2 | "这个 endpoint 的 dependency injection 怎么写" | YES | Sub-domain |

## Negative (Skill should NOT load)
| # | User Query | Expected: loads? | Notes |
|---|-----------|-----------------|-------|
| 3 | "用 Express 写个 middleware" | NO | Different framework |
| 4 | "FastAPI 和 Django 哪个好" | NO | Comparison, not implementation |
```

**Negative examples are extremely powerful and can matter more than positive examples.** They prevent the most expensive failure mode: a Skill loading when it shouldn't, making every other Skill slightly worse.

**Gate 0**: Do not proceed to Step 1 until at least 3 positive AND 3 negative eval cases exist.

---

## Step 1: Write the Description (The Router)

**The description is a routing trigger, not documentation.** It determines when the Skill loads. A bad description explains what the Skill does; a good one says **when to load it**.

### Description Checklist

- [ ] Starts with "Load when..."
- [ ] ≤ 50 words (Perplexity target) — shorter is better; every extra word increases false-trigger risk
- [ ] Describes **user intent**, ideally phrased as real user queries
- [ ] Does NOT summarize the workflow or list what the Skill "can do"
- [ ] Includes explicit Chinese/English trigger keywords
- [ ] Clearly defines the domain boundary (what's IN scope and what's OUT)

### Example: Good vs. Bad

```yaml
# BAD — describes what the Skill does internally
description: This skill helps with FastAPI development. It provides best practices,
  code patterns, Pydantic model generation, and dependency injection guidance.

# GOOD — describes when to load, from user's perspective
description: Load when user asks to build, debug, or review a FastAPI application,
  REST API endpoint, or Pydantic model. Triggers: FastAPI, fastapi, Pydantic,
  dependency injection, API开发, 接口开发, 路由定义.
```

**Key failure modes:**
- **Off-target loading**: Skill loads for queries outside its domain → degrades all other skills
- **Missed loading**: Skill doesn't load when it should → user gets wrong answer
- **Spillover**: Adding one Skill subtly changes routing for seemingly unrelated queries

**Gate 1**: Run the description against all Step 0 eval cases. Does it trigger on all positives? Does it NOT trigger on all negatives? If any fail, rewrite the description.

---

## Step 2: Write the Body (Gotchas-First)

**The body is NOT documentation.** It's runtime context the model reads to avoid mistakes. The model already knows general best practices — what it needs are the **project-specific traps** that would cause it to fail.

### Body Writing Rules

1. **Skip the obvious.** Don't explain what a REST API is. Don't list `git add; git commit; git push`. The model knows.
2. **Don't write command lists.** Instead of "Step 1: run X, Step 2: run Y", give high-level intent: "Cherry-pick the commit onto a clean branch based off main."
3. **Gotchas are the highest-signal content.** Things the model would get wrong without being told:
   - Naming inconsistencies across the codebase (`user_id` in DB, `uid` in auth, `accountId` in billing)
   - Soft-delete conventions (must add `WHERE deleted_at IS NULL`)
   - Environment-specific traps (`/health` returns 200 even when DB is down)
   - Implicit ordering assumptions
4. **Move conditional/heavy content to references/.** If something is only needed in specific scenarios, don't put it in SKILL.md — reference it conditionally: "If the API returns a non-200 status, load `references/api-errors.md`."
5. **Use constraints, not suggestions.** MUST / MUST NOT with clear consequences, not "consider" / "maybe" / "it depends."

### Gotchas Section Template

```markdown
## Gotchas

- The `users` table uses soft deletes. All queries MUST include
  `WHERE deleted_at IS NULL` or results will include deactivated accounts.
- User identifier is `user_id` in the database, `uid` in the auth service,
  and `accountId` in the billing API. All three refer to the same value.
- The `/health` endpoint returns 200 as long as the web server is running,
  even if the database is down. Use `/ready` for a full service health check.
- [Project-specific trap #4]
```

> If removing a sentence wouldn't cause the Agent to get it wrong, **delete it.**

---

## Step 3: Use Directory Hierarchy (Hub-and-Spoke)

Leverage progressive disclosure — the model sees SKILL.md first, then loads accessory files only when needed.

### Directory Decision Table

| Directory | Purpose | When to Use | Loading Trigger |
|-----------|---------|-------------|-----------------|
| **SKILL.md** | Core instructions + gotchas | Always | Skill activation (L2) |
| `references/` | Heavy docs, detailed specs, domain knowledge | Content > 50 lines or conditional | "Load `references/x.md` if..." |
| `assets/` | Templates, schemas, output skeletons | Structured output needed | "Use `assets/template.md` for output format" |
| `scripts/` | Deterministic code the Agent shouldn't reinvent | Computations, validations, transforms | "Run `scripts/validate.py` to check" |
| `config.json` | First-run user setup, environment config | User-specific settings needed | Skill installation |

### Progressive Loading Rules

- **L1 (Metadata)**: Agent loads all Skill name+description at startup (~100 tokens/skill)
- **L2 (Instructions)**: Agent loads full SKILL.md body after activation (<5000 tokens)
- **L3 (Resources)**: Load references/assets/scripts as needed during execution

**Simple Skills keep everything in SKILL.md.** Only split to references/ when content exceeds 500 lines / 5000 tokens, or when conditional loading is needed.

### Hub-and-Spoke Anti-Patterns

- One giant flat reference directory → overwhelming, model performs worse
- Deeply nested references (reference → reference → reference) → violates single-hop rule
- Everything in SKILL.md → bloated context, slow activation, cache misses

---

## Step 4: Iterate (Branch → Evals → Tweak)

**Never edit a Skill on main.** Work on a branch:

1. Start with NO Skill → run hero queries → confirm they fail
2. Build the Skill → run all evals → check failures
3. Tweak description, gotchas, instructions → re-run evals
4. Repeat until all eval cases pass
5. Merge to main → archive evals to `memory/skill-evals/`

**Eval tracking**: Each Skill has an eval file in `memory/skill-evals/{skill-name}.md`. Update it whenever the Skill ships a meaningful change.

---

## Step 5: Quality Self-Check

Review against this checklist:
- [ ] Clear execution logic, not just "help me do XX"?
- [ ] Correct pattern application?
- [ ] Instructions in natural language, not explicit tool references?
- [ ] Output format explicit and stable?
- [ ] Constraints specific and executable (MUST / MUST NOT)?
- [ ] No "one Skill doing too many things"?
- [ ] Phase gates strict enough for Inversion/Pipeline patterns?
- [ ] SKILL.md named correctly?
- [ ] Frontmatter only contains standard fields (name, description, license, compatibility, metadata, allowed-tools)?
- [ ] Custom extension fields (pattern, required-rules) inside metadata?
- [ ] Description uses imperative style ("Load when..." not "This skill does...")?
- [ ] Description focuses on user intent, lists trigger scenarios explicitly?
- [ ] Description within 1-1024 characters?
- [ ] Each instruction answers "Would the Agent get this wrong without it?" (remove common knowledge)
- [ ] Gotchas section for project/environment-specific traps? (if applicable)

---

## Step 6: Delivery & Iteration

Write the completed Skill file to the specified directory with usage recommendations.

**Iteration**: Suggest user execute on a real task, then read the Agent's execution trace (not just final output), identify misjudgments, omissions, and redundant instructions, and iterate.

---

# Five Design Patterns

> Core insight: Specifications solve how a Skill is packaged, but what makes it useful is **content design** — does it have clear execution logic, is it injecting knowledge or constraining process, is it helping generate or review, does it let the Agent act immediately or ask questions first.

> Key mechanism: Skills follow three-level Progressive Disclosure — L1 Agent loads all Skill name+description at startup (~100 tokens) → L2 Agent loads full SKILL.md body after activation (<5000 tokens) → L3 Load references/assets/scripts as needed during execution.

> Directory convention: references/, assets/, scripts/ are **optional**. Simple Skills can keep everything in SKILL.md; only split when content exceeds 500 lines / 5000 tokens, or when step-by-step loading is needed.

Load `references/five-patterns-detail.md` for the complete pattern descriptions, examples, and implementation guides. Summary:

## Pattern 1: Tool Wrapper (Knowledge On-Demand)

**Core idea**: Load the right knowledge at the right time, not all knowledge into the system prompt.

- **Use when**: Team coding conventions, SDK/framework constraints, API parameters, tech stack best practices
- **Design**: Rules in references/ (or inline if brief), SKILL.md monitors keywords, loads dynamically, applies as "absolute truth"
- **Essence**: "On-demand knowledge distribution"

## Pattern 2: Generator (Template-Driven Delivery)

**Core idea**: Not making the Agent able to write, but making it consistently write the same structure. Suppress meaningless creativity.

- **Use when**: Reports, API docs, PRD drafts, standardized analysis, commit messages, project scaffolding
- **Design**: assets/ for output templates, references/ for style guides, instructions coordinate: read style → read template → ask for missing vars → fill template strictly
- **Essence**: "Template-driven delivery system"

## Pattern 3: Reviewer (Pluggable Rule Checker)

**Core idea**: Separate "what to check" from "how to check". Modular scoring criteria in external files.

- **Use when**: Code review, security audit, compliance checking, document quality, output scoring
- **Design**: instructions stay static, review criteria in references/review-checklist.md (replaceable), severity levels: error/warning/info, explain WHY not just WHAT
- **Essence**: "Pluggable rule-checking framework"

## Pattern 4: Inversion (Structured Interviewer)

**Core idea**: Agents tend to guess and generate immediately. Inversion flips this — Agent plays interviewer, forced to collect context first via non-negotiable gate instructions.

- **Use when**: System design, project planning, requirements analysis, architecture decisions — any task where incomplete information leads to wrong output
- **Design**: Ask structured questions one at a time, set Phase Gates (DO NOT proceed until all phases complete), refuse to synthesize output before requirements are fully gathered
- **Essence**: "Structured interviewer"
- **Note**: Phase gates depend on prompt constraints; set explicit confirmation points at critical stages

## Pattern 5: Pipeline (Constrained Process Engine)

**Core idea**: Complex tasks need process gates, not self-discipline. Diamond gate conditions force strict sequential workflow.

- **Use when**: Document generation pipeline, multi-stage code processing, approval workflows, complex analysis, any workflow that can't be done in one step
- **Design**: instructions ARE the workflow definition, split into non-skippable stages, explicit gate conditions at critical nodes, load references/assets only at specific steps, optional Reviewer step at end
- **Essence**: "Constrained process execution engine"

---

# Pattern Selection Decision Tree

1. **Does the Agent need specific library/framework expertise?** → **Tool Wrapper**
2. **Does output need the same structure every time?** → **Generator**
3. **Is the task checking/reviewing rather than generating?** → **Reviewer**
4. **Does the Agent need to collect extensive information before starting?** → **Inversion**
5. **Does the task have multiple sequential stages that can't be skipped?** → **Pipeline**

---

# Pattern Combination Guide

| Combination | Scenario | Description |
|------------|----------|-------------|
| Pipeline + Reviewer | Pipeline with final review step | Pipeline includes Reviewer step for self-check |
| Inversion + Generator | Interview first, then template generation | Generator depends on Inversion to collect template variables |
| Tool Wrapper + Generator | Load specs then generate from template | Inject expertise first, then drive template output |
| Inversion + Pipeline | Collect requirements then execute step by step | Structured interview first, then constrained workflow |
| Pipeline + Generator + Reviewer | Full pipeline | Collect → Generate → Review end-to-end |

---

# Harness Feedback Loop

| Step | Verification Action | Failure Handling |
|------|-------------------|------------------|
| Step 1 | `node {IDE_ROOT}/helpers/harness-gate-check.cjs --skill kf-skill-design-expert --stage step1 --required-sections "## 核心问题" "## 推荐模式"` | Supplement diagnosis |
| Step 3 | `node {IDE_ROOT}/helpers/harness-gate-check.cjs --skill kf-skill-design-expert --stage step3 --required-sections "## frontmatter" "## instructions" --forbidden-patterns TODO 待定` | Go back and supplement |
| Step 4 | `node {IDE_ROOT}/helpers/harness-gate-check.cjs --skill kf-skill-design-expert --stage step4 --required-files "SKILL.md" --forbidden-patterns "❌"` | Fix defects |

Verification principle: **Plan → Build → Verify → Fix** forced loop. No subjective "I think it's fine."

---

# Constraints

**MUST DO:**
- Always perform pattern selection analysis before creating a Skill
- Explain pattern choice reasons to the user
- Quality self-check on generated Skills
- Consider pattern combinations for complex Skills
- Write Skill content in user's preferred language
- Name Skill files `SKILL.md`
- Frontmatter must follow official spec

**MUST NOT DO:**
- Skip requirements diagnosis and generate Skill directly
- Put too many unrelated responsibilities in one Skill
- Explicitly reference tool names in system prompt (e.g., "use Read tool")
- Ignore phase gate design for Inversion/Pipeline patterns
- Generate Reviewer Skills without constraints
- Use non-standard fields in frontmatter top level (e.g., `tools`, `required_rules`) — custom fields go in `metadata`

---

## Harness Engineering Review System

| Resource | Path | Purpose |
|---------|------|---------|
| **Review system doc** | `references/harness-engineering-audit.md` | Five Iron Rules scoring criteria, review process, report template |
| **Auto audit script** | `../../helpers/harness-audit.cjs` | Full-path scan of kf- skills, auto-generate score matrix + systemic defect analysis |
| **Gate verification script** | `../../helpers/harness-gate-check.cjs` | Mechanized gate verification (required-files / required-sections / forbidden-patterns) |

### Trigger Methods

```bash
# Full audit
node {IDE_ROOT}/helpers/harness-audit.cjs --all

# Single skill audit
node {IDE_ROOT}/helpers/harness-audit.cjs --skill kf-mvp

# Detailed diagnosis
node {IDE_ROOT}/helpers/harness-audit.cjs --all --verbose

# JSON output (for CI consumption)
node {IDE_ROOT}/helpers/harness-audit.cjs --all --format json
```

### Review Process

1. User says "Harness review" / "Five Iron Rules audit" / "audit"
2. Run `node {IDE_ROOT}/helpers/harness-audit.cjs --all --verbose`
3. Fix issues by priority from the systemic defects analysis
4. Re-audit to verify fixes

### History Tracking

Audit results auto-archived to `memory/harness-audit-history.md`, each audit outputs trend comparison.
