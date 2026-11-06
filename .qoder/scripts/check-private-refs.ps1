# Gate: R040 — 内部引用脱敏（v2.28）
#
# 动机：本仓会推到公开托管（GitHub）。上游 starter 与我们的文档里散落着自建
# 内网 GitLab 的 git URL、内网测试机地址与端口，这些既是指向不可达主机的死链，
# 也是基础设施暴露面。血案 B028/B029 的同族教训直接决定了本脚本的写法：
#
#   1) 判据按「形态」而不是「已知违规串枚举」。所以内网段用分隔符可选的字符类
#      表达：点号、下划线、横线、URL 百分号编码都能命中 —— 把 `.` 换成 `-`
#      或写成 %2E 不能变成逃逸通道。
#   2) 覆盖面不能写死在检查器内部而漏掉清单外的东西：文件清单用 `git ls-files`
#      （尊重 .gitignore，天然排除 node_modules/dist），非 git 目录退回递归扫描
#      并显式排除依赖目录。
#   3) 「没扫到东西」≠「通过」：一个文件都没扫到时输出 SKIPPED 且退出码非 0
#      （见 B022/B027，虚假的绿比不检查更危险）。
#   4) 其它 RFC1918 字面量（文档示例、测试夹具里的 10.x / 192.168.x 段）
#      不是本组织的内网坐标，判 WARN 并单独计数，不阻断 —— 但绝不并入 PASS，
#      输出里明确写出「WARN 计数」让读的人自己判断。
#
# 例外写法（白名单）：命中行内出现 `R040-allow: <理由>` 才放行，必须在同一行说明理由；
# 标记只在"该行确实命中内网坐标"时生效，所以文档里引用该标记的示例行不会被算成放行。
# 已声明盲区：① 只匹配 IPv4 点分及其分隔符/百分号变体，内网域名靠 HOSTS 清单显式登记，
# 未登记的新内网主机名不在范围内；② 二进制/图片里的字符串不在范围内；③ 把地址拆进多个变量
# 拼接后单行不成形的绕过方式识别不到（同 R010 盲区①）；④ 改写数值进制（八进制 0300.0250.0156.0002、
# 十六进制 0xC0A86E02、无点单整数）不成形，识别不到——这类写法人眼也读不出来，
# 真出现在基础设施配置里本身就是需要评审的异常，靠代码评审兜底而非正则；
# ⑤ 清单来自 git ls-files，未入库的本地文件不在范围。
param(
    [string]$TargetDir = ".",
    [switch]$Json
)

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }  # 中文输出需 UTF-8，否则 PS 5.1 按码页输出乱码

$ErrorActionPreference = "Stop"

# ── 内网坐标登记表（唯一真源：新增内网段/主机名只改这里）─────────────────────
# 形态：分隔符可选（. _ -），同时覆盖 URL 百分号编码变体。
# 注意：注释与文档里不得写出完整内网 IP 字面量——本脚本会被 git ls-files 扫到，
#       写出来就是让检查器把自己判成违规、门禁永久自毁红（B022 同族）。
$INTERNAL_NET_PATTERNS = @(
    # 内网 /24 段的四种书写形态：点分 / 横线 / 下划线 / 百分号编码
    '192[._\-]168[._\-]110[._\-]\d{1,3}',
    '192%2E168%2E110%2E\d{1,3}',
    '192-168-110-\d{1,3}'
)
# 内网主机名/服务名：命中即 FAIL。新组织按需登记自己的域名。
$INTERNAL_HOST_PATTERNS = @(
    '\bwecode-gitlab\b',               # 组织内网 GitLab 别名
    '\bflow-openapi\.\w+\.com/pipeline/webhook/(?!REPLACE_ME)'  # 未脱敏的真实 webhook 令牌地址
)

# 其它 RFC1918（文档/测试示例）→ WARN，不阻断，但单独计数可见
$GENERIC_PRIVATE_PATTERN = '\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b'

$failViolations = @()
$warnHits = 0
$allowlistedCount = 0
$scannedFiles = 0
$isInternalHit = $false

# ── 文件清单：优先 git ls-files（尊重 .gitignore），退回递归扫描 ──────────────
$fileList = @()
$discovery = "git"
$gitTop = $null
try {
    # -c core.quotepath=false：否则非 ASCII 路径被 git 转义成 "\346\226\207" 形态，
    # 后续 Join-Path 打不开文件会被静默跳过（漏检比误报更糟，同 B022）
    $gitTop = & git -C $TargetDir -c core.quotepath=false ls-files 2>$null
} catch {
    $gitTop = $null
}
if ($gitTop) {
    $fileList = @($gitTop -split "`r?`n" | Where-Object { $_ })
} else {
    $discovery = "filesystem"
    $fileList = @(Get-ChildItem -Path $TargetDir -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "node_modules|[\\/]\.git[\\/]|[/\\]dist[/\\]|bun\.lock|package-lock" } |
        ForEach-Object { $_.FullName.Substring((Resolve-Path $TargetDir).Path.Length + 1) })
}

