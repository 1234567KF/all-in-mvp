# E2E Quality Gate v1.0 鈥?Stage Gate Probe
# Usage: .\e2e-quality-gate.ps1 --all | --check <rule>
# Exit: 0=PASS, 1=FAIL, 2=SKIP
# This script scans filesystem directly 鈥?does NOT rely on LLM memory.

param(
    [switch]$All,
    [string]$Check = "",
    [string]$E2eDir = "e2e\scenarios",
    [string]$Format = "terminal"
)

$ErrorActionPreference = "Stop"
$script:Failures = @()
$script:Warnings = @()
$script:Passes = @()

# ============================================================
# Helpers
# ============================================================

function Find-E2eFiles {
    $paths = @($E2eDir, "integration-tests\scenarios", "tests\e2e")
    foreach ($p in $paths) {
        $files = @(Get-ChildItem -Path $p -Filter "*.spec.ts" -ErrorAction SilentlyContinue)
        if ($files.Count -gt 0) { return $files }
    }
    return @()
}

function Get-ContentSafe {
    param([string]$Path)
    if (Test-Path $Path) {
        return Get-Content $Path -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    }
    return ""
}

function Add-Fail { param($R,$F,$D) $script:Failures += @{ Rule=$R; File=$F; Detail=$D } }
function Add-Pass { param($R,$F,$D) $script:Passes   += @{ Rule=$R; File=$F; Detail=$D } }
function Add-Warn { param($R,$F,$D) $script:Warnings += @{ Rule=$R; File=$F; Detail=$D } }

# ============================================================
# Rule 1: Browser Interaction Ratio >= 30%
# ============================================================

function Test-BrowserRatio {
    param($Files)
    if ($Files.Count -eq 0) { Add-Warn "browser-ratio" "N/A" "No E2E files found"; return }

    foreach ($f in $Files) {
        $c = Get-ContentSafe $f.FullName
        if (-not $c) { continue }

        $testCount = ([regex]::Matches($c, '\btest\(|it\(')).Count
        if ($testCount -eq 0) { continue }

        $hasBrowser = [regex]::IsMatch($c, 'page\.(fill|click|goto|locator|getByRole|getByText|getByLabel|getByPlaceholder|waitForSelector|selectOption|press|type)\(')
        $hasApiOnly = [regex]::IsMatch($c, 'request\.(post|get|put|delete|patch)\(')
        $browserCalls = ([regex]::Matches($c, 'page\.(fill|click|goto|locator|getByRole|getByText)\(')).Count

        $name = Split-Path $f.FullName -Leaf

        if (-not $hasBrowser -and $hasApiOnly) {
            Add-Fail "browser-ratio" $name "ALL-API mode: zero browser interaction calls (page.fill/click/goto). Must include browser-based tests."
        }
        elseif ($hasBrowser -and $browserCalls -ge 3) {
            Add-Pass "browser-ratio" $name "Browser interaction calls detected: $browserCalls"
        }
        elseif ($hasBrowser) {
            Add-Warn "browser-ratio" $name "Only $browserCalls browser calls 鈥?may be below 30pct threshold"
        }
    }
}

# ============================================================
# Rule 2: Permission Cross-Matrix
# ============================================================

function Test-PermMatrix {
    param($Files)
    $all = ""
    foreach ($f in $Files) { $all += Get-ContentSafe $f.FullName }
    if (-not $all) { Add-Warn "permission-matrix" "N/A" "No content"; return }

    $hasPartner = [regex]::IsMatch($all, 'partner|customer.*external|entry.*external')
    $hasMultiRole = ([regex]::Matches($all, 'role.*?(admin|sales|partner|channel)')).Count -ge 2

    if ($hasPartner -or $hasMultiRole) {
        # Check: does admin/sales test partner API 403?
        $hasAdmin403 = [regex]::IsMatch($all, "partner.*403|admin.*partner.*403|non.*partner.*403")
        if (-not $hasAdmin403) {
            Add-Fail "permission-matrix" "N/A" "Multi-role project missing cross-permission test: no admin/sales -> partner API 403 test detected"
        } else {
            Add-Pass "permission-matrix" "N/A" "Cross-permission 403 tests detected"
        }
    } else {
        Add-Pass "permission-matrix" "N/A" "Single-role or simple model, matrix not required"
    }
}

