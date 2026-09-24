# quality-gate-hook.ps1 -- Qoder PostToolUse hook (replaces v2.18 settings.json#qualityGates)
#
# Why: Qoder CLI settings.json does NOT read a "qualityGates" key (unknown keys are ignored),
#      so file-path -> skill auto-triggering was inert. Qoder DOES support hooks:
#      https://docs.qoder.com/zh/cli/hooks-reference
#      {"hooks": {"PostToolUse": [{"matcher": "Write|Edit", "hooks": [{"type":"command","command":"..."}]}]}}
#
# Contract:
#   stdin  : hook JSON { tool_name, tool_input: { file_path, ... }, tool_response, ... }
#   match  -> write reminder to stderr, exit 2  (agent sees the text; the write itself is NOT undone)
#   no hit -> exit 0 silently
#   This script never writes or deletes files, and never blocks a tool call before it runs.
#
# Keep messages ASCII: Windows PowerShell 5.1 renders non-ASCII stdout as mojibake unless the
# console codepage is switched to 65001. Chinese detail lives in .qoder/rules/quality-gate.md.

$ErrorActionPreference = 'SilentlyContinue'

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
try { $inp = $raw | ConvertFrom-Json } catch { exit 0 }

# --- resolve the affected file path from tool_input (field name differs per tool) ---
$path = $null
if ($inp.tool_input) {
    foreach ($k in @('file_path', 'filePath', 'notebook_path', 'path')) {
        $v = $inp.tool_input.$k
        if ($v) { $path = [string]$v; break }
    }
}
if (-not $path) { exit 0 }

$p = ($path -replace '\\', '/').ToLower()

# --- skip noise: dependencies, build output, and this framework's own skill sources ---
if ($p -match 'node_modules|(^|/)(dist|build|coverage|playwright-report)/|(^|/)\.qoder/skills/|(^|/)\.qoder/agents/') { exit 0 }

$gates = @()

# Gate 1 -- source code changed -> independent code review (kf-mvp-code-review / mvp-code-reviewer)
if ($p -match '(^|/)(src|packages/shared/src|apps/[^/]+/src)/.*\.(ts|tsx|vue|js|jsx)$') {
    $gates += 'CODE REVIEW: dispatch subagent "mvp-code-reviewer" (skill kf-mvp-code-review) for this change.'
}

# Gate 2 -- API route / service / shared type changed -> field & enum contract check
if ($p -match '(^|/)(src/(services|api|routes)|apps/api/src/routes|packages/shared/src)/') {
    $gates += 'CONTRACT CHECK: run skill "kf-mvp-test-review" to verify front/back field + enum consistency (rules R002, R014).'
}

# Gate 3 -- shared UI / pages changed -> smoke verification in a real browser
if ($p -match '(^|/)(src|apps/web/src)/(components/(ui|common)|pages|views)/') {
    $gates += 'SMOKE VERIFY: run subagent "mvp-verifier" (MSVP smoke) and confirm every control in dialogs/lists is visible (rules R020, R021).'
}

if ($gates.Count -eq 0) { exit 0 }

$msg = @(
    '[QUALITY-GATE] Auto gate triggered by: ' + $path
) + $gates + @(
    'Do not mark this task COMPLETE before the above actions are done.',
    'See .qoder/rules/quality-gate.md for the checklist; blood cases in .qoder/PLAYBOOK.md (B019, B020).'
)
[Console]::Error.WriteLine(($msg -join "`n"))
exit 2
