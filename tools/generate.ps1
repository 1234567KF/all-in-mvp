# all-in-skills generate script (PowerShell)
# Source: skills/ -> Targets: .qoder/ .claude/skills/ .trae/skills/
param([switch]$DryRun)

$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$source = Join-Path $root "skills"
$overlays = Join-Path $root "overlays"

$targets = @(
    @{ Name = "qoder"; Dir = Join-Path $root ".qoder\skills"; OverlayDir = Join-Path $overlays "qoder" },
    @{ Name = "claude-code"; Dir = Join-Path $root ".claude\skills"; OverlayDir = Join-Path $overlays "claude-code" },
    @{ Name = "trae"; Dir = Join-Path $root ".trae\skills"; OverlayDir = Join-Path $overlays "trae" }
)

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
    Write-Host "=== $($t.Name) -> $($t.Dir) ==="
    if (-not (Test-Path $t.Dir) -and -not $DryRun) {
        New-Item -Path $t.Dir -ItemType Directory -Force | Out-Null
    }
    foreach ($skillName in $skillNames) {
        $srcDir = Join-Path $source $skillName
        $dstDir = Join-Path $t.Dir $skillName
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
                $agentsDst = Join-Path (Split-Path $t.Dir -Parent) "agents"
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
    }
    # shared references
    $refSrc = Join-Path $source "references"
    $refDst = Join-Path $t.Dir "references"
    if ((Test-Path $refSrc) -and -not $DryRun) {
        Write-Host "  [COPY]    shared references/"
        robocopy $refSrc $refDst /E /NFL /NDL /NJH /NJS /NP /XO 2>&1 | Out-Null
    }
    # orphans
    if ((Test-Path $t.Dir) -and -not $DryRun) {
        Get-ChildItem -Path $t.Dir -Directory | ForEach-Object {
            if ($_.Name -ne "references" -and $skillNames -notcontains $_.Name) {
                Write-Host "  [REMOVE]  $($_.Name)"
                Remove-Item -Path $_.FullName -Recurse -Force
            }
        }
    }
    Write-Host ""
}
Write-Host "Done."
if ($DryRun) { Write-Host "(DRY RUN)" }
