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
