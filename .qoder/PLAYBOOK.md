# Playbook — 血案库

> **用途**：按需查阅，不占用 Agent 上下文。每个血案对应一条 gate-rules.yaml 中的规则。
> **查阅方式**：Agent 遇到规则违反时，Coordinator 引用血案 ID 告知后果。

---

## v2.26 血案（同步外部真实代码时，暴露的是我们的门禁）

### B025 — "已清零"的声明被大小写敏感的守卫 grep 骗过两轮
- **规则**：verify-all-in-mvp.ps1 新增可执行行「PS 自动变量撞名」（不再是文档承诺）
- **现象**：v2.24.1 记录"全仓 `^\s*\$(Matches|Home|...)\s*=` 扫描已干净"。本轮复跑发现仍有 3 处
  小写 `$matches = [regex]::Matches(...)`（`check-api-endpoints.ps1:24/49`、`check-api-path-source.ps1:54`）。
  PowerShell 变量名**不区分大小写**，而当时的守卫用了大小写敏感的正则 → 声明与事实不符。
- **为什么没炸**：`foreach ($m in $matches)` 在进入循环时已绑定枚举器，中途被 `-match` 覆写 `$matches`
  不影响当次遍历 —— 属于**潜在**而非现行故障，因此两轮"全绿"都没暴露它。
- **教训**：① 声称"已清零"的判据本身必须可执行、可复查，文档不是门禁；
  ② 任何大小写不敏感语言（PS / SQL 表名 / Windows 路径）的静态扫描，默认加 `-i`；
  ③ "现在不报错"不等于"没踩自动变量"，改写管道或 while 循环即触发。
- **落地**：该扫描已进 `verify-all-in-mvp.ps1`（违例样本实测命中并定位到行号；`$null = cmd` 这类
  标准丢弃写法已排除，避免把惯用法当违规）。

### B026 — 门禁第一次对上外部真实代码，误报了 4 处
- **规则**：R015（禁止静默吞错误）
- **现象**：同步上游脚手架后 stage3/stage4 双双 BLOCKED，`check-silent-catch.ps1` 报了
  `useNotificationStream.ts` 3 处 + 一个测试 finally 1 处 `.catch(() => {})`。
  实际代码是 `await response.body?.cancel().catch(() => {})` —— **释放已取消流的收尾惯用法**，
  且同一处紧邻的 `console.warn` 已经把业务失败显式化。
- **处置**：改门禁不改业务。判据按语义分叉：紧跟 `cancel|abort|close|destroy|releaseLock|return`
  的空 catch 放行，其余仍 FAIL；用"业务吞错 + 两处收尾"三行样本做正反验证（FAIL 定位第 2 行，收尾行不误报）。
- **教训**：① 门禁只在自家代码上验证过 = 没验证过，第一次跑外部代码必然暴露判据粗；
  ② 遇到误报先问"它拦的是不是同一类错误"，不要让被检查方为了过门改形（那会制造更差的代码）；
  ③ 白名单要点名，通配豁免等于没豁免。

## v2.25 血案（技能注册"看起来在，实际没注册"）

### B024 — 门面技能 frontmatter 解析失败，App 侧列表静默 omit
- **规则**：R029（配套 Gate 0：编辑 `SKILL.md` 后 `hooks.PostToolUse` 直接跑校验）
- **现象**：用严格 YAML 解析器复核全仓 46 个 frontmatter，唯一 FAIL 就是门面技能
  `.qoder/skills/all-in-mvp/SKILL.md` → `mapping values are not allowed here`。
  它仍出现在会话的可用技能清单里（Agent 侧加载器宽容），但按 Qoder 的严格解析路径它会被整块丢弃 ——
  触发词写得最全的那个技能，恰恰是注册最不稳的那个
- **根因**：`description:` 是 plain scalar，值里却含 `": "`（`Triggers: MVP, 原型开发…` / `NOT for: single API…`）。
  YAML 把第二个 `: ` 当成嵌套映射分隔符 → 整个 frontmatter 作废。"触发词列表"这种写法本身就在制造该坑
- **教训**：① 含 `: ` 的字段一律改块标量（`description: >-` + 缩进）或整体加引号，别指望加载器宽容；
  ② **两侧解析器宽严不对称 → "Agent 能调到"不能证明"注册成功"**，裁决权交给严格解析器；
  ③ 门禁要能响：本次故意写坏一个临时技能，Gate 0 立刻 `exit 2` 阻断，才是有效验证 —— 只验"全绿"证明不了检测能力（同 B022/B023）；
  ④ 同族反向坑：**`.ps1` 含中文必须带 UTF-8 BOM**（PowerShell 5.1 无 BOM 时按 ANSI 码页读，字符串定界符被吞 → 整个脚本语法报错），
     而 **`SKILL.md` 必须无 BOM**（BOM 会粘进首个键名）。两个方向相反，改完必须分别用对应加载器复核

