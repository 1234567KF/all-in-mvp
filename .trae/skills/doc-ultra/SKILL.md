---
name: doc-ultra
description: >-
  Load when user needs to process, optimize, check, expand, or polish formal
  documents — especially bids, patents, software copyright registrations, group
  standards, project applications, and knowledge base articles. Also for
  real-time Markdown preview with version history and diff. Triggers:
  doc-ultra, 文档处理, 文档优化, 文档检查, 文档扩写, 润色文档, 标书,
  专利, 软著, 团标, 申报书, 知识库文档, 预览, 实时预览, 文档可视化,
  看看这个文档, 对比这个文档. Do NOT load for code generation,
  code review, API design, configuration files, or database schema design.
metadata:
  pattern: pipeline+reviewer+generator
  domain: document-processing
  recommended_model: pro
  steps: "6"
---
# doc-ultra — 文档超融合处理

## Gotchas

- CLI tool `python -m doc_ultra.cli` may or may not be installed. ALWAYS try CLI first;
  if it fails with "No module named doc_ultra", fall back to manual pipeline.
- All intermediate artifacts MUST go to `.doc-ultra/` directory, never to root.
- Stage3 check loop exits after 3 rounds even if not PASS — mark unresolved issues
  with `[未决]` prefix and present to user for manual decision.
- Stage3 REJECT verdict means "return to Stage2 for re-fusion", NOT "fix in place."
- When user-provided input is a plain idea (no document file), Stage0 MUST still
  produce a 需求规格书 from the idea description before any optimization begins.
- `doc-ultra` ≠ code generator, ≠ API designer, ≠ code reviewer. If a request
  is about writing code, routing configs, or database schemas, decline and suggest
  the appropriate tool instead.
- Memory: after each pipeline run, append a structured log entry to
  `.doc-ultra/memory/pipeline-log.md` (see "Memory" section at bottom).
- **交叉引用同步**：任何章节编号修改后，MUST 立即全文搜索所有交叉引用
  （中文编号 `第[一二三…]+[章条款]`、数字引用 `见X.Y`、隐性引用 `按.*算法`）
  并同步更新，包括附录、示例、注释中的引用。
- **四级标题嵌套检查**：四级标题编号 MUST 与父级标题前缀一致
  （如父级 `### 4.2`，子级 MUST 为 `#### 4.2.x`，不得出现 `#### 15.1`）。
- **文档类型前置判定**：Stage0 MUST 先识别文档类型（标准/报告/标书/专利等），
  据此确定编号体系规范（标准→GB/T 1.1 阿拉伯数字，报告→可保留中文编号）。
- **去品牌化**：处理标准/规范类文档时，MUST 扫描并中立化企业专属术语
  （如"发码中心"→"编码管理中心"），编制依据只列国标/行标/军标/ISO。
- **标准引用核查**：所有引用的标准编号 MUST 逐条通过搜索引擎验证真实存在。
  宁删勿假——无法确认的标准引用一律删除。
- **映射 vs 统一**：描述与外部标准衔接时，MUST 使用映射语言
  （"提取…映射为…"），禁止使用"格式统一为"。
- **DOCX 文档保护**：若最终输出经 DOCX 转换，Stage5 MUST 确认
  documentProtection 已从输出文件中移除（Pandoc `--reference-doc` 会继承模板保护标记）。
- **跨文档一致性**：当处理多文档项目时，任何底层结构变更（编码规则、关键术语、
  数据结构）后 MUST grep 其他受影响文档检查引用断裂。

---

## Gate Conditions (Non-Negotiable)

| Gate | Stage | MUST pass before proceeding |
|------|-------|----------------------------|
| G0 | Stage0→Stage1 | 需求规格书 has all 5 sections (元信息/内容范围/格式约束/附件信息/质量标准) |
| G1 | Stage1→Stage2 | All 3 draft files exist and are non-empty |
| G2 | Stage2→Stage3 | Fused draft file exists and is non-empty |
| G3 | Stage3→Stage4/5 | Check report verdict is PASS |
| G4 | Stage4→Stage5 | Expanded draft exists (skip if no expansion requested) |
| G5 | Stage5→Done | Output file written, cross-reference scan and final scan passed |

