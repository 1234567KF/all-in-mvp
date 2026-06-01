# Batch update recommended_model in all SKILL.md files across 3 directories
# Based on user's model selection strategy:
#   1. 长文处理 → kimi-for-coding
#   2. 脚本处理 → minimax-m2.7
#   3. 分析架构诊断 → deepseek-v4-pro
#   4. 难点编程 → qwen-3.7-Max
#   5. 简单编程 → mino-v2.5-pro

$baseDirs = @(
    "d:\all-in-mvp\.qoder\skills",
    "d:\all-in-mvp\skills",
    "d:\all-in-mvp\.trae\skills",
    "d:\all-in-mvp\.claude\skills"
)

# Model mapping by skill name
$modelMap = @{
    # 1. 长文处理 → kimi-for-coding (长文档生成)
    "kf-mvp-prd-generator"     = "kimi-for-coding"
    "kf-mvp-api-doc"           = "kimi-for-coding"
    "kf-mvp-retrospective"     = "kimi-for-coding"

    # 2. 脚本处理 → minimax-m2.7 (脚本/自动化/调度)
    "kf-mvp-cli"               = "minimax-m2.7"
    "kf-mvp-devops"            = "minimax-m2.7"
    "kf-mvp-data-migration"    = "minimax-m2.7"
    "kf-mvp-stage4-coordinator" = "minimax-m2.7"
    "kf-mvp-health-check"      = "minimax-m2.7"

    # 3. 分析架构诊断 → deepseek-v4-pro (审查/分析/诊断)
    "kf-mvp-architecture"      = "deepseek-v4-pro"
    "kf-mvp-code-review"       = "deepseek-v4-pro"
    "kf-mvp-security"          = "deepseek-v4-pro"
    "kf-mvp-testing-strategy"  = "deepseek-v4-pro"
    "kf-mvp-test-review"       = "deepseek-v4-pro"
    "kf-mvp-monitoring"        = "deepseek-v4-pro"
    "kf-mvp-performance"       = "deepseek-v4-pro"
    "kf-mvp-refactoring"       = "deepseek-v4-pro"
    "kf-mvp-caching"           = "deepseek-v4-pro"
    "kf-mvp-error-handling"    = "deepseek-v4-pro"
    "kf-mvp-api-versioning"    = "deepseek-v4-pro"
    "kf-mvp-api-contract"      = "deepseek-v4-pro"

    # 4. 难点编程 → qwen-3.7-Max (复杂实现)
    "kf-mvp-frontend-dev"      = "qwen-3.7-Max"
    "kf-mvp-auth-implementation" = "qwen-3.7-Max"
    "kf-mvp-vue-components"    = "qwen-3.7-Max"
    "kf-mvp-schema-design"     = "qwen-3.7-Max"

    # 5. 简单编程 → mino-v2.5-pro (轻量任务)
    "kf-mvp-onboarding"        = "mino-v2.5-pro"
    "kf-mvp-test-single"       = "mino-v2.5-pro"
    "kf-mvp-test-e2e"          = "mino-v2.5-pro"
    "kf-mvp-mock-service"      = "mino-v2.5-pro"

    # === 以下为补充遗漏的技能 ===
    # 1. 长文处理 → kimi-for-coding
    "kf-mvp-biz-expert"        = "kimi-for-coding"
    "kf-mvp-arch-expert"       = "kimi-for-coding"
    "kf-mvp-spec-generator"    = "kimi-for-coding"
    "kf-mvp-product-manager"   = "kimi-for-coding"
    "kf-mvp-task-splitter"     = "kimi-for-coding"

    # 2. 脚本处理 → minimax-m2.7
    "kf-pipeline-coordinator"  = "minimax-m2.7"

    # 3. 分析架构诊断 → deepseek-v4-pro
    "kf-mvp-debug"             = "deepseek-v4-pro"
    "kf-mvp-skill-design-expert" = "deepseek-v4-pro"
    "kf-mvp-tdd-helper"        = "deepseek-v4-pro"

    # 4. 难点编程 → qwen-3.7-Max
    "kf-mvp-backend-tdd"       = "qwen-3.7-Max"
    "kf-mvp-integration"       = "qwen-3.7-Max"
}

$totalUpdated = 0
$totalSkipped = 0

foreach ($baseDir in $baseDirs) {
    Write-Host "=== Processing: $baseDir ===" -ForegroundColor Cyan

    foreach ($skillName in $modelMap.Keys) {
        $skillDir = Join-Path $baseDir $skillName
        $skillFile = Join-Path $skillDir "SKILL.md"

        if (Test-Path $skillFile) {
            $newModel = $modelMap[$skillName]
            $content = Get-Content $skillFile -Raw

            # Replace recommended_model line
            $oldPattern = "recommended_model: pro"
            $newLine = "recommended_model: $newModel"

            if ($content -match [regex]::Escape($oldPattern)) {
                $newContent = $content -replace [regex]::Escape($oldPattern), $newLine
                Set-Content -Path $skillFile -Value $newContent -NoNewline
                Write-Host "  [UPDATED] $skillName → $newModel" -ForegroundColor Green
                $totalUpdated++
            } else {
                Write-Host "  [SKIPPED] $skillName — 'recommended_model: pro' not found" -ForegroundColor Yellow
                $totalSkipped++
            }
        } else {
            Write-Host "  [MISSING] $skillName — SKILL.md not found at $skillFile" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Total updated: $totalUpdated" -ForegroundColor Green
Write-Host "Total skipped: $totalSkipped" -ForegroundColor Yellow
