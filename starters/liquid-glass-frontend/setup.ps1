# Liquid Glass Starter — 一键安装
# Usage: ./setup.ps1    (Windows PowerShell)

Write-Host ""
Write-Host "  Liquid Glass Starter — 前端脚手架初始化" -ForegroundColor Green
Write-Host ""

Write-Host "[1/2] 安装依赖..." -ForegroundColor Cyan
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ npm install 失败" -ForegroundColor Red
    exit 1
}

Write-Host "[2/2] 安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "  启动开发服务器:  npm run dev" -ForegroundColor Yellow
Write-Host "  添加新路由:      编辑 src/main.ts 的 routes 数组" -ForegroundColor Yellow
Write-Host "  创建页面:        在 src/views/ 下新建 .vue 文件" -ForegroundColor Yellow
Write-Host ""