**If any gate fails, DO NOT continue until the problem is resolved.**

---

## Execution Logic

### Quick Preview (No Pipeline)

When user only wants to **preview** a .md file (no optimization/checking):

```bash
python -m doc_ultra.cli <file.md>
```

This starts a preview server with:
- **Section cards** instead of plain headings — each `##` section is a foldable card
- **Version history** — every save creates a new snapshot (V0, V1, V2...)
- **Line-level diff** — click any two versions on the timeline to compare
- **Three view modes** — overlay (revision-style with tooltips), side-by-side, or single
- **Auto-refresh** — SSE push when file changes, browser updates instantly

Browser opens at `http://127.0.0.1:8765`. No document processing happens.

If the user says "预览这个文档" / "看看这个" / "可视化" without asking
for optimization → use this command. Do NOT run the pipeline.

### First: Try CLI (one command)

```bash
python -m doc_ultra.cli <input_file> -p <preset> -o <output_file> --serve
```

The `--serve` flag auto-opens preview after pipeline completes.
If `python -m doc_ultra.cli` succeeds, the entire pipeline + preview runs automatically.
Report results and stop. No manual stages needed.

**If CLI fails** (ModuleNotFoundError), proceed to manual pipeline below.

### Manual Pipeline

Execute stages 0–5 sequentially. **MUST NOT skip any stage** unless explicitly
marked optional. Each stage's output is the next stage's input.

---

#### Stage0 — 需求解析

**Input**: user-provided document file(s) or idea description
**Output**: `.doc-ultra/stage0-requirement-spec.md`

Read the input, extract structured requirements. MUST use the template in
[reference.md §Stage0](reference.md). Write the output file, then verify
Gate G0 (all 5 sections present). If any section is empty or missing, fill
it with best-effort inference and mark as `[推断]`.

#### Stage1 — 多视角并行优化 (3 Agents)

**Input**: stage0 output + original document
**Output**: 3 files: `.doc-ultra/stage1-radical.md`, `.doc-ultra/stage1-conservative.md`, `.doc-ultra/stage1-balanced.md`

Spawn 3 parallel sub-agents. Each agent gets the same input but a different
system prompt for its optimization perspective. Detailed prompts are in
[reference.md §Stage1](reference.md).

**Model routing**: coordinate on **pro**, workers on **flash** (or equivalent
high/economical split). If Agent tool supports `model` parameter, specify it
per agent.

After all 3 agents return, verify Gate G1 (all 3 files exist and non-empty).
If any agent failed, re-run that single perspective before proceeding.

#### Stage2 — 融合合成

**Input**: all 3 stage1 drafts
**Output**: `.doc-ultra/stage2-fused.md`

Use prompt from [reference.md §Stage2](reference.md). Conservative draft as
skeleton, absorb radical's structural improvements and balanced's phrasing
improvements. Use **pro** model (fusion requires reasoning + long context).

Verify Gate G2 (fused file exists and non-empty).

#### Stage3 — 拷问检查循环 ↺

**Input**: stage2 output + stage0 requirement spec
**Output**: `.doc-ultra/stage3-checked.md` + check reports per round

This is the **core quality gate**. Execute as Plan→Build→Verify→Fix loop:

```
Round 1: Check → Report → If FIX: Fix → Round 2
Round 2: Check → Report → If FIX: Fix → Round 3
Round 3: Check → Report → If FIX: mark [未决], output and ask user
Any round: REJECT → return to Stage2
Any round: PASS → break and proceed
```

Check protocol and grading (A/B/C/X) defined in [reference.md §Stage3](reference.md).