---

## v2.24 血案（门禁脚本"静默漏检"）

### B022 — 门禁脚本崩溃却被判定为通过
- **规则**：R022-R028 的执行载体（`.qoder/scripts/check-*.ps1`）
- **现象**：`check-token-sync.ps1` / `check-silent-catch.ps1` / `check-liquid-glass-style.ps1` 带 `-Json` 且真有违规时，输出
  `无法将值"System.String"转换为类型"SwitchParameter"`，且不产出 JSON；`sync-qoder-homes.ps1` 里 `foreach ($home in ...)` 直接抛
  `无法覆盖变量 HOME`；用 `-Json` 的调用方拿到空/脏 stdout 无法解析
- **根因**：① PowerShell 变量名**不区分大小写** → 局部 `$json` 与 `param([switch]$Json)` 同名，赋值即类型冲突；② `$HOME` 是只读自动变量、`$matches` 是 `-match` 每轮都会被覆写的自动变量；③ 脚本用 `$ErrorActionPreference = "Continue"`，崩溃后继续走到末尾 `exit 0`；④ `-File` 下 `Write-Host` 与 JSON 混进同一 stdout（`check-api-path-source.ps1` 的两个 skip 分支就是漏掉 `-Json` 分支，把 `[SKIP]` 文本吐进了机器可读输出）；⑤ 取退出码时管道给了 `tail` → `$?` 永远是 tail 的 0，把 rc=1 读成 rc=0
- **教训**：门禁脚本一律 `$ErrorActionPreference = "Stop"`（需要容错的具体 cmdlet 单独 `-ErrorAction SilentlyContinue`）；`-Json` 分支禁止任何 `Write-Host`；局部变量避开自动变量与开关同名（统一 `$detailsJson` / `$contractMatches` / `$homeDir`，并全仓 `grep -E '^\s*\$(Matches|Home|Host|Input|Error|PSItem)\s*='` 扫过一遍）；**跳过必须报 SKIPPED 而不是 PASS**（`checked=0` / 无前端源码 / 无 contract 文件三种情形都已改）；测退出码必须先落盘再判，不许 `... | tail; echo $?`

### B023 — 权威脚手架 arch-check.ts 在 Windows 上完全失效
- **规则**：R022-R025（TS 侧权威实现，PowerShell 门禁镜像它）
- **现象**：`bun run arch:check` 报 `ENOENT: scandir '\D:\...\apps\web\src'`；即便路径侥幸可用，Rule 1/2/4 也一条都不会触发
- **根因**：`new URL("..", import.meta.url).pathname` 在 Windows 得到 `/D:/...`，`join` 后变成非法的 `\D:\...`；`node:path.relative()` 返回**反斜杠**，而规则用 `rel.startsWith("apps/web/src/components/")` 和 `pageFile.split("/")` 匹配 POSIX 分隔符 → 永远为假，静默漏检
- **教训**：任何跨平台路径判定必须先归一化分隔符（`toPosix()`），并用 `fileURLToPath` 而不是 `URL.pathname`；两套实现（TS 权威 + PS 门禁）要**用同一个违例样本交叉验证**，只验"全绿"证明不了检测能力

---

## v2.20 血案（技能框架与权威脚手架断裂）

### B021 — 技能框架 Vue/React 双栈混写 + token 镜像漂移
- **规则**：R022-R028（对齐 React 权威脚手架）
- **现象**：4 份技能文件分别声明 Vue 3 / React 19：`mvp-tech-stack-default.md` 说 Vue 3 + Pinia + shadcn/vue，`kf-mvp-frontend-dev` 说 React 19 但模板是 `<script setup>` + `ref()` 混写 `useState`，`references/liquid-glass/theme-tokens.css` 与脚手架权威源 diff 不一致
- **根因**：先把 Liquid Glass 风格"抄"成 Vue 适配版，但权威脚手架 `starters/liquid-glass-frontend/` 实际是 React 19 + shadcn/ui；镜像 token 手工维护导致漂移；架构规则（services 分层/React.lazy/toast 封装）从未进入门禁
- **教训**：设计体系可跨框架，但技术栈必须单一真源；镜像文件必须脚本同步（`check-token-sync.ps1`），禁止手工双份维护；脚手架已有的 `arch-check.ts` 四条规则必须镜像进 gate（R022-R025）

