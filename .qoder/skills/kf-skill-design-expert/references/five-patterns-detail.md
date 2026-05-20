# Five Design Patterns — Complete Reference

Detailed descriptions, examples, and implementation guides for the five Skill design patterns.

---

## Pattern 1: Tool Wrapper (工具包装器)

**Core idea**: Let the Agent load the right knowledge at the right time, not stuff all knowledge into the system prompt. Provide context for specific libraries/frameworks on demand.

**Use when:**
- Team internal coding convention injection
- Specific SDK/framework usage constraints
- API parameters and calling conventions
- Tech stack best practices

**Design points:**
- When rules are extensive, organize tech stack rules, conventions, best practices into reference docs in references/ (brief content goes directly in SKILL.md)
- SKILL.md monitors user prompt keywords, dynamically loads rules only when user actually operates related code
- Loaded rules applied as "absolute truth"
- Avoid context being occupied by irrelevant knowledge long-term
- Essence: "on-demand knowledge distribution"

**Reference example** (FastAPI Expert):
```text
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

## Pattern 2: Generator (生成器)

**Core idea**: Not making the Agent able to write, but making it consistently write the same structure. Suppress meaningless creativity, pursue output consistency. Instructions act as project manager, coordinating resource retrieval and forcing Agent to follow steps.

**Use when:**
- Technical reports / API docs / PRD drafts
- Standardized analysis materials / project summaries
- Unified commit messages / project architecture scaffolding
- Any batch output requiring format consistency

**Design points:**
- When templates/style guides are extensive, assets/ stores output templates, references/ stores style guides (brief content goes inline in SKILL.md)
- Instructions coordinate workflow: read style rules → read template → ask user for missing variables → fill template strictly
- Skill file doesn't contain actual layout or rules, only coordinates resource retrieval and step execution
- Every section in template must appear in final output
- Essence: "template-driven delivery system"

**Reference example** (Technical Report Generator):
```text
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

## Pattern 3: Reviewer (审查器)

**Core idea**: Separate "what to check" from "how to check". Store modular scoring criteria in external files, not in the system prompt. Swap checklist to switch review domain, no Skill rewrite needed.

**Use when:**
- Code Review / PR review automation
- Security audit (e.g., swap to OWASP checklist)
- Specification checking / document quality assessment
- Output scoring / content compliance review

**Design points:**
- Instructions stay static, responsible for review process
- Review criteria in references/review-checklist.md (replaceable) when extensive; brief criteria go directly in SKILL.md
- Agent dynamically loads checklist, checks item by item, classifies by severity: error (must fix) / warning (should fix) / info (consider)
- For each violation explain WHY (why it's a problem), not just WHAT (what the problem is)
- Essence: "pluggable rule-checking framework"

**Reference example** (Code Reviewer):
```text
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

## Pattern 4: Inversion (反转控制)

**Core idea**: Agents naturally tend to guess and generate immediately. Inversion flips this dynamic — Agent plays interviewer role, forced to prioritize context collection through explicit, non-negotiable gate instructions (e.g., "DO NOT start building until all phases are complete").

**Use when:**
- System design / project planning
- Requirements analysis / solution formulation
- Product design / architecture decisions
- Any complex task where acting on insufficient information produces wrong output

**Design points:**
- Ask structured questions in order, one at a time, wait for answer before continuing
- Set clear Phase Gates: Phase 1/2 must complete all key questions before entering generation phase
- Agent refuses to synthesize final output before having complete requirements and constraints
- Note: Phase gates depend on prompt constraints; recommend explicit confirmation points at critical stages
- Essence: "structured interviewer"

**Reference example** (Project Planner):
```text
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

## Pattern 5: Pipeline (流水线)

**Core idea**: Complex tasks need process gates, not self-discipline. Diamond gate conditions force strict sequential workflow, ensuring Agent cannot skip intermediate steps and present unverified results.

**Use when:**
- Document generation pipeline
- Multi-stage code processing
- Tasks requiring approval/confirmation
- Complex analysis workflows
- Any work that can't be done in one step

**Design points:**
- Instructions ARE the workflow definition
- Split task into non-skippable pipeline stages, each with clear actions
- Add explicit gate conditions at critical nodes (e.g., user must confirm docstrings before assembly stage)
- Use all optional directories, load specific references/assets only at specific steps, keep context window lean
- Optional Reviewer step at end for self-check
- Essence: "constrained process execution engine"

**Reference example** (Document Generation Pipeline):
```text
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

## Kiro-Inspired Spec Generation Pattern

Inspired by Kiro IDE's spec document generation approach for AI agents:

**Core idea**: Before any code generation, first produce a structured specification document that captures requirements, constraints, and design decisions. This spec becomes the single source of truth for downstream generation.

**Implementation as a pattern combination**: Inversion + Generator
1. **Inversion Phase**: Conduct structured interview to gather all requirements and constraints
2. **Spec Generation**: Produce a spec document (not code) that captures:
   - Problem statement and user stories
   - Data models and field definitions
   - Interaction flows and state machines
   - Acceptance criteria (testable)
   - Technical constraints and boundaries
3. **Gate**: User reviews and approves spec before any implementation begins
4. **Generator Phase**: Use approved spec as input to generate implementation

This pattern is particularly effective when:
- Requirements are ambiguous or incomplete
- Multiple stakeholders need to align before implementation
- The cost of getting implementation wrong is high
- Iteration on specs is cheaper than iteration on code

**Application in kf-prd-generator**: The PRD document itself serves as the "spec" — generated through Inversion (requirements interview) and used as Generator input for downstream tasks.
