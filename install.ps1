# ============================================================
#  all-in-mvp 椤圭洰绾ф妧鑳藉畨瑁呰剼鏈?- Windows PowerShell
# ============================================================
#
#  鐢ㄦ硶锛?
#
# 鈶?涓€琛屽懡浠わ紙鎺ㄨ崘锛夛細
#    npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp . --force
#    鈫?.claude/skills/ .qoder/skills/ .trae/skills/ 宸插湪椤圭洰鏍圭洰褰?
#    鈫?鍚姩 Qoder / Claude Code 鍗冲彲浣跨敤
#
# 鈶?楠岃瘉瀹夎锛?
#    .\install.ps1
#
# 鈶?杩滅▼涓€閿畨瑁咃紙涓嬭浇鍒板綋鍓嶇洰褰曪級锛?
#    irm https://raw.githubusercontent.com/1234567KF/all-in-mvp/all-in-mvp/install.ps1 | iex
#
# 鍘熺悊锛氭妧鑳藉湪椤圭洰绾х洰褰曪紙.claude/.qoder/.trae/skills/锛夛紝
# Agent 鑷姩璇嗗埆锛屼紭鍏堢骇楂樹簬鍏ㄥ眬銆備笉姹℃煋鍏ㄥ眬閰嶇疆銆?
# ============================================================

param(
    [switch]$Version,
    [switch]$Help
)

function Write-Success { param([string]$M) Write-Host "鉁?$M" -ForegroundColor Green }
function Write-Warning  { param([string]$M) Write-Host "鈿?$M" -ForegroundColor Yellow }
function Write-Error    { param([string]$M) Write-Host "鉁?$M" -ForegroundColor Red }
function Write-Info     { param([string]$M) Write-Host "鈩?$M" -ForegroundColor Blue }
function Write-Header   { param([string]$M) Write-Host $M -ForegroundColor Cyan }

function Test-Command { param([string]$C) return [bool](Get-Command -Name $C -ErrorAction SilentlyContinue) }

# --- 妫€娴嬮」鐩骇鎶€鑳界洰褰?---
function Check-Skills {
    Write-Host ""
    Write-Info "妫€娴嬮」鐩骇鎶€鑳界洰褰?.."
    $missing = $false

    foreach ($dir in @(".claude\skills", ".qoder\skills", ".trae\skills")) {
        $full = Join-Path $script:SCRIPT_DIR $dir
        if (Test-Path $full) {
            $count = (Get-ChildItem $full -Directory -ErrorAction SilentlyContinue).Count
            Write-Success "$dir 宸插氨缁紙$count 涓妧鑳斤級"
        } else {
            Write-Warning "$dir 缂哄け"
            $missing = $true
        }
    }

    return -not $missing
}

# --- 杩滅▼妯″紡锛氫笅杞芥妧鑳藉埌褰撳墠椤圭洰鐩綍 ---
function Download-Skills {
    if (-not (Test-Command "npx")) {
        Write-Error "闇€瑕?Node.js / npx锛岃鍏堝畨瑁?
        exit 1
    }

    Write-Info "浠?GitHub 涓嬭浇鎶€鑳藉埌椤圭洰鐩綍..."

    foreach ($target in @(".claude/skills", ".qoder/skills", ".trae/skills")) {
        Write-Info "涓嬭浇 $target..."
        $dst = Join-Path $script:SCRIPT_DIR $target
        npx.cmd giget "gh:1234567KF/all-in-mvp#all-in-mvp/$target" $dst --force
        Write-Success "$target 涓嬭浇瀹屾垚"
    }
}

# --- 妫€娴嬪凡瀹夎鐨?AI Agent ---
function Get-Agents {
    $agents = @()
    if (Test-Path "$env:USERPROFILE\.qoder")  { $agents += "qoder";  Write-Success "妫€娴嬪埌 Qoder" }
    if (Test-Path "$env:USERPROFILE\.claude") { $agents += "claude"; Write-Success "妫€娴嬪埌 Claude Code" }
    if ($agents.Count -eq 0) {
        Write-Warning "鏈娴嬪埌宸插畨瑁呯殑 AI Agent"
        Write-Info "鎶€鑳藉凡鍦ㄩ」鐩洰褰曪紝瀹夎 Agent 鍚庡嵆鍙娇鐢?
    }
    return $agents
}

# --- 甯姪 ---
function Show-Help {
    Write-Host "all-in-mvp 椤圭洰绾ф妧鑳藉畨瑁?(PowerShell)"
    Write-Host ""
    Write-Host "鎶€鑳芥斁鍦ㄩ」鐩牴鐩綍 .claude\skills\ .qoder\skills\ .trae\skills\"
    Write-Host "Agent 鑷姩璇嗗埆锛岄」鐩骇浼樺厛锛屼笉姹℃煋鍏ㄥ眬銆?
    Write-Host ""
    Write-Host "涓€琛屽懡浠わ細"
    Write-Host "  npx.cmd giget gh:1234567KF/all-in-mvp#all-in-mvp . --force"
}

# --- 涓诲嚱鏁?---
function Main {
    $script:SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

    if ($Version) { Write-Host "all-in-mvp installer v2.9.1"; return }
    if ($Help)    { Show-Help; return }

    Write-Header "============================"
    Write-Header "  all-in-mvp 椤圭洰绾ф妧鑳?v2.9.1"
    Write-Header "============================"

    if (Check-Skills) {
        Write-Host ""
        Write-Success "鎵€鏈夋妧鑳藉凡灏辩华锛?
    } else {
        Write-Info "涓嬭浇缂哄け鐨勬妧鑳藉埌椤圭洰鐩綍..."
        Download-Skills
        Write-Host ""
        Check-Skills | Out-Null
    }

    Write-Host ""
    $agents = Get-Agents
    Write-Host ""
    Write-Header "========================"
    Write-Success "瀹屾垚锛?
    Write-Host ""
    Write-Info "鎶€鑳界洰褰曪紙椤圭洰绾э級锛?
    Write-Host "  .claude\skills\  .qoder\skills\  .trae\skills\"
    Write-Host ""
    Write-Info "浣跨敤鏂规硶锛?
    Write-Host "  鍦ㄦ湰椤圭洰鐩綍鍚姩 Qoder / Claude Code"
    Write-Host "  杈撳叆锛氫娇鐢?all-in-mvp 鍒涘缓涓€涓?CRM 绯荤粺"
    Write-Host ""
}

Main

