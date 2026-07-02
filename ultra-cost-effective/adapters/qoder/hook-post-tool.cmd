@echo off
REM UltraCostEffective Qoder PostToolUse Hook
REM Qoder 自动执行此脚本，stdin 传入 JSON（含 transcript_path）
REM 职责：解析 transcript 并更新项目级 token 追踪
setlocal enabledelayedexpansion

set "SCRIPT=d:\all-in-mvp\ultra-cost-effective\helpers\project-monitor.cjs"

if exist "%SCRIPT%" (
    node "%SCRIPT%" --hook 2>nul
) else (
    exit /b 0
)