**技术文档专项检查**（在四维检查之外追加）：
- **编号交叉引用**：所有引用章节号有效且与正文一致，四级标题编号与父级匹配
- **数据结构自洽**：字段位数/位序/校验码全局一致，末位 ≤ 字段总位数
- **术语与标准引用**：无品牌化术语，标准编号全部可查证，映射关系措辞准确

Use **pro** model — quality floor cannot be lowered.

Verify Gate G3 (verdict is PASS or [未决] with user notification).

#### Stage4 — 扩写 (Optional)

**Input**: stage3 output
**Output**: `.doc-ultra/stage4-expanded.md`

ONLY execute if user explicitly requested expansion or word count target.
Use prompt from [reference.md §Stage4](reference.md). Use **flash/economical** model.

#### Stage5 — 终审抛光

**Input**: stage3 or stage4 output
**Output**: `output.md` (or user-specified path)

Execute four steps per [reference.md §Stage5](reference.md):
1. AI trace removal
2. MD→doc compatibility
3. Format unification
4. Final scan

Use **flash** model. After writing output, verify Gate G5 (cross-reference scan +
no [TODO]/[待补充] orphaned headings, or obvious grammar errors remain in the output).

**Stage5 强制检查清单**（逐项确认后方可交付）：
1. 交叉引用扫描：`grep` 所有编号引用，确认指向有效章节
2. 编号格式合规：标准文档无"第X章"残余，四级标题嵌套正确
3. DOCX 保护移除（如适用）：documentProtection 已清除
4. 无 [TODO]、[待补充]、[...] 占位符
5. 无孤立标题、无 AI 生成声明、无模板化开场白

---

## Model Routing

| Stage | Quality Sensitivity | Model Tier |
|-------|-------------------|------------|
| Stage0 | High — parsing precision | **pro** |
| Stage1 | Medium — 3× parallel volume | coordinate: **pro**, workers: **flash** |
| Stage2 | High — reasoning + long context | **pro** |
| Stage3 | Critical — quality floor | **pro** |
| Stage4 | Low — volume | **flash/economical** |
| Stage5 | Low — formatting | **flash** |

See [presets.md](presets.md) for per-document-type provider assignments.

---

## Output Template

Final output MUST follow the structure in [assets/output-template.md](assets/output-template.md).
Every required section must appear. Use the template as a skeleton, fill with
the polished content from Stage5.

---

## Report After Completion

After the pipeline finishes (either CLI or manual), MUST report to user:

```markdown
## Pipeline Complete

| Stage | Duration | Status |
|-------|----------|--------|
| Stage0 解析 | Xs | ✓ |
| Stage1 优化 | Xs | ✓ (3/3 agents) |
| Stage2 融合 | Xs | ✓ |
| Stage3 检查 | Xs | ✓ PASS (N rounds) |
| Stage4 扩写 | Xs | skipped / ✓ |
| Stage5 抛光 | Xs | ✓ |

**Output**: `path/to/output.md`
**Preset**: {preset_name} (or auto-detected)
**Preview**: `http://127.0.0.1:{port}` (if --serve used)
```

---

## Memory

After each pipeline run, log to `.doc-ultra/memory/pipeline-log.md`:

```markdown
### {ISO timestamp}
- input: {file or description}
- preset: {preset name or "auto"}
- stages completed: {list}
- check rounds: {N}
- final verdict: {PASS / 未决-{reason}}
- output: {file path}
```

Before the next run, scan the last 3 log entries. If any show repeated verification
failures for the same document type, tighten the Stage3 criteria for this run.

---

## Supporting Files

| File | When to Load |
|------|-------------|
| [reference.md](reference.md) | Always — contains full stage prompts and protocols |
| [presets.md](presets.md) | When user specifies `-p` or asks for preset recommendations |
| [assets/output-template.md](assets/output-template.md) | Stage5 — output skeleton |
| [evals.md](evals.md) | Only when debugging skill routing issues |
| `doc-ultra.config.yaml` | Stage0 — provider configuration |