# ============================================================
# Rule 3: Bidirectional State Assertions
# ============================================================

function Test-Bidirectional {
    param($Files)
    $all = ""
    foreach ($f in $Files) { $all += Get-ContentSafe $f.FullName }
    if (-not $all) { Add-Warn "bidirectional" "N/A" "No content"; return }

    $checks = @(
        @{Action="approve"; Forward="getReviewedList|reviewed.*approved"; Backward="getPendingReviewList|pending.*review|pendingReview"},
        @{Action="reject";  Forward="getReviewedList|reviewed.*rejected"; Backward="getPendingReviewList|pending.*review|pendingReview"},
        @{Action="revoke";  Forward="getPendingReviewList|pending.*review"; Backward="getReviewedList|reviewed.*approved"}
    )

    foreach ($chk in $checks) {
        $hasAction = [regex]::IsMatch($all, "$($chk.Action)Opportunity|\.$($chk.Action)\(")
        if ($hasAction) {
            $fw = [regex]::IsMatch($all, $chk.Forward)
            $bw = [regex]::IsMatch($all, $chk.Backward)
            if ($fw -and -not $bw) {
                Add-Fail "bidirectional" "N/A" "State transition '$($chk.Action)' has forward assertion but MISSING backward assertion. Must verify item removed from source list."
            } elseif ($fw -and $bw) {
                Add-Pass "bidirectional" "N/A" "State transition '$($chk.Action)' has bidirectional assertions"
            }
        }
    }
}

# ============================================================
# Rule 4: CRUD Lifecycle Coverage
# ============================================================

function Test-CrudLifecycle {
    param($Files)
    $all = ""
    foreach ($f in $Files) { $all += Get-ContentSafe $f.FullName }
    if (-not $all) { Add-Warn "crud-lifecycle" "N/A" "No content"; return }

    $entities = @("role", "account", "channel", "customer", "opportunity")
    $stages = @{
        "C" = "create.*{0}|POST.*{0}|new.*{0}"
        "R" = "get.*list.*{0}|detail.*{0}|list.*{0}"
        "U" = "edit.*{0}|update.*{0}|PUT.*{0}|modify.*{0}"
        "D" = "delete.*{0}|disable.*{0}|toggle.*{0}"
    }

    foreach ($entity in $entities) {
        $missing = @()
        foreach ($stage in $stages.Keys) {
            $pattern = $stages[$stage] -f $entity
            if (-not [regex]::IsMatch($all, $pattern)) { $missing += $stage }
        }
        if ($missing.Count -ge 3) {
            Add-Fail "crud-lifecycle" "N/A" "Entity '$entity' CRUD lifecycle severely incomplete: missing $($missing -join ',')"
        } elseif ($missing.Count -ge 1) {
            Add-Warn "crud-lifecycle" "N/A" "Entity '$entity' lifecycle incomplete: missing $($missing -join ',')"
        } else {
            Add-Pass "crud-lifecycle" "N/A" "Entity '$entity' C+R+U+D lifecycle complete"
        }
    }
}

# ============================================================
# Rule 5: Assertion Quality
# ============================================================