---

## v2.14 血案

### B014 — fetchChannelOptions() 静默失败
- **规则**：R015 禁止静默吞错误
- **现象**：前端调用 `fetchChannelOptions().catch(() => {})`，端点 `/channels/options` 不存在，渠道下拉永远为空，无任何错误提示
- **排查**：数小时才发现路径根本不存在——代码中静默吞掉了 404 错误
- **教训**：`.catch(() => {})` 空回调 = 定时炸弹。至少 `console.warn(err)`

---

## v2.16 血案（多Agent并行开发反模式 — 复盘总结）

### B015 — 侧边栏权限过滤未实现
- **规则**：R017 集成点全链路检查
- **现象**：后端 `buildPermissions()` 正确返回有限权限（6 项），auth store 的 `hasMenu()` 判断函数正确，但侧边栏渲染全部菜单项——第三层从未被实现
- **诊断链路**：`buildPermissions() → user.menus ✅ → hasMenu("system:account") 返回 false ✅ → SidebarMenuContent 没调用 hasMenu() ❌`
- **教训**：跨 Agent 的集成点必须在设计阶段显式列出 数据层→判断层→渲染层 链路，每层分配 owner

### B016 — UserMenu 硬编码 "ADMIN"
- **规则**：R018 UI 数据源绑定
- **现象**：所有用户（无论角色）在右上角下拉菜单都显示 "ADMIN" 和头像 "A"
- **根因**：UserMenu 组件用硬编码字符串代替从 auth store 读取动态数据
- **教训**：所有显示用户姓名/角色/权限的 UI 组件必须从 useAuthStore 读取，禁止硬编码

### B017 — refreshToken 使用过期缓存
- **规则**：R019 服务器响应权威数据源
- **现象**：页面刷新后 token 自动刷新，但用户数据使用的是登录时的旧缓存，而非 `/auth/refresh` 返回的最新数据
- **根因**：`refreshAccessToken()` 中 `setAuth({ user: oldUser })`，忽略了服务器返回的 `user` 字段
- **教训**：认证状态变更函数必须优先使用服务器返回的最新数据。客户端不是权威数据源，服务器响应才是

### B018 — Dashboard 统计返回对象而非数组
- **规则**：R001 响应格式标准化（扩展：空值约定）
- **现象**：`GET /dashboard/stats` 返回 `statusDistribution: {"未跟进": 0, ...}`（对象），前端期望 `[{name: "未跟进", value: 0}]`（数组）
- **根因**：后端 service 直接返回字面量对象，未与前端约定具体数据结构
- **教训**：列表类数据永远返回 `[]`，永不返回 `null` 或 `{}`。空值约定：数组→[], 数值→0, 对象→{}

### B013 — /channels/options 端点不存在
- **规则**：R014 API 端点存在性交叉校验
- **现象**：前端 services/x.ts 中写了 `/channels/options`，但所有后端路由表（Mock + 真实）都没有这个路径
- **根因**：前端 Agent 自行发明了路径，contract-drift-log 只看已有条目变更，不会发现新增的私有路径
- **教训**：Stage 4.2 联调前必须扫描前端所有 api.xxx() 调用，与 contract/Mock/routes 交叉比对

### B012 — 渠道下拉无选项
- **规则**：R013 UI 数据加载路径必测
- **现象**：API 测试全绿，但人工点击"创建客户"弹窗，渠道下拉为空
- **根因**：API 层测试通过的端点 ≠ UI 组件能拿到数据。下拉渲染依赖的是另一条 API 调用链
- **教训**：@headed E2E 必须覆盖弹窗下拉选项渲染验证

---

## v2.13 血案

### B011 — E2E 92/92 全绿但真实后端登录失败
- **规则**：R009 E2E 双模验收
- **现象**：E2E 92 条用例全部通过，交付后人工启动真实 SQLite 后端，快捷登录立即报"密码错误"
- **根因**：所有 E2E 跑在内存 Mock 服务器上。Mock 的密码验证逻辑与真实 bcrypt 完全不同
- **教训**：E2E 必须跑 Mock + Real 两轮，只跑 Mock = 假绿色

### B010 — Mock 7 个账号、真实 DB 只种了 1 个
- **规则**：R010 种子数据单一真源
- **现象**：Mock 数据有 7 个测试账号，真实 SQLite 只 seed 了 1 个 admin，前端快捷登录按钮全部失效
- **根因**：Mock 数据和 DB seed 脚本各自维护了两份独立的账号列表
- **教训**：种子数据必须存在 `seeds/` 目录，Mock 和 DB 共享同一份 import

