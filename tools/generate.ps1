# all-in-skills generate script (PowerShell)
# Source: skills/ + overlays/ -> Targets: .claude/ .qoder/ .trae/
# Usage: .\generate.ps1 [qoder|claude|trae|all] [-DryRun]
param([string]$Platform = "all", [switch]$DryRun)

$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$source = Join-Path $root "skills"
$overlays = Join-Path $root "overlays"

$allTargets = @(
    @{ Name = "qoder"; SkillsDir = Join-Path $root ".qoder\skills"; RootDir = Join-Path $root ".qoder"; OverlayDir = Join-Path $overlays "qoder" },
    @{ Name = "claude-code"; SkillsDir = Join-Path $root ".claude\skills"; RootDir = Join-Path $root ".claude"; OverlayDir = Join-Path $overlays "claude-code" },
    @{ Name = "trae"; SkillsDir = Join-Path $root ".trae\skills"; RootDir = Join-Path $root ".trae"; OverlayDir = Join-Path $overlays "trae" }
)

$targets = if ($Platform -eq "all") { $allTargets } else { $allTargets | Where-Object { $_.Name -eq $Platform -or $_.Name -eq "$Platform-code" } }
if (-not $targets) {
    Write-Host "Unknown platform: $Platform. Use: qoder, claude, trae, all"
    exit 1
}
Write-Host "Platform: $Platform ($($targets.Count) target(s))`n"

$skipList = @("README.md", "references", ".gitkeep")

function IsSkill([string]$path) {
    return Test-Path (Join-Path $path "SKILL.md") -PathType Leaf
}

$skillNames = @()
Get-ChildItem -Path $source -Directory | ForEach-Object {
    if ($skipList -notcontains $_.Name -and (IsSkill $_.FullName)) {
        $skillNames += $_.Name
    }
}

Write-Host "Source: skills/ ($($skillNames.Count) skills)"
Write-Host ""