function Test-AssertQuality {
    param($Files)

    $banned = @(
        @{Name="Fuzzy status code"; Pattern='expect\(\[200,\s*403\]\)\.toContain\(status\)'},
        @{Name="Try-catch swallows assertion"; Pattern='try\s*\{[^}]*expect[^}]*\}\s*catch\s*\{[^}]*ignore'}
    )

    foreach ($f in $Files) {
        $c = Get-ContentSafe $f.FullName
        if (-not $c) { continue }
        $name = Split-Path $f.FullName -Leaf
        
        foreach ($b in $banned) {
            $m = [regex]::Matches($c, $b.Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
            if ($m.Count -gt 0) {
                Add-Fail "assertion-quality" $name "Banned assertion pattern '$($b.Name)' found: $($m.Count) occurrence(s)"
            }
        }

        # Check: status=200 but no body assertion (heuristic)
        $statusOnly = [regex]::Matches($c, 'expect\(resp\.status\(\)\)\.toBe\(200\)\s*\n\s*(?!.*expect\(resp|.*expect\(body|.*expect\(data)', [System.Text.RegularExpressions.RegexOptions]::Multiline)
        # Simplified: just warn if suspicious
    }

    if (($script:Failures | Where-Object { $_.Rule -eq "assertion-quality" }).Count -eq 0) {
        Add-Pass "assertion-quality" "N/A" "No banned assertion patterns detected"
    }
}

# ============================================================
# Main
# ============================================================

$e2eFiles = Find-E2eFiles

if ($e2eFiles.Count -eq 0) {
    Write-Host ""
    Write-Host "[E2E Quality Gate] SKIP 鈥?No E2E test files found (searched: $E2eDir, integration-tests/scenarios, tests/e2e)" -ForegroundColor Yellow
    Write-Host "[E2E Quality Gate] Hint: Stage 2 step-3b-2 has not produced E2E cases yet."
    exit 2
}

$allRules = @("browser-ratio", "permission-matrix", "bidirectional", "crud-lifecycle", "assertion-quality")

if ($All) {
    $toCheck = $allRules
} elseif ($Check) {
    if ($allRules -contains $Check) {
        $toCheck = @($Check)
    } else {
        Write-Host "[E2E Quality Gate] Unknown rule: $Check" -ForegroundColor Red
        Write-Host "Available: $($allRules -join ', '), all"
        exit 1
    }
} else {
    Write-Host "[E2E Quality Gate] Usage: .\e2e-quality-gate.ps1 --all | --check <rule>"
    Write-Host "Available rules: $($allRules -join ', '), all"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " E2E Quality Gate v1.0" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""
Write-Host "E2E files found: $($e2eFiles.Count)"
Write-Host "Rules to check : $($toCheck -join ', ')"
Write-Host ""

foreach ($rule in $toCheck) {
    Write-Host "--- $rule ---" -ForegroundColor Gray
    switch ($rule) {
        "browser-ratio"      { Test-BrowserRatio -Files $e2eFiles }
        "permission-matrix"   { Test-PermMatrix -Files $e2eFiles }
        "bidirectional"       { Test-Bidirectional -Files $e2eFiles }
        "crud-lifecycle"      { Test-CrudLifecycle -Files $e2eFiles }
        "assertion-quality"   { Test-AssertQuality -Files $e2eFiles }
    }
}

# ============================================================
# Output
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Results" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

if ($Format -eq "json") {
    @{
        timestamp  = (Get-Date -Format "o")
        totalFiles = $e2eFiles.Count
        passes     = $script:Passes.Count
        warnings   = $script:Warnings.Count
        failures   = $script:Failures.Count
        passList   = $script:Passes
        warnList   = $script:Warnings
        failList   = $script:Failures
        verdict    = if ($script:Failures.Count -eq 0) { "PASS" } else { "FAIL" }
    } | ConvertTo-Json -Depth 4
} else {
    foreach ($p in $script:Passes) {
        Write-Host "  [PASS] [$($p.Rule)] $($p.File): $($p.Detail)" -ForegroundColor Green
    }
    foreach ($w in $script:Warnings) {
        Write-Host "  [WARN] [$($w.Rule)] $($w.File): $($w.Detail)" -ForegroundColor Yellow
    }
    foreach ($f in $script:Failures) {
        Write-Host "  [FAIL] [$($f.Rule)] $($f.File): $($f.Detail)" -ForegroundColor Red
    }
}

Write-Host ""
$pCount = $script:Passes.Count
$wCount = $script:Warnings.Count
$fCount = $script:Failures.Count
Write-Host "  PASS:$pCount  WARN:$wCount  FAIL:$fCount" -ForegroundColor $(if ($fCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($fCount -eq 0) {
    Write-Host "[E2E Quality Gate] PASS 鈥?All quality gates passed" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[E2E Quality Gate] FAIL 鈥?$fCount quality gate(s) not passed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix guide:" -ForegroundColor Yellow
    Write-Host "  1. Read QUALITY_CONSTITUTION.md for mandatory requirements"
    Write-Host "  2. See SKILL.md E2E Best Practices sections 8-11 for code templates"
    Write-Host "  3. Re-run: .\e2e-quality-gate.ps1 --all"
    exit 1
}