### B009 — 端口 5173 → 5177 漂移
- **规则**：R011 端口配置化
- **现象**：Vite 端口从 5173 自动漂移到 5177，E2E 配置的 baseURL 还是 5173，所有测试超时
- **根因**：端口硬编码在各处配置文件，`.env` 未定义标准端口
- **教训**：统一从 `.env` 读取 API_PORT/WEB_PORT，禁止硬编码

### B008 — services/roles.ts 全部 404
- **规则**：R012 API 路径唯一真源
- **现象**：前端 services/roles.ts 按 Mock 服务器的路径约定编写，切到真实后端后全部 404
- **根因**：Mock 路由 `/api/roles/list` vs 真实后端 `/api/roles`——两套路由完全不同
- **教训**：api-contract.yaml 是唯一路径真源，前端和 Mock 都必须从 contract 提取路径

---

## v2.17 血案（修复模式门禁盲区 — 复盘 2026-07-16）

### B019 — Checkbox 被 Field `*:w-full` 拉伸异常
- **规则**：R021 共享组件 CSS 副作用检查
- **现象**：新增账号弹窗中，职位下方的"管理员"复选框布局异常——原本 `size-4` 的 Checkbox 被拉伸为全宽，与标签错位
- **诊断链路**：`<Field className="flex items-center gap-2"> → vertical 变体注入 *:w-full → Checkbox 被 width:100% 覆盖 → 视觉异常`
- **根因**：Field 组件的 `*:w-full` CSS 变体对所有直接子元素生效，但仅针对 input/select/textarea 设计，未考虑 Checkbox/Radio 等非全宽控件
- **教训**：修改共享 UI 组件时，必须验证其 CSS 变体对所有子控件（含 Checkbox/Radio/Switch）的副作用。不能只看自己改的那一行

### B020 — 修复模式绕过全部门禁体系
- **规则**：R020 修复模式最小审查门禁
- **现象**：4 个 Bug 修复会话中，修复者（单一 Agent）既写代码又自查——Checkbox 布局异常漏修，直到用户二次点名才发现
- **根因**：修复模式不走 Stage 流程 → 无 coordinator 调度 → 无 code review → 无冒烟验证。门禁全部失效
- **教训**：修复粒度再小也必须过审查。单行修改也需要第二双眼睛确认

### B007 — "已审核商机仍在待审核列表"
- **规则**：R007 状态双向断言
- **现象**：审核通过后，商机从"待审核"消失 → E2E 断言通过。但实际仍在待审核列表显示
- **根因**：只断言了 target 出现，没断言 source 消失
- **教训**：每次状态转换必须双向断言

### B006 — partner-flow 只用一个账号测试
- **规则**：R006 权限交叉矩阵必测
- **现象**：所有 partner 流程测试都用同一个 partner 账号，数据隔离 bug 完全未暴露
- **教训**：必须生成角色×端点矩阵，每个格 = 1 条用例

### B005 — 搜索框无反应、编辑表单未预填
- **规则**：R005 E2E 浏览器交互配额
- **现象**：E2E 用例 80% 是 API 直调，浏览器交互极少，表单下拉空白、搜索无效等 UI bug 全部漏网
- **教训**：E2E spec 文件中 page.fill/click/goto 占比必须 ≥ 30%

---

## v2.8 血案

### B004 — axios 双重包裹 res.data.data.list
- **规则**：R001 响应格式标准化
- **现象**：后端返回 `{ data: [...] }`，前端期望 `{ data: { list, total } }`，axios 再加一层 `.data`，读取路径变成 `res.data.data.list`
- **教训**：必须统一 `{ data: { list, total } }` 格式

### B003 — 前端写 type:'company'，后端只接受 z.enum(['enterprise','individual'])
- **规则**：R002 枚举值唯一真源
- **现象**：纯 API 测试不可见（测试直接拼正确值），真实浏览器操作才触发 400
- **教训**：枚举值从 contract/schema 提取，严禁前端自行发明

### B002 — Vite proxy 遗漏 partner 路由
- **规则**：R003 E2E 必须穿透代理层
- **现象**：E2E 直连后端端口全绿，浏览器访问 404——proxy 配置遗漏了 partner 前缀
- **教训**：E2E 必须通过 Vite proxy 访问后端

---

## 如何新增血案

1. 在对应版本段落下新增 `### B0XX — 简短标题`
2. 填写：规则引用 → 现象 → 根因 → 教训
3. 关联 gate-rules.yaml 中的 rule ID