foreach ($t in $targets) {
    Write-Host "=== $($t.Name) -> $($t.SkillsDir) ==="
    if (-not (Test-Path $t.SkillsDir) -and -not $DryRun) {
        New-Item -Path $t.SkillsDir -ItemType Directory -Force | Out-Null
    }
    foreach ($skillName in $skillNames) {
        $srcDir = Join-Path $source $skillName
        $dstDir = Join-Path $t.SkillsDir $skillName
        $ovlFile = Join-Path $t.OverlayDir "$skillName\SKILL.md"
        if (Test-Path $ovlFile) {
            Write-Host "  [OVERLAY] $skillName"
            $srcDir = Join-Path $t.OverlayDir $skillName
        } else {
            Write-Host "  [COPY]    $skillName"
        }
        if (-not $DryRun) {
            # overlay 复制时排除 agents/（由后续逻辑独立复制到 .qoder/agents/）
            if (Test-Path $ovlFile) {
                # 先清理技能目录中旧版 agents/ 残留
                $agentsInSkill = Join-Path $dstDir "agents"
                if (Test-Path $agentsInSkill) {
                    Remove-Item -Path $agentsInSkill -Recurse -Force
                }
                robocopy $srcDir $dstDir /E /XD agents /NFL /NDL /NJH /NJS /NP /XO 2>&1 | Out-Null
            } else {
                robocopy $srcDir $dstDir /E /NFL /NDL /NJH /NJS /NP /XO 2>&1 | Out-Null
            }
        }
        # Copy agents/ from overlay to platform agents dir (qoder only)
        if ($t.Name -eq "qoder") {
            $ovlAgents = Join-Path $t.OverlayDir "$skillName\agents"
            if (Test-Path $ovlAgents) {
                $agentsDst = Join-Path $t.RootDir "agents"
                Write-Host "  [AGENTS]  $skillName -> .qoder\agents\"
                if (-not $DryRun) {
                    if (-not (Test-Path $agentsDst)) {
                        New-Item -Path $agentsDst -ItemType Directory -Force | Out-Null
                    }
                    Get-ChildItem -Path $ovlAgents -Filter "mvp-*.md" | ForEach-Object {
                        Copy-Item -Path $_.FullName -Destination $agentsDst -Force
                    }
                }
            }
        }
        # Copy agents/ from source to skill dir (claude-code overlay excludes agents, restore them)
        if ($t.Name -eq "claude-code" -and (Test-Path $ovlFile)) {
            $srcAgents = Join-Path $source "$skillName\agents"
            $dstAgents = Join-Path $dstDir "agents"
            if (Test-Path $srcAgents) {
                Write-Host "  [AGENTS]  restore from source"
                if (-not $DryRun) {
                    if (-not (Test-Path $dstAgents)) {
                        New-Item -Path $dstAgents -ItemType Directory -Force | Out-Null
                    }
                    robocopy $srcAgents $dstAgents /E /NFL /NDL /NJH /NJS /NP /XO 2>&1 | Out-Null
                }
            }
        }
    }
    # shared references
    $refSrc = Join-Path $source "references"
    $refDst = Join-Path $t.SkillsDir "references"
    if ((Test-Path $refSrc) -and -not $DryRun) {
        Write-Host "  [COPY]    shared references/"
        robocopy $refSrc $refDst /E /NFL /NDL /NJH /NJS /NP /XO 2>&1 | Out-Null
    }
    # Claude Code agents: 从源 agents 生成到 .claude/agents/
    if ($t.Name -eq "claude-code") {
        $srcAgentsDir = Join-Path $source "all-in-mvp\agents"
        $claudeAgentsDir = Join-Path $t.RootDir "agents"
        if (Test-Path $srcAgentsDir) {
            Write-Host "  [AGENTS]  generate for .claude\agents\"
            if (-not $DryRun) {
                if (-not (Test-Path $claudeAgentsDir)) {
                    New-Item -Path $claudeAgentsDir -ItemType Directory -Force | Out-Null
                }
                $agentDescs = @{
                    "architect" = "System architect for MVP Stage 2.1. Designs architecture, DB schema, and API contracts based on locked PRD."
                    "backend-tdd" = "Backend TDD expert for MVP Stage 3. Implements modules following Red-Green-Refactor cycle."
                    "code-reviewer" = "Code reviewer for MVP Stage 3. Reviews backend code quality, contract compliance, and exception coverage."
                    "debug-fixer" = "Debug expert for MVP Stage 4. Investigates test failures, locates root causes, and applies minimal fixes."
                    "domain-expert" = "Domain expert for MVP Stage 2.2. Splits modules, defines boundaries, and creates acceptance criteria."
                    "frontend-dev" = "Frontend dev expert for MVP Stage 3. Builds Vue 3 pages and components using Mock API."
                    "grill-review" = "Cross-review auditor for MVP Stage 2.3. Bidirectionally validates architect and domain expert outputs against PRD."
                    "mock-service" = "Mock service expert for MVP Stage 2. Creates complete mock API based on locked api-contract."
                    "msvp-verifier" = "MSVP smoke verification agent. Performs cold-start, menu check, core journey, console error detection."
                    "pipeline-coordinator" = "Pipeline coordinator for MVP Stage 3. Schedules and dispatches modules to agents based on dependency graph."
                    "pipeline-monitor" = "Read-only pipeline monitor for MVP. Scans file system to output structured pipeline status reports."
                    "pm-agent" = "Product manager agent for MVP Stage 1. Converts user requirements into MECE-complete PRD document."
                    "retrospective-agent" = "Stage5 retrospective agent. Reviews multi-agent pipeline execution and generates retrospective report."
                    "scenario-test" = "E2E scenario test agent for MVP Stage 2.6. Writes cross-module scenario tests based on PRD business flow."
                    "single-module-test" = "Module API integration test agent for MVP Stage 2.5. Writes module-level integration tests from acceptance criteria."
                    "stage4-coordinator" = "Stage4 integration coordinator. Orchestrates backend merge, frontend-backend integration, and bug fix cycles."
                    "test-review" = "Test case review agent for MVP Stage 2.7. Performs static review of test cases for coverage and consistency."
                }
                Get-ChildItem -Path $srcAgentsDir -Filter "*.md" | ForEach-Object {
                    $agentName = $_.BaseName
                    $desc = if ($agentDescs.ContainsKey($agentName)) { $agentDescs[$agentName] } else { "MVP pipeline agent: $agentName" }
                    $body = Get-Content -Path $_.FullName -Raw
                    $frontmatter = @"
---
name: $agentName
description: $desc
tools: Read, Write, Edit, Bash, Grep, Glob
---

"@
                    $outPath = Join-Path $claudeAgentsDir "$agentName.md"
                    Set-Content -Path $outPath -Value ($frontmatter + $body) -Encoding UTF8
                }
                $count = (Get-ChildItem $claudeAgentsDir -File).Count
                Write-Host "           $count agent files generated"
            }
        }
    }
    # orphans
    if ((Test-Path $t.SkillsDir) -and -not $DryRun) {
        Get-ChildItem -Path $t.SkillsDir -Directory | ForEach-Object {
            if ($_.Name -ne "references" -and $skillNames -notcontains $_.Name) {
                Write-Host "  [REMOVE]  $($_.Name)"
                Remove-Item -Path $_.FullName -Recurse -Force
            }
        }
    }
    # pipeline-monitor deployment
    $pmSrc = Join-Path $t.OverlayDir "pipeline-monitor"
    $pmDst = Join-Path $t.RootDir "pipeline-monitor"
    if (Test-Path $pmSrc) {
        Write-Host "  [MONITOR] pipeline-monitor -> $($t.RootDir)"
        if (-not $DryRun) {
            if (-not (Test-Path $pmDst)) {
                New-Item -Path $pmDst -ItemType Directory -Force | Out-Null
            }
            robocopy $pmSrc $pmDst /E /NFL /NDL /NJH /NJS /NP /XO /XD node_modules /XF *.db *.db-shm *.db-wal 2>&1 | Out-Null
        }
    }
    Write-Host ""
}
Write-Host "Done."
if ($DryRun) { Write-Host "(DRY RUN)" }