# 二进制/锁文件后缀直接跳过（内容匹配无意义）
$skipExtensions = @(".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".woff", ".woff2", ".ttf", ".sqlite", ".db")

foreach ($relativePath in $fileList) {
    # 取后缀用正则而不是 [IO.Path]::GetExtension：git 对非常规字符的转义路径
    # （如 "\346\226\207" 形态）会让 GetExtension 抛「路径中具有非法字符」，
    # 在 $ErrorActionPreference=Stop 下整条门禁直接崩（B022 同族：崩溃 ≠ 通过）
    $extension = if ($relativePath -match '\.([A-Za-z0-9]{1,8})$') { $Matches[1].ToLowerInvariant() } else { "" }
    if ($skipExtensions -contains $extension) { continue }
    $absolutePath = Join-Path $TargetDir $relativePath
    if (-not (Test-Path $absolutePath -PathType Leaf)) { continue }

    # 显式 -Encoding UTF8：PS 5.1 默认按 ANSI 码页读，命中行的中文会渲染成乱码，
    # 而一条读不清的 FAIL 信息等于没有信息（检测本身是 ASCII 形态，不受影响）
    $fileContent = Get-Content $absolutePath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if (-not $fileContent) { continue }
    $scannedFiles++

    $lineNumber = 0
    foreach ($line in ($fileContent -split "`n")) {
        $lineNumber++
        $trimmed = $line.Trim()

        # 豁免只在"这一行真的命中内网坐标"时才生效。早期写法是先 `continue` 跳过整行，
        # 后果是**提到这个标记的文档行**（规则登记表、门禁清单里那些 `R040-allow: <理由>` 示例）
        # 会被计入"显式放行"，读数虚高——一条没有违规的行谈不上放行。
        $allowWithReason = ($trimmed -match 'R040-allow\s*[:：]\s*\S')

        foreach ($internalPattern in ($INTERNAL_NET_PATTERNS + $INTERNAL_HOST_PATTERNS)) {
            if ([regex]::IsMatch($line, $internalPattern, 'IgnoreCase')) {
                $isInternalHit = $true
                # 放行必须带理由：同行没写理由的仍算违规（防止无意识加白）
                if ($allowWithReason) { $allowlistedCount++ } else {
                    $failViolations += [PSCustomObject]@{
                        File = $relativePath
                        Line = $lineNumber
                        Pattern = $internalPattern
                        Snippet = $trimmed
                        Message = "内网坐标未脱敏 — 公开仓库不得包含自建内网主机/网段地址；改为 RFC 2606 占位域（example.com）或改为环境变量/CI 变量注入"
                    }
                }
                break   # 同一行只判一次
            }
        }

        # 已判违规/已放行的行不再进 WARN 计数：WARN 是「非本组织内网坐标」的旁证清单，
        # 同一行双计会让读数虚高（统计噪声，虽不影响阻断判定）
        if (-not $isInternalHit -and [regex]::IsMatch($line, $GENERIC_PRIVATE_PATTERN)) {
            $warnHits++
        }
        $isInternalHit = $false
    }
}

# 一个文件都没扫到 = 检查没发生，不能报 PASS
if ($scannedFiles -eq 0) {
    if ($Json) {
        Write-Output "{`"status`":`"SKIPPED`",`"rule`":`"R040`",`"scanned`":0,`"discovery`":`"$discovery`"}"
    } else {
        Write-Host "[SKIPPED] R040 内部引用脱敏 — 未扫到任何文本文件（发现方式: $discovery），不等于通过" -ForegroundColor Yellow
    }
    exit 2
}

if ($failViolations.Count -eq 0) {
    if ($Json) {
        Write-Output "{`"status`":`"PASS`",`"rule`":`"R040`",`"scanned`":$scannedFiles,`"discovery`":`"$discovery`",`"genericPrivateRefs`":$warnHits,`"allowlisted`":$allowlistedCount}"
    } else {
        Write-Host "[PASS] R040 内部引用脱敏 — 扫描 $scannedFiles 个文件（$discovery），无内网坐标；另有 $warnHits 处通用 RFC1918 示例（文档/测试夹具，按 WARN 计数不阻断）" -ForegroundColor Green
    }
    exit 0
} else {
    if ($Json) {
        $detailsJson = $failViolations | ConvertTo-Json -Compress   # 变量名避开 [switch]$Json（PS 变量名不区分大小写，B022）
        Write-Output "{`"status`":`"FAIL`",`"rule`":`"R040`",`"violations`":$($failViolations.Count),`"scanned`":$scannedFiles,`"details`":$detailsJson}"
    } else {
        Write-Host "[FAIL] R040 内部引用脱敏 — $($failViolations.Count) 处内网坐标未脱敏：" -ForegroundColor Red
        $failViolations | ForEach-Object {
            Write-Host "  $($_.File):$($_.Line) — $($_.Message)" -ForegroundColor Yellow
            Write-Host "    $($_.Snippet)" -ForegroundColor DarkYellow
        }
        Write-Host "  （通用 RFC1918 示例 $warnHits 处不计入违规；显式放行 $allowlistedCount 处）" -ForegroundColor DarkGray
    }
    exit 1
}
