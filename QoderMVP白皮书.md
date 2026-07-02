# QoderMVP 白皮书 — 多 Agent 并行开发流程 v2.6

> 本文档描述从需求对齐到交付的完整多 Agent 并行工程流程。
>
> **版本历史**：
> - v2.6.0 (2026-07-02): **Qoder 专属化转型**——项目从 Claude Code/Qoder/Trae 三平台迁移为 Qoder 唯一平台；文档更名为 QoderMVP白皮书；技能路径从 `skills/` 更新为 `.qoder/skills/`；CLAUDE.md 引用替换为 `.qoder/settings.json`；新增 ultra-cost-effective 极致节能引擎（七层架构，项目级全链路 Token 监控含 A2A穿透+子Agent+理论节约统计）；新增 E2E 覆盖率自动化门禁（check-e2e-coverage.js + check-e2e-parity.js）
> - v2.5.0 (2026-05-26): 强化增量变更流水线——新增§0.2增量变更分类决策树，明确「非Bug变更（Issue/新功能/改善实现）必须走完整 PRD→架构→审查→Mock→测试 流水线」的核心原则；重构§0.5 PRD变更分级控制为三级全流水线模式（微小/中等/重大均走完整流水线，仅深度和同步范围不同）；扩展§0.6产物复用规则增加Mock/测试同步列；新增§0.3增量模式阶段裁剪规则独立表格；级联重编号§0.3-0.8→§0.4-0.9
> - v2.4.0 (2026-05-21): 新增第三种运行模式「轻量模式」——简单任务判定标准（≤2 API、≤1表、单角色、无复杂状态机），跳过Stage1重PRD/Stage2重规划/多Agent并行，改为单Agent直通车（需求摘要→直接开发→轻量验收），10-30分钟完成
> - v2.3.0 (2026-05-21): 融合四份优化建议（bykimi/byminimax/bypro/flash）剩余23项——新增↺循环分级矩阵、模块合并四步流程、增量测试窗口、DEFER状态、Pipeline回滚协议、回归测试管理、Mock连接/验证规范、上下文管理、Agent时限契约、模块摘要传输、版本元数据、数据竞争检测、产物完整性校验、依赖追踪、Mock变更同步、Stage0需求精炼、PRD"不做"清单；P3层补充Coordinator扫描伪代码/文件竞态防护/Mock契约验证/门禁检查清单
> - v2.2.0 (2026-05-21): 融合 kimi 融合版与 pro 融合版——补全执行细节（Review流转/打回上限/Migration时机/切换策略/通过率阈值/Agent异常处理）、恢复业务先行风险对照表、强化Stage5输入
> - v2.1.0 (2026-05-21): 融合 kimi v1.1 精华（已知局限、Stage5复盘、经验知识库、PRD变更分级、模块粒度、锁定实现等）
> - v2.0.0 (2026-05-21): 融合三轮优化审查（bypro+pro+minimax），新增迭代模型、回退协议、Agent恢复、质量度量、项目回溯
> - v1.0.0 (初始): 原始白皮书
>
> **文档定位**：本文档是 all-in-mvp 项目的多 Agent 并行开发执行标准。与 `.qoder/settings.json` 中配置的技能体系的关系：技能为通用 MVP 开发方法论框架，本文档是在其理念基础上针对本项目的具体化——定义了精确的 Agent 角色、并行策略、调度机制和产出物契约。本文档为该项目 Agent 协作的最高执行标准，`.qoder/settings.json` 中的项目配置和 `ultra-cost-effective/` 工具链为操作层补充。
>
> **【已验证规则】** 经过 ≥3 次迭代验证，变更需走评审
> **【待验证假设】** 基于理论推导，建议在下一次迭代中观察验证

---

> **已知局限**：
> - 本流程假设 PRD 可由单 Agent 在 1-2 小时内完成，超复杂需求可能需要拆分 PRD
> - 本流程假设模块间依赖可形成 DAG，循环依赖需人工预处理
> - Agent 并行上限（3 后端 + 3 前端）基于上下文成本估算，资源充足时可调整
> - 本流程未覆盖：生产环境部署、多区域部署、企业级安全合规
>
> **适用边界**：
> - 团队规模：1-3 人的人类监督 + 多 Agent 执行
> - 项目规模：MVP 阶段（<10 个模块，<50 个 API 端点）
> - 技术栈：Hono + Drizzle + SQLite + Vue 3（其他技术栈需调整 Stage3 规范）

---

## 零、迭代模型与生命周期

### 0.1 三种运行模式

| 模式 | 适用场景 | Stage1-4执行方式 | 典型耗时 |
|------|---------|-----------------|---------|
| **轻量模式** | 简单任务（见§0.9判定标准） | 跳过Stage1重PRD和Stage2重规划，单Agent直通 | 10-30min |
| **全量模式** | 全新项目、第一次交付 | 完整执行Stage1-4，全部模块一次到位 | 4-12h |
| **增量模式** | 迭代项目、追加功能 | 每次迭代只跑涉及的Stage，已锁定模块跳过 | 1-4h |

### 0.2 增量变更分类决策树

> **核心原则：只要不是纯Bug修复，任何对需求、功能、实现方案的变更都必须走完整的增量流水线（PRD→架构→审查→Mock→测试→开发→集成）。**

每次增量变更首先判定类型：

```
变更类型判定
  │
  ├── 纯Bug修复？（代码逻辑错误、不改需求文档，不增删功能）
  │     ├── 是 → 跳过Stage1-3，直接修复代码 → Stage4验证
  │     └── 否 ↓
  │
  └── 非Bug变更（必须走完整增量流水线）：
        ├── Issue/功能缺陷：需求已定义但实现未覆盖/实现偏离需求
        ├── 新功能点：PRD未定义的全新需求、版本迭代增量
        ├── 改善实现：需求不变但改进技术方案/重构/性能优化
        └── 需求调整：文案变更、字段重命名、业务规则微调
              ↓
        必须执行：PRD修订 → Stage2架构重审 → ↺审查 → Mock同步 → 测试更新 → Stage3开发 → Stage4集成
```

> **判定红线**：如果变更需要修改 PRD 文档中的**任何一个字**（除错别字修正外），即归为非Bug变更，触发完整流水线。如果不确定，默认走非Bug变更流程。

### 0.3 增量模式的阶段裁剪规则

| 迭代场景 | Stage1 | Stage2 | Stage3 | Stage4 |
|---------|--------|--------|--------|--------|
| 新增独立模块 | 更新PRD | 仅新模块走①→②→↺→③ | 仅新模块 | 集成新模块 |
| 非Bug变更（需求迭代/新功能/改善实现/Issue修复） | 更新PRD | 重走①→②→↺→③（受影响模块+接口+Mock+测试） | 重新开发变更模块 | 重新集成 |
| 纯Bug修复（逻辑修正，不改需求） | 跳过 | 跳过 | 跳过 | 仅Stage4 |

### 0.4 回退协议

当Stage3执行中发现Stage2产物缺陷时：

```
发现缺陷
  ↓
判定缺陷类型：
  ├── 接口契约缺陷 → 回退到Stage2①，修正api-contract.yaml
  ├── Schema缺陷 → 回退到Stage2①，修正schema.sql
  ├── 模块边界缺陷 → 回退到Stage2②，修正<module>.md
  └── PRD理解偏差 → 回退到Stage1，修正PRD
  ↓
受影响模块回滚到「未分配」状态 → Coordinator重新调度
```

### 0.5 PRD变更分级控制

> **前提**：本节仅适用于非Bug变更（纯Bug修复见§0.2决策树，直接跳过Stage1-3）。所有非Bug变更无论级别大小，都必须走 PRD修订 → Stage2重审 → ↺审查 → Mock/测试同步 的完整流水线，区别仅在审查深度和同步范围。

```
非Bug变更请求 → 评估影响范围 → 判断变更级别：
  ├── 微小变更（文案修正、字段重命名）：
  │     更新 PRD → Stage2 ①快速终审（单轮↺，仅校验一致性）→ Mock数据同步 → 测试用例增量更新 → Stage3 增量开发
  ├── 中等变更（新增字段、调整业务规则、改善实现）：
  │     更新 PRD → Stage2 ①②完整输出 + ↺ 标准循环 → Mock全量同步 → 测试用例更新 → Stage3 增量开发
  └── 重大变更（新增模块、调整架构、重构数据模型）：
        更新 PRD → Stage2 完整重执行 → ↺ 完整循环 → Mock重建 → 测试重建 → Stage3 重开发
```

> 微小变更与纯Bug修复的区分：修改了 PRD 文档中任何一个字（非错别字修正）→ 微小变更，触发流水线。不改 PRD 只改代码逻辑 → 纯Bug修复，跳过流水线。

### 0.6 产物复用规则

| 变更类型 | Schema 是否变更 | 复用策略 | Mock/测试同步 |
|---------|----------------|---------|-------------|
| 纯Bug修复 | 否 | 不改产物，仅修复代码 | 补充回归测试（`regression/`） |
| 微小变更（文案/字段名） | 否（字段类型不变） | 复用锁定版 spec + schema，更新 PRD + 受影响 `<module>.md` | Mock数据字段同步 + 测试断言更新 |
| 新增字段 | 是 | 更新 schema → 重跑 ↺ 循环 → 更新相关 `<module>.md` | Mock数据+DTO同步 + 测试fixture更新 |
| 业务规则调整 | 否 | 复用锁定版 spec + schema，更新 PRD + 受影响 `<module>.md` | Mock响应数据同步 + 测试场景更新 |
| 新增模块 | 是 | 按完整 Stage2 流程执行，已有模块产物复用 | 新模块Mock+测试新建，已有模块增量同步 |
| 接口契约调整 | 否 | 更新 `api-contract.yaml` → Mock/前端同步 | Mock全量重验证 + 测试路由断言更新 |

### 0.7 版本标记机制

- 产物文件名纳入迭代版本号：`spec-v2.md`、`PRD-v1.3.md`
- 锁定版标记：`spec.locked.md` + 文件头 `<!-- STATUS: LOCKED -->`
- 变更历史记录在产物文件头中

**产出物内部版本元数据**（轻量，不引入额外工具）：

文件头部增加注释块：
```yaml
# @version: 1.2
# @last_modified: 2026-05-21T14:30:00Z
# @modified_by: architect-agent
# @change: 拆分trace_code字段
# @grill_round: 2
```
> ↺循环中每次修正后自动更新版本号和变更说明。旧版本通过Git历史自然保留。锁定版在Git中打tag：`stage2-locked/v1.0`。

### 0.8 并行度上限依据

| 维度 | 上限值 | 推导依据 |
|------|--------|---------|
| 后端Agent | 3 | 典型MVP模块6-12个，3 Agent分2-4轮完成；>3时Coordinator上下文压力指数增长 |
| 前端Agent | 3 | 共享路由/Pinia Store冲突风险随Agent数平方增长；3 Agent可覆盖表单/展示/流程三类 |
| 测试Agent(③b-1) | 2 | 模块间完全独立但共享api-contract；>2时测试fixture命名冲突概率>30% |

### 0.9 简单任务判定标准与轻量模式流水线

> **核心原则**：不是所有任务都需要全套流水线。简单任务走轻量通道，复杂任务走完整通道。判定在需求进入时由 Coordinator / all-in-mvp Skill 自动执行。

#### 0.9.1 简单任务判定标准（满足 ≥3 项即为简单任务）

| 维度 | 简单任务特征 | 复杂任务特征 |
|------|------------|------------|
| **API/接口数量** | ≤2 个端点 或 纯静态页面 | ≥3 个端点 |
| **数据持久化** | 无数据库 或 单表 CRUD | 多表关联、事务 |
| **用户角色** | 单角色（无需登录 或 单一用户类型） | 多角色、权限分级 |
| **业务状态机** | 无状态流转 或 单状态 | 多状态、多分支 |
| **前端页面** | 单页面 或 2 个简单页面 | 多页面、路由嵌套 |
| **外部依赖** | 无外部服务调用 | 支付/短信/存储/第三方API |
| **模块数** | 1 个模块（全栈） | ≥2 个模块有依赖关系 |

> **判定规则**：7 项中满足 ≥3 项 → 自动归为简单任务，走轻量模式。若不满足 → 走全量/增量模式。人类可手动覆盖自动判定。
>
> **典型简单任务示例**：个人博客、落地页、留言板、JSON API 代理、单表 CRUD 管理页、Markdown 预览器、单页面工具箱。

#### 0.9.2 轻量模式流水线（3 步替代 4 Stage）

```
轻量Step1: 需求摘要（替代 Stage1 PRD + Stage2 架构/业务）
    └── 单 Agent 输出：需求卡片 + 技术摘要（1个文件，不拆分多文件）
    ↓
轻量Step2: 直接开发（替代 Stage3 多Agent并行）
    └── 单 Agent 全栈开发（后端+前端一起写，无Coordinator调度）
    ↓
轻量Step3: 轻量验收（替代 Stage4 完整集成）
    └── 运行 + 冒烟测试（用户确认可用即通过）
```

#### 0.9.3 轻量模式 vs 全量模式 对比

| 维度 | 轻量模式 | 全量模式 |
|------|---------|---------|
| **Agent 数量** | 1 个（全栈） | 6-10 个（多角色） |
| **PRD** | 需求卡片（≤200字） | 完整PRD（9个章节） |
| **架构设计** | 技术摘要（嵌入需求卡片） | spec.md + schema.sql + api-contract.yaml |
| **模块定义** | 无（单模块，不拆分） | task.md + N个 <module>.md |
| **拷问审查** | 跳过 | ↺ 循环（1-3轮） |
| **Mock 服务** | 跳过（直接开发） | mocks/ 完整Mock |
| **测试策略** | L1 单元测试（按需）+ 冒烟测试 | L1-L5 五层测试 |
| **Pipeline Coordinator** | 无（单Agent自管理） | 完整依赖图调度 |
| **并行度** | 1 | 3后端 + 3前端 |
| **门禁** | 用户确认即通过 | 6项质量门禁 |
| **典型耗时** | 10-30min | 4-12h |

#### 0.9.4 轻量模式产出物

| 步骤 | 产出物 | 格式 |
|------|--------|------|
| 轻量Step1 | 需求卡片 + 技术摘要 | 单个 `.md` 文件（嵌入YAML front matter） |
| 轻量Step2 | 全栈代码 | `src/` 单目录（不拆模块子目录） |
| 轻量Step3 | 冒烟测试结果 | 终端输出 + 用户确认 |

**需求卡片模板**（轻量模式专用，替代完整PRD）：
```yaml
# @task: <一句话任务描述>
# @type: simple  # simple | full | incremental
# @tech: <技术栈，如 html+css+js | hono+sqlite | vue+vite>
# @apis: <API端点列表，无则写 none>
# @db: <数据表，无则写 none>
# @pages: <页面列表>
# @acceptance: <1-2条验收标准>
```

#### 0.9.5 轻量模式升级为全量模式

轻量模式执行中如发现以下情况，应自动升级为全量模式：
- 开发中发现需要 ≥3 个 API 端点
- 开发中发现需要多表关联或事务
- 用户追加需求导致模块数 ≥2
- 用户要求多角色权限

> 升级时保留已产出代码，补充执行全量模式的 Stage1（PRD）→ Stage2（架构+模块定义）→ 将已有代码纳入模块体系。

### 0.10 MSVP验证协议（v2.6 新增）

> **测试通过 ≠ 应用能跑。** 必须由独立验证Agent，从零冷启动，用真实浏览器点击核心流程，截图证据。

#### 0.10.1 A类阻塞Bug清单（零容忍）

| 编号 | 判定标准 | 检测方式 | 典型表现 |
|------|---------|---------|----------|
| A1 | 应用无法启动 | `npm run dev` 报错退出 | 端口冲突、依赖缺失、编译错误 |
| A2 | 首页/登录页白屏 | 导航到首页，截图全白或无内容 | JS 报错阻断渲染、路由配置错误 |
| A3 | 核心菜单 404 | 逐一点击所有菜单项 | 路由未注册、路径拼写错误 |
| A4 | 登录流程不可用 | 输入凭证→点击登录→失败 | API 未启动、CORS 错误、Token 存储失败 |
| A5 | 核心 CRUD 不可用 | 创建→查看列表→编辑→删除 任一步失败 | API 返回 500、数据库写入失败 |
| A6 | Console 红色 Error | DevTools Console 中出现 `error` 级别日志 | 未捕获的异常、网络请求失败 |
| A7 | 页面布局错乱 | 按钮重叠、文字溢出、组件未对齐 | CSS 未加载、样式冲突 |
| A8 | 环境变量/配置缺失 | 应用启动但功能异常 | `.env` 文件缺失或值错误 |

> **门禁**：A1-A8 必须全部为零。任何 A 类 Bug → 不通过 → 修复 → 重新 MSVP → 清零才放行。

#### 0.10.2 MSVP验证流程

```
Step 1: 冷启动
  ├── 全新 clone 或 git clean -fd
  ├── npm install / pnpm install（从零安装依赖）
  ├── npm run db:push（初始化数据库）
  ├── npm run db:seed（种子数据）
  └── npm run dev（启动开发服务器）

Step 2: 打开浏览器
  ├── 使用 Playwright（有头模式）
  ├── 打开 Chrome DevTools Console（捕获所有 error/warning）
  └── 设置视口为 1920x1080（标准桌面分辨率）

Step 3: 执行冒烟路径
  ├── 导航到首页 → 截图
  ├── 遍历所有菜单项（逐一检查是否可访问、是否 404）
  ├── 执行核心用户旅程
  └── 每个关键步骤 → 截图

Step 4: A 类阻塞 Bug 检查
  ├── Console 是否有 error → P0
  ├── 是否有 404 请求 → P0
  ├── 菜单项是否完整可点击 → P0
  ├── 核心流程是否走通 → P0
  └── 页面布局是否明显异常 → P0

Step 5: 输出验证报告
```

#### 0.10.3 MSVP报告模板

```markdown
# MSVP 验证报告

- **验证时间**：<ISO 8601>
- **应用版本**：<git commit hash>
- **环境**：Node vXX, npm vXX, Chrome vXX

## 冷启动结果
- npm install: ✅ 成功 / ❌ 失败
- npm run db:push: ✅ 成功 / ❌ 失败
- npm run db:seed: ✅ 成功 / ❌ 失败
- npm run dev: ✅ 成功（端口 XXXX）/ ❌ 失败

## 菜单完整性检查
| 序号 | 菜单项 | 目标路由 | 点击结果 | 截图 |
|------|--------|---------|---------|------|
| 1 | 首页 | / | ✅ 正常 | [screenshot] |
| 2 | 产品管理 | /products | ✅ 正常 | [screenshot] |
| 3 | 用户管理 | /users | ❌ 404 | [screenshot] |

## 核心用户旅程
| 步骤 | 操作 | 预期结果 | 实际结果 | 截图 |
|------|------|---------|---------|------|
| 1 | 打开登录页 | 显示登录表单 | ✅ | [screenshot] |
| 2 | 输入凭证点击登录 | 跳转到首页 | ✅ | [screenshot] |
| 3 | 点击“产品管理”菜单 | 显示产品列表 | ❌ 页面白屏 | [screenshot] |

## Console 日志
| 级别 | 消息 | 来源 |
|------|------|------|
| 🔴 ERROR | Uncaught TypeError: Cannot read properties of undefined | products.js:42 |
| 🟡 WARNING | [Vue warn]: Failed to resolve component | App.vue |

## A 类 Bug 清单
| 编号 | 类型 | 描述 | 严重程度 |
|------|------|------|----------|
| 1 | A3 | /users 菜单返回 404 | 阻塞 |
| 2 | A2 | /products 页面白屏 | 阻塞 |

## 判定
- A 类 Bug 数量：<N>
- 判定结果：✅ 通过 / ❌ 不通过
- 阻塞项：<如有，列出>
- 修复后需重新执行 MSVP
```

#### 0.10.4 MSVP验证Agent约束

- **不能是开发Agent**：写代码的Agent不能验证自己的代码
- **只能读产物，不能读代码**：只看PRD、spec、验收标准——不看实现代码
- **只报告事实，不分析根因**：报告“点击X → 页面白屏 → Console显示TypeError”，不分析哪个文件哪一行
- **截图不可省略**：每个检查步骤必须有截图证据

---

## 一、Stage1：需求对齐阶段（串行，1 个 Agent）

**角色**：产品经理 Agent  
**输入**：原始需求、业务背景、用户访谈  
**输出**：MECE 完整的 PRD 文档

**Stage1前置：需求精炼**（轻量，10-15分钟）：

PM Agent收到原始需求后，在PRD创作前完成：
1. **用户角色快速定义**：列出2-4个核心用户角色，每角色一句话描述+核心痛点
2. **价值流一句话**：核心业务流程从触发到交付的一句话链路
3. **需求精炼**：识别模糊陈述→标记需澄清项；识别矛盾→标记需决策项

> 产出：以上内容嵌入PRD「项目背景」章节，不产生独立文件。

**PRD 必须包含**：

| 章节 | 内容 | 说明 |
|------|------|------|
| 项目背景 | 业务目标、价值主张、范围边界 | 回答"为什么做" |
| 术语定义 | 领域术语、缩写、业务概念 | 统一语言，避免歧义 |
| 风险与约束 | 技术约束、业务约束、合规要求 | 影响架构决策 |
| 业务主流程 | 核心用户旅程、系统交互图 | 回答"用户怎么用" |
| ER 关系 | 实体关系图、核心领域模型 | 影响数据库设计 |
| 功能需求 | 功能描述、验收标准、业务规则、交互模式、多状态规则 | 开发直接依据 |
| 复杂/核心专题 | 复杂业务逻辑的深度分析 | 如赋码规则、溯源链路 |
| 核心实体状态图 | 状态机、状态转换条件 | 影响代码实现 |
| 验收标准 | 集成测试场景（happy path + exception path） | 测试直接依据 |
| 明确的"不做"清单 | 本版MVP明确不实现的功能、场景、边界 | 防止Stage2/3范围蔓延，限定Scope |

### PRD 质量门禁（MUST PASS before Stage2）

| 门禁项 | 检查方式 | 通过条件 |
|--------|---------|---------|
| 章节完整性 | Agent检查 | 9个强制章节全部存在且非空 |
| 功能需求可测试性 | Agent解析 | 每条功能需求可转化为至少1条集成测试 |
| ER关系一致性 | Agent交叉校验 | 实体引用的表名/字段在所有章节中一致 |
| 术语自洽 | Agent检查 | PRD内部同一概念只用同一术语 |
| 验收标准覆盖 | Agent检查 | 每条业务主流程有≥1条Happy Path + ≥1条Exception Path |
| 范围边界清晰 | 人工确认 | 「不做」清单明确 |

**产出物锁定标准**：PRD 通过评审后锁定，Stage2 及以后所有 Agent 以此为准。PRD 变更需走变更评审（详见 §0.5）。

---

## 二、Stage2：计划阶段（① → ② → ↺ 拷问循环 → ③a ∥ ③b-1 ∥ ③b-2 → ③c）

> **产出物状态约定**：【初版】= 产出完成，未经 ↺ 循环校验；【锁定版】= ↺ 循环通过，后续 Agent 以此为唯一基准。
> **锁定版实现**：文件名后缀标记（`spec.locked.md`）+ 文件头声明（`<!-- STATUS: LOCKED -->`）。锁定后任何修改需先解除锁定（人类授权 → 重命名为 `.draft.md` → 修改 → 重新走 ↺ 循环 → 恢复 `.locked.md`）。
> **模板占位符约定**：文档中 `<module>.md` 中的 `<module>` 为占位符，实际运行时替换为具体模块名（如 `user.md`、`product.md`）。

### 2.1 ① 架构专家输出 Spec（串行，1 个 Agent）

**输入**：PRD  
**输出**：`spec.md` + `schema.sql`（或 Drizzle Schema）+ `api-contract.yaml`

**职责**：
- MVP固定技术栈（Hono + Drizzle + SQLite / Turso）/非MVP的小而美工具类产品可以具体指定。
- 设计数据库 Schema（全局唯一，所有模块共享）
- 在schema.sql中标注原子表组（`-- @atomic_group: <name>`），划分可独立锁定的表组
- 定义接口契约：路由规范、请求/响应 DTO、错误码统一
- 忽略非功能需求（性能、安全等后续迭代）
- 产出物标记为【初版】— 经 ↺ 循环修正后升级为【锁定版】，开发期间不允许变更

**关键原则**：
> Schema 和接口契约是前后端唯一的同步点。一旦锁定，各 Agent 独立开发，互不干扰。

**产出物标准头**：
```markdown
<!-- spec.md 标准头 -->
# Spec: <项目名>
- 版本: v1.0.locked
- 基于 PRD: PRD.md (v1.0.locked)
- 生成时间: 2026-05-21
- 负责 Agent: 架构专家-①
- 变更历史:
  - v1.0.draft: 初版产出
  - v1.0.locked: ↺ 循环通过后锁定
```

**非功能需求演进时间线**（后续迭代补充）：
```
MVP v1   （全量交付）：零非功能需求 → 功能优先
MVP v1.1 （首个增量）：补充认证安全（密码强度、JWT过期、令牌刷新）
MVP v1.2           ：补充性能基线（p99<500ms、SQL查询无N+1）
MVP v2.0           ：补充安全加固（XSS/CSRF/限流/防重放）
```

---

### 2.2 ② 业务领域专家任务划分（串行，1 个 Agent）

**前置条件**：`spec.md` + `schema.sql` + `api-contract.yaml` 已产出【初版】  
**输入**：PRD + `spec.md` + `schema.sql` + `api-contract.yaml`  
**输出**：`task.md` + 各模块 `<module>.md`（产出后同样为【初版】，经 ↺ 循环校验后升级为【锁定版】）
> **Agent 定位提示**（供创建业务领域专家 Agent 时的 system prompt 参考）：你是一个业务领域专家，负责基于 PRD 和架构产出物进行模块拆分、边界定义和验收标准制定。

**划分策略**：

| 类型 | 划分方式 | 说明 |
|------|---------|------|
| **可并行** | 按业务模块横向拆分 | 每个模块 = 路由 + Service + Schema + 测试 |
| **依赖串行** | 核心实体先行 | 如用户/组织模块先完成，订单模块依赖用户 |

**模块示例**：
- `user.md` — 角色管理、组织管理、用户管理
- `product.md` — 类目管理、产品管理
- `template.md` — 扫码展示模版
- `trace.md` — 溯源码订单管理、溯源码段、赋码管理

**每个 `<module>.md` 必须包含**：
1. 模块职责边界（做什么、不做什么）
2. 依赖的其他模块清单（Stage3 依赖图调度依据）
3. 所属领域（认证与权限 / 业务核心 / 工具与配置，Stage3 专家匹配依据）
4. 接口清单（路由、方法、DTO）
5. 数据库表（字段、类型、约束）
6. 验收标准（单功能 happy path + exception path）

**模块粒度标准**【待验证假设】：
- 接口数量：5-15 个 API 端点
- 数据库表：1-3 张核心表（不含关联表）
- 代码行数：预估 200-800 行（含测试）
- 开发耗时：2-4 小时（单 Backend Agent）
- 超过上限 → 拆分为子模块；低于下限 → 合并到相邻模块

> **串行定位说明**：业务领域专家在 Mock 和 TDD 之前完成，但产出后并非直接放行。业务专家同时持有 PRD 和架构产出物，天然具备交叉校验能力——可以发现 spec 是否遗漏了 PRD 中的功能需求。产出物需经过 ↺ 拷问审查循环与架构专家双向校验，全部通过后方可进入 Mock/TDD 阶段。

---

### 2.3 ↺ 拷问审查循环（① ↔ ② 交叉校验，grill-with-docs 驱动）

**定位**：在 ① 架构专家和 ② 业务专家之间运行的双向校验循环。两者均持有 PRD，通过 `grill-with-docs` 技能互相审查对方的产出物，直到所有不一致消除。

**执行方式**：加载 `grill-with-docs` Skill 创建独立的第三方审查Agent。Skill提供四维审查方法论和标准化报告格式（方法论层），审查Agent执行四维检查、读取产出物、生成报告（执行层）。审查Agent仅持有PRD作为唯一基准，独立于①和②。

**输入**：
- ① 的产出：`spec.md` + `schema.sql` + `api-contract.yaml`
- ② 的产出：`task.md` + 各 `<module>.md`
- 共同基准：PRD

**审查维度**：

| 审查项 | 检查方式 | 谁审谁 |
|--------|---------|--------|
| 需求覆盖完整性 | PRD 中的功能需求是否在 spec.md 中都有对应的接口/表？ | grill 审 ① |
| 模块边界合理性 | `<module>.md` 的接口/表分配是否与 schema.sql + api-contract.yaml 一致？ | grill 审 ② |
| 术语一致性 | PRD、spec、module docs 中同一概念是否使用同一术语？ | grill 审双方 |
| 验收标准对齐 | `<module>.md` 的验收标准是否完整覆盖 PRD 的验收标准？ | grill 审 ② |

**循环机制**：

```
┌─ 循环开始 ──────────────────────────────────────┐
│                                                  │
│  1. grill-with-docs 分别审查 ① 和 ② 的产出物      │
│     → 对照 PRD，逐项检查上述四个审查维度             │
│                                                  │
│  2. 发现不一致 → 写入审查报告文件                    │
│     → ① 和 ② 各自读取审查报告，定位需修正的条目      │
│                                                  │
│  3. ① 或 ② 修正自己的产出物                        │
│     → 修正后重新提交审查                           │
│                                                  │
│  4. 重复 1-3 直到所有审查项通过                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

**实例：两轮审查走完一个真实的不一致**

> PRD 原始需求：「溯源订单创建后，系统自动为每个商品生成唯一溯源码，格式为 `公司码 + 日期 + 流水号`」

| 轮次 | 谁审谁 | 发现 | 修正 |
|------|--------|------|------|
| **第 1 轮** | grill 审 ①（spec） | `schema.sql` 中 `trace_code` 字段定义为 `TEXT`，但 PRD 要求「流水号」为纯数字递增——`TEXT` 类型无法保证数值递增语义 | — |
| | grill 审 ②（trace.md） | `trace.md` 验收标准只覆盖「生成溯源码」的 happy path，未覆盖「同一订单重复点击生成」时的幂等性 | — |
| **第 1 轮修正** | ① 改 spec | `trace_code` 拆为 `company_code VARCHAR + date_part VARCHAR + serial_number INT` | — |
| | ② 补 trace.md | 验收标准增加：「同一订单二次调用生成溯源码时，返回已有码而非新建」 | — |
| **第 2 轮** | grill 重新审查 | 两项均已修正，产品表和溯源表命名从 `product`/`trace_records` 统一为 `product`/`product_trace`，术语一致 ✅ | 循环通过，产出物升级为【锁定版】 |

> 这个例子展示了拷问审查的核⼼价值：① 关注技术正确性（字段类型），② 关注业务完备性（幂等性），grill 对照 PRD 做双重校验——如果跳过循环直接进入开发，`TEXT` 类型的流水号会导致后续订单模块无法做数值范围查询。

**审查报告标准格式**：
```markdown
# 审查报告: <轮次>
- 审查时间: <timestamp>
- 审查对象: ① spec.md / ② trace.md
- 审查结果: [通过] / [不通过]

## 发现的问题
| 序号 | 严重程度 | 审查维度 | 问题描述 | 引用 PRD 条款 | 修正建议 |
|------|---------|---------|---------|-------------|---------|
| 1 | 阻塞 | 需求覆盖 | trace_code 字段类型不符 | PRD §4.2 | 拆分为三个字段 |

## 修正验证
- [ ] 问题 1 已修正
- [ ] 术语一致性已复核
```

**↺循环问题分级处理矩阵**（按严重度分流，避免低价值问题浪费循环轮次）：

| 级别 | 问题类型示例 | 处理方式 | 轮次上限 |
|------|-------------|---------|---------|
| 自愈级 | 字段命名风格、注释语言、缩进格式 | ①或②自行修正，不进grill循环 | 0 |
| 调试级 | 字段类型选择、模块边界微调 | ①/②修正后grill单轮验证 | 2轮 |
| 协商级 | 验收标准覆盖范围、API响应字段增减 | ①与②协商后grill验证 | 3轮 |
| 上浮级 | 实体关系冲突（1:N vs N:M）、核心流程分歧 | 立即输出未决清单，上浮人类 | 首轮即上浮 |
| 终止级 | PRD本身存在根本矛盾、技术方案不可行 | 立即终止循环，上浮人类重评 | 首轮即终止 |

> grill根据问题类型自动分级，自愈级不占循环轮次，上浮级/终止级首轮直接上浮，仅调试级/协商级走标准循环。

**无法达成一致时的强制降级策略**：
1. 循环硬上限为 **3 轮**。第3轮结束时如仍不一致：
2. → grill输出「未决问题清单」，按**最简实现原则**给出推荐方案
3. → 汇总后提交给人类决策，等待确认
4. → 若人类 **24小时内无回复**：自动采纳grill推荐方案，记录为「自动裁决」
5. → 人类确认或自动裁决后，①和②据此修正产出物，循环终止

**超时保护**：
> 每轮审查预期耗时 10-15 分钟。若 30 分钟内未完成一轮，或 3 轮后仍有未决问题 → 自动触发降级：grill-with-docs 按「最简实现原则」输出推荐方案 → 人类 15 分钟内确认 → 超时未确认则自动采用推荐方案。

> **门禁**：所有审查项通过后，① 和 ② 的产出物升级为【锁定版】。③a Mock、③b-1 单模块测试、③b-2 业务条线测试方可启动。

**阶段门禁产出物完整性校验**：

| 阶段门禁 | 校验项 | 方式 |
|---------|--------|------|
| Stage1→Stage2 | PRD文件>1KB；9个章节标题全存在 | 文件系统+正则 |
| Stage2→Stage3 | 所有产出物存在且MD5与↺锁定时刻一致；YAML/JSON语义可解析 | 文件hash+格式验证 |
| Stage3→Stage4 | 所有模块目录存在DONE标记；schema.sql语法正确 | 标记文件检查+SQLite dry-run |
| Stage4→交付 | 集成测试报告非空；0个P0/P1 Bug | 文件内容解析 |

> 校验失败 → 门禁拒绝 → 输出具体缺失/损坏项清单。

### 2.9 契约锁定验证机制（v2.6 新增）

> **目标**：确保Stage2产出物锁定后的完整性、一致性，以及Stage3/4开发过程中契约的符合性。

#### 1. Stage2产出物锁定验证

**锁定时刻基线快照**：

```javascript
// 产出物锁定时自动创建基线快照
const LOCKED_ARTIFACTS_BASELINE = {
  // 快照元数据
  metadata: {
    lockedAt: 'ISO8601',
    lockedBy: 'grill-with-docs',
    grillRound: 2, // ↺循环轮次
    prdVersion: 'v1.0',
    lockId: 'uuid' // 唯一锁定标识
  },
  
  // 产出物清单及哈希
  artifacts: {
    'PRD.md': {
      hash: 'sha256',
      size: 1234,
      lastModified: 'ISO8601',
      sections: ['项目背景', '术语定义', '风险与约束', '业务主流程', 'ER关系', '功能需求', '复杂/核心专题', '核心实体状态图', '验收标准']
    },
    'spec.md': {
      hash: 'sha256',
      size: 5678,
      lastModified: 'ISO8601',
      version: 'v1.0.locked'
    },
    'schema.sql': {
      hash: 'sha256',
      size: 890,
      lastModified: 'ISO8601',
      tables: ['users', 'products', 'orders'],
      syntaxValid: true
    },
    'api-contract.yaml': {
      hash: 'sha256',
      size: 2345,
      lastModified: 'ISO8601',
      endpoints: 15,
      syntaxValid: true
    },
    'task.md': {
      hash: 'sha256',
      size: 678,
      lastModified: 'ISO8601',
      modules: ['user', 'product', 'order']
    },
    'modules/*.md': {
      hash: 'sha256',
      count: 3,
      lastModified: 'ISO8601'
    }
  },
  
  // 校验和
  checksum: 'sha256_of_all_artifacts'
};
```

**锁定验证函数**：

```javascript
// 验证产出物完整性
async function validateLockedArtifacts(lockId) {
  const baseline = await loadBaseline(lockId);
  const validationResults = [];
  
  // 1. 文件存在性检查
  for (const [artifact, config] of Object.entries(baseline.artifacts)) {
    const exists = await fileExists(artifact);
    if (!exists) {
      validationResults.push({
        artifact,
        status: 'MISSING',
        message: `锁定产出物 ${artifact} 不存在`
      });
      continue;
    }
    
    // 2. 文件哈希校验
    const currentHash = await calculateFileHash(artifact);
    if (currentHash !== config.hash) {
      validationResults.push({
        artifact,
        status: 'MODIFIED',
        message: `锁定产出物 ${artifact} 已被修改`,
        expected: config.hash,
        actual: currentHash
      });
    }
    
    // 3. 文件格式校验
    if (artifact.endsWith('.yaml') || artifact.endsWith('.yml')) {
      const isValidYaml = await validateYamlSyntax(artifact);
      if (!isValidYaml) {
        validationResults.push({
          artifact,
          status: 'INVALID_FORMAT',
          message: `YAML文件 ${artifact} 语法错误`
        });
      }
    }
    
    if (artifact.endsWith('.sql')) {
      const isValidSql = await validateSqlSyntax(artifact);
      if (!isValidSql) {
        validationResults.push({
          artifact,
          status: 'INVALID_FORMAT',
          message: `SQL文件 ${artifact} 语法错误`
        });
      }
    }
    
    // 4. 文件大小检查（防止空文件）
    const stats = await getFileStats(artifact);
    if (stats.size < 100) { // 小于100字节
      validationResults.push({
        artifact,
        status: 'TOO_SMALL',
        message: `产出物 ${artifact} 文件过小 (${stats.size} bytes)，可能不完整`
      });
    }
  }
  
  // 5. 产出物间一致性检查
  const consistencyChecks = await validateArtifactConsistency(baseline);
  validationResults.push(...consistencyChecks);
  
  return {
    lockId,
    validatedAt: new Date().toISOString(),
    passed: validationResults.every(r => r.status === 'OK'),
    results: validationResults
  };
}

// 产出物间一致性检查
async function validateArtifactConsistency(baseline) {
  const results = [];
  
  // 检查1: spec.md中的接口是否在api-contract.yaml中定义
  const specEndpoints = await extractEndpointsFromSpec(baseline.artifacts['spec.md']);
  const contractEndpoints = await extractEndpointsFromContract(baseline.artifacts['api-contract.yaml']);
  
  const missingInContract = specEndpoints.filter(ep => !contractEndpoints.includes(ep));
  if (missingInContract.length > 0) {
    results.push({
      artifact: 'spec.md ↔ api-contract.yaml',
      status: 'INCONSISTENT',
      message: `spec.md中定义的接口在api-contract.yaml中缺失: ${missingInContract.join(', ')}`
    });
  }
  
  // 检查2: schema.sql中的表是否在spec.md中引用
  const schemaTables = await extractTablesFromSchema(baseline.artifacts['schema.sql']);
  const specTables = await extractTablesFromSpec(baseline.artifacts['spec.md']);
  
  const orphanTables = schemaTables.filter(t => !specTables.includes(t));
  if (orphanTables.length > 0) {
    results.push({
      artifact: 'schema.sql ↔ spec.md',
      status: 'INCONSISTENT',
      message: `schema.sql中定义的表在spec.md中未引用: ${orphanTables.join(', ')}`
    });
  }
  
  // 检查3: PRD中的功能需求是否在spec.md中覆盖
  const prdRequirements = await extractRequirementsFromPRD(baseline.artifacts['PRD.md']);
  const specCoverage = await extractCoverageFromSpec(baseline.artifacts['spec.md']);
  
  const uncoveredRequirements = prdRequirements.filter(req => !specCoverage.includes(req));
  if (uncoveredRequirements.length > 0) {
    results.push({
      artifact: 'PRD.md ↔ spec.md',
      status: 'INCOMPLETE_COVERAGE',
      message: `PRD中的功能需求在spec.md中未覆盖: ${uncoveredRequirements.join(', ')}`
    });
  }
  
  // 检查4: task.md中的模块是否与modules/*.md一致
  const taskModules = await extractModulesFromTask(baseline.artifacts['task.md']);
  const moduleFiles = await glob('modules/*.md');
  const moduleNames = moduleFiles.map(f => path.basename(f, '.md'));
  
  const missingModules = taskModules.filter(m => !moduleNames.includes(m));
  if (missingModules.length > 0) {
    results.push({
      artifact: 'task.md ↔ modules/*.md',
      status: 'INCONSISTENT',
      message: `task.md中定义的模块在modules/目录中缺失: ${missingModules.join(', ')}`
    });
  }
  
  if (results.length === 0) {
    results.push({ artifact: 'ALL', status: 'OK', message: '所有产出物一致性检查通过' });
  }
  
  return results;
}
```

#### 2. Stage3开发前契约一致性预检

**预检时机**：Backend Agent开始开发前，由Pipeline Coordinator执行

```javascript
// Stage3开发前契约预检
async function preDevelopmentContractCheck(moduleName) {
  console.log(`[契约预检] 检查模块 ${moduleName} 的契约一致性`);
  
  const checks = [];
  
  // 1. 读取模块定义
  const moduleDoc = await readFile(`modules/${moduleName}.md`);
  const moduleSpec = await parseModuleSpec(moduleDoc);
  
  // 2. 检查模块接口是否在api-contract.yaml中定义
  const contractEndpoints = await loadContractEndpoints();
  const moduleEndpoints = moduleSpec.apis;
  
  const missingEndpoints = moduleEndpoints.filter(ep => 
    !contractEndpoints.some(ce => 
      ce.method === ep.method && ce.path === ep.path
    )
  );
  
  if (missingEndpoints.length > 0) {
    checks.push({
      type: 'MISSING_CONTRACT',
      severity: 'BLOCK',
      message: `模块 ${moduleName} 的接口在api-contract.yaml中未定义`,
      details: missingEndpoints
    });
  }
  
  // 3. 检查模块依赖的表是否在schema.sql中定义
  const schemaTables = await loadSchemaTables();
  const moduleTables = moduleSpec.tables;
  
  const missingTables = moduleTables.filter(t => !schemaTables.includes(t));
  if (missingTables.length > 0) {
    checks.push({
      type: 'MISSING_SCHEMA',
      severity: 'BLOCK',
      message: `模块 ${moduleName} 依赖的表在schema.sql中未定义`,
      details: missingTables
    });
  }
  
  // 4. 检查模块依赖是否满足
  const moduleDependencies = moduleSpec.depends_on;
  const completedModules = await getCompletedModules();
  
  const unmetDependencies = moduleDependencies.filter(dep => 
    !completedModules.includes(dep)
  );
  
  if (unmetDependencies.length > 0) {
    checks.push({
      type: 'UNMET_DEPENDENCY',
      severity: 'BLOCK',
      message: `模块 ${moduleName} 的依赖模块未完成`,
      details: unmetDependencies
    });
  }
  
  // 5. 检查模块边界是否与其他模块冲突
  const otherModules = await getAllModuleSpecs();
  const conflicts = detectModuleConflicts(moduleSpec, otherModules);
  
  if (conflicts.length > 0) {
    checks.push({
      type: 'MODULE_CONFLICT',
      severity: 'WARNING',
      message: `模块 ${moduleName} 与其他模块存在潜在冲突`,
      details: conflicts
    });
  }
  
  // 6. 生成预检报告
  const report = {
    module: moduleName,
    checkedAt: new Date().toISOString(),
    passed: checks.every(c => c.severity !== 'BLOCK'),
    checks,
    recommendation: checks.some(c => c.severity === 'BLOCK') 
      ? 'BLOCKED: 请先解决上述阻塞问题再开始开发'
      : 'CLEAR: 可以开始开发'
  };
  
  // 保存预检报告
  await writeFile(`reports/contract-precheck-${moduleName}.json`, JSON.stringify(report, null, 2));
  
  return report;
}
```

#### 3. Stage4集成前契约符合性验证

**验证时机**：Stage4集成测试开始前，由Stage4 Coordinator执行

```javascript
// Stage4集成前契约符合性验证
async function integrationContractVerification() {
  console.log('[契约验证] 开始Stage4集成前契约符合性验证');
  
  const verificationResults = [];
  
  // 1. 验证所有模块的实现是否符合契约
  const modules = await getAllModules();
  
  for (const module of modules) {
    const moduleResult = await verifyModuleContractCompliance(module);
    verificationResults.push(moduleResult);
  }
  
  // 2. 验证跨模块接口一致性
  const crossModuleResult = await verifyCrossModuleConsistency(modules);
  verificationResults.push(crossModuleResult);
  
  // 3. 验证数据流一致性
  const dataFlowResult = await verifyDataFlowConsistency(modules);
  verificationResults.push(dataFlowResult);
  
  // 4. 生成验证报告
  const report = {
    verifiedAt: new Date().toISOString(),
    totalModules: modules.length,
    passedModules: verificationResults.filter(r => r.passed).length,
    failedModules: verificationResults.filter(r => !r.passed).length,
    results: verificationResults,
    overallPassed: verificationResults.every(r => r.passed)
  };
  
  // 保存验证报告
  await writeFile('reports/contract-verification.json', JSON.stringify(report, null, 2));
  
  return report;
}

// 验证单个模块的契约符合性
async function verifyModuleContractCompliance(moduleName) {
  const checks = [];
  
  // 1. 读取模块实现代码
  const moduleCode = await readModuleCode(moduleName);
  
  // 2. 读取模块契约
  const moduleContract = await loadModuleContract(moduleName);
  
  // 3. 检查API路由是否符合契约
  const implementedRoutes = extractRoutesFromCode(moduleCode);
  const contractRoutes = moduleContract.apis;
  
  const routeMismatches = implementedRoutes.filter(ir => 
    !contractRoutes.some(cr => 
      cr.method === ir.method && 
      cr.path === ir.path &&
      cr.responseSchema === ir.responseSchema
    )
  );
  
  if (routeMismatches.length > 0) {
    checks.push({
      type: 'ROUTE_MISMATCH',
      severity: 'BLOCK',
      message: `模块 ${moduleName} 的API路由实现与契约不一致`,
      details: routeMismatches
    });
  }
  
  // 4. 检查数据模型是否符合schema
  const implementedModels = extractModelsFromCode(moduleCode);
  const contractModels = await loadContractModels(moduleName);
  
  const modelMismatches = implementedModels.filter(im => 
    !contractModels.some(cm => 
      cm.name === im.name &&
      JSON.stringify(cm.fields) === JSON.stringify(im.fields)
    )
  );
  
  if (modelMismatches.length > 0) {
    checks.push({
      type: 'MODEL_MISMATCH',
      severity: 'BLOCK',
      message: `模块 ${moduleName} 的数据模型与schema不一致`,
      details: modelMismatches
    });
  }
  
  // 5. 检查错误处理是否符合契约
  const implementedErrors = extractErrorHandlersFromCode(moduleCode);
  const contractErrors = moduleContract.errorCodes;
  
  const errorMismatches = implementedErrors.filter(ie => 
    !contractErrors.some(ce => 
      ce.code === ie.code &&
      ce.message === ie.message
    )
  );
  
  if (errorMismatches.length > 0) {
    checks.push({
      type: 'ERROR_MISMATCH',
      severity: 'WARNING',
      message: `模块 ${moduleName} 的错误处理与契约不一致`,
      details: errorMismatches
    });
  }
  
  // 6. 生成模块验证结果
  return {
    module: moduleName,
    verifiedAt: new Date().toISOString(),
    passed: checks.every(c => c.severity !== 'BLOCK'),
    checks
  };
}
```

#### 4. 契约验证配置

```javascript
// 契约验证配置
const CONTRACT_VERIFICATION_CONFIG = {
  // 验证时机
  timing: {
    stage2Lock: true,           // Stage2锁定时验证
    stage3PreDev: true,         // Stage3开发前验证
    stage4PreIntegration: true, // Stage4集成前验证
    stage4PostBugFix: true      // Bug修复后验证
  },
  
  // 验证严格度
  strictness: {
    apiRoutes: 'STRICT',        // API路由必须完全匹配
    dataModels: 'STRICT',       // 数据模型必须完全匹配
    errorCodes: 'LENIENT',      // 错误码允许扩展
    responseFormat: 'STRICT',   // 响应格式必须匹配
    validationRules: 'MODERATE' // 验证规则允许合理扩展
  },
  
  // 自动修复策略
  autoFix: {
    enabled: false,             // 默认关闭自动修复
    allowedFixes: [
      'SYNC_MOCK_DATA',         // 同步Mock数据
      'UPDATE_TEST_ASSERTIONS', // 更新测试断言
      'GENERATE_TYPE_DEFINITIONS' // 生成类型定义
    ],
    blockedFixes: [
      'MODIFY_CONTRACT',        // 不允许修改契约
      'CHANGE_SCHEMA',          // 不允许修改Schema
      'ALTER_API_SIGNATURE'     // 不允许修改API签名
    ]
  },
  
  // 告警配置
  alerts: {
    onMismatch: true,           // 不匹配时告警
    onWarning: false,           // 警告不告警
    notificationChannel: 'CONSOLE' // 告警渠道
  },
  
  // 报告配置
  reporting: {
    generateReport: true,
    reportFormat: 'JSON',
    reportPath: 'reports/contract-verification/',
    includeDetails: true,
    includeRecommendations: true
  }
};
```

#### 5. 契约变更影响分析

```javascript
// 契约变更影响分析
async function analyzeContractChangeImpact(changeRequest) {
  console.log('[影响分析] 分析契约变更的影响范围');
  
  const impact = {
    changeId: generateChangeId(),
    requestedAt: new Date().toISOString(),
    changeDescription: changeRequest.description,
    affectedComponents: [],
    riskLevel: 'LOW',
    recommendations: []
  };
  
  // 1. 分析直接影响
  const directImpact = await analyzeDirectImpact(changeRequest);
  impact.affectedComponents.push(...directImpact);
  
  // 2. 分析间接影响
  const indirectImpact = await analyzeIndirectImpact(changeRequest);
  impact.affectedComponents.push(...indirectImpact);
  
  // 3. 计算风险等级
  impact.riskLevel = calculateRiskLevel(impact.affectedComponents);
  
  // 4. 生成建议
  impact.recommendations = generateChangeRecommendations(impact);
  
  // 5. 生成影响分析报告
  await writeFile(
    `reports/change-impact-${impact.changeId}.json`,
    JSON.stringify(impact, null, 2)
  );
  
  return impact;
}

// 分析直接影响
async function analyzeDirectImpact(changeRequest) {
  const impacts = [];
  
  // 分析API变更影响
  if (changeRequest.type === 'API_CHANGE') {
    const affectedEndpoints = changeRequest.endpoints;
    
    // 查找使用这些API的前端页面
    const frontendPages = await findPagesUsingEndpoints(affectedEndpoints);
    impacts.push({
      component: 'FRONTEND',
      type: 'API_CONSUMER',
      details: frontendPages,
      impactLevel: 'HIGH'
    });
    
    // 查找相关的测试用例
    const affectedTests = await findTestsForEndpoints(affectedEndpoints);
    impacts.push({
      component: 'TESTS',
      type: 'TEST_COVERAGE',
      details: affectedTests,
      impactLevel: 'MEDIUM'
    });
    
    // 查找Mock数据
    const mockData = await findMockDataForEndpoints(affectedEndpoints);
    impacts.push({
      component: 'MOCK_SERVICE',
      type: 'MOCK_DATA',
      details: mockData,
      impactLevel: 'MEDIUM'
    });
  }
  
  // 分析Schema变更影响
  if (changeRequest.type === 'SCHEMA_CHANGE') {
    const affectedTables = changeRequest.tables;
    
    // 查找使用这些表的模块
    const affectedModules = await findModulesUsingTables(affectedTables);
    impacts.push({
      component: 'BACKEND_MODULES',
      type: 'DATA_ACCESS',
      details: affectedModules,
      impactLevel: 'HIGH'
    });
    
    // 查找相关的数据库迁移
    const migrations = await findMigrationsForTables(affectedTables);
    impacts.push({
      component: 'DATABASE',
      type: 'MIGRATION',
      details: migrations,
      impactLevel: 'HIGH'
    });
  }
  
  return impacts;
}
```

---

### 2.4 ③a Mock 服务搭建（与 ③b-1/③b-2 并行，1 个 Agent）

**前置条件**：↺ 拷问审查循环通过，所有依赖产出物均为【锁定版】  
**输入**：`api-contract.yaml`【锁定版】+ `<module>.md`【锁定版】（模块清单）  
**输出**：`mocks/` 目录下的 Mock 服务
> **Agent 定位提示**（供创建 Mock 服务 Agent 时的 system prompt 参考）：你是一个前后端 Mock 专家，负责基于接口契约为前端提供独立的 Mock 服务。

**职责**：
- 基于已锁定的接口契约搭建独立 Mock 服务（推荐 MSW 或 json-server）
- 提供支付、短信、存储、推送等外部依赖的模拟能力
- Mock 数据覆盖所有接口的 happy path 和部分 exception path
- 按 `<module>.md` 中的模块清单组织 Mock 目录结构，与 Stage3 后端开发分配一致
- 前端基于此 Mock 即可开始并行开发

**Mock 生命周期**：
- Mock 服务独立运行，前端通过环境变量切换 baseURL
- Stage4 联调完成后，Mock 服务保留在 `mocks/` 目录作为前端独立开发的基础设施
> Mock 数据与真实数据保持结构一致——Schema 变更时需同步更新 Mock 数据模板

**Mock-实现变更同步**（契约锁定后仍需变更时）：
```
开发Agent发现契约不合理
  → 提交变更申请(change-request.md)
  → Coordinator暂缓该模块(BLOCKED=contract_change_pending)
  → 人类审查（小变更<3接口可自动批准）
  → 批准后：更新api-contract.yaml → Mock Agent同步更新 → 受影响前端Agent收到通知 → 前端对应页面标记"需重新联调"
```
> Coordinator自动分析：读取变更接口 → 扫描所有前端页面引用的API → 输出受影响页面清单。

> **并行前提**：③a Mock、③b-1 单模块测试、③b-2 业务条线测试均需等待 ↺ 循环通过，此时所有产出物均为【锁定版】。三者的工作互不依赖，循环通过后即可并行启动。

---

### 2.5 ③b-1 单模块 API 集成测试（与 ③a/③b-2 并行，最多 2 个 Agent 内部并行）

**前置条件**：↺ 拷问审查循环通过，`spec.md` + `schema.sql` + `<module>.md` 均为【锁定版】  
**输入**：`<module>.md`（各模块验收标准）+ `api-contract.yaml`  
**输出**：`integration-tests/modules/` 目录  
> **Agent 定位提示**（供创建单模块测试 Agent 时的 system prompt 参考）：你是一个单模块 API 集成测试专家，负责基于验收标准和接口契约编写模块级集成测试用例。

**职责**：
- 基于 `<module>.md` 中每个模块的验收标准，编写该模块的 API 集成测试
- 覆盖：接口输入/输出验证、数据库读写正确性、异常路径（参数校验、权限、边界值）
- 测试文件按模块组织：`integration-tests/modules/<module>.test.ts`
- 准备模块级测试数据和 fixture
- **此阶段只写用例，不执行**

**并行策略**：
- 与 ③a Mock、③b-2 业务条线测试均无依赖，同时启动 ✅
- **内部最多 2 个 Agent 并行**：按模块平分（如 Agent-1 负责 user/product，Agent-2 负责 template/trace）
- 每个 Agent 只写自己负责模块的测试，互不干扰（模块间无共享测试状态）
- 测试并行度（2）< 开发并行度（3）的原因：测试用例编写需要更长的上下文保持（每个测试文件需理解完整模块契约），Agent 上下文消耗更快。若资源允许，可将 ③b-1 上限提升至 3，与后端对齐。

> **为什么内部可以并行**：单模块测试仅依赖该模块的 `<module>.md` + api-contract.yaml，模块测试间完全独立——user 模块的测试脚本和 product 模块的测试脚本不存在任何共享变量、数据工厂或流程依赖。

---

### 2.6 ③b-2 业务条线端到端测试（与 ③a/③b-1 并行，1 个 Agent 串行）

**前置条件**：↺ 拷问审查循环通过，PRD + `spec.md` + `<module>.md` 均为【锁定版】  
**输入**：PRD（业务主流程 + 验收标准）+ `<module>.md`（跨模块依赖关系）  
**输出**：`integration-tests/scenarios/` 目录  
> **Agent 定位提示**（供创建业务条线测试 Agent 时的 system prompt 参考）：你是一个业务条线端到端测试专家，负责基于 PRD 业务主流程编写跨模块场景测试用例。

**职责**：
- 基于 PRD「业务主流程」章节，编写跨模块端到端业务场景测试
- 覆盖：完整用户旅程、多模块协作流程、复合业务规则
- 测试文件按场景组织：`integration-tests/scenarios/<scenario>.test.ts`
- 准备场景级共享测试数据工厂和 fixture
- **此阶段只写用例，不执行**

**为什么单 Agent 串行**：
- 一个业务场景（如「营销政策→下单→支付→赋码→溯源」）横跨 4+ 个模块
- 需要统一的测试数据工厂、一致的流程理解、连贯的断言链
- 多个 Agent 并行写同一流程 → 测试数据准备逻辑冲突、断言口径不一致、流程理解偏差
- 单 Agent 按 PRD 业务主流程定义的场景逐个编写，场景间天然隔离，无重复风险

> **为什么内部不能并行**：跨模块测试的本质是「串行故事」。营销政策的订单全流程是一个故事，拆给三个人各写一段拼起来，比一个人完整理解后写下来更容易出错。牺牲一点速度换流程一致性。

**③b-1 与 ③b-2 边界仲裁规则**（当测试应归属哪一方不明确时）：

| 判定条件 | 归属 | 原因 |
|---------|------|------|
| 测试只涉及单个模块的数据库读写 + 接口参数校验 | ③b-1 | 单模块职责 |
| 测试覆盖多模块协作但不涉及 PRD 定义的业务主流程 | ③b-1 | 按模块拆分各自覆盖 |
| 测试覆盖 PRD「业务主流程」中定义的完整用户旅程 | ③b-2 | 场景测试核心职责 |
| 边界不清时（如单模块异常路径需要跨模块数据） | ③b-1 写骨架 + 标记 TODO，③b-2 在对应场景中补全 | 分工不阻塞 |

**实例：同一个业务故事，③b-1 与 ③b-2 各自的测试文件**

以「品牌商创建营销活动 → 消费者扫码查看溯源信息」这条 PRD 业务主线为例：

**③b-1 负责的单模块测试（`integration-tests/modules/`）**：

| 文件 | 测试点（节选） |
|------|--------------|
| `product.test.ts` | `POST /api/products` — 必填字段缺失返回 `400`；类目 ID 不存在返回 `404` |
| `trace.test.ts` | `GET /api/trace/:code` — 溯源码不存在返回 `404`；码段已用完时 `POST /api/trace/assign` 返回 `409` |
| `user.test.ts` | 未登录调用受保护接口返回 `401`；角色无权限访问管理接口返回 `403` |

**③b-2 负责的业务条线测试（`integration-tests/scenarios/`）**：

```
marketing-to-trace.test.ts（一个文件，一条完整故事线）：

  Step 1: 以「品牌商」角色登录
  Step 2: 创建产品 → 创建营销活动 → 关联产品
  Step 3: 为活动生成溯源码段 → 赋码到产品批次
  Step 4: 以「消费者」角色扫码
  Step 5: 断言 → 展示页面包含营销活动信息
  Step 6: 断言 → 整个流程无权限越界、无数据丢失

  关键差异：③b-1 永远只测单个接口的 in/out，
          ③b-2 测的是"跨 4 个模块的 6 步故事"能不能走通。
```

> 记住这个粗判原则：**测试文件抬头看的是接口名（`POST /api/xxx`）→ ③b-1；抬头看的是角色旅程（"以某角色完成某事"）→ ③b-2。**

---

### 2.7 ③c 测试用例静态审查（单Agent，在③a/③b全部完成后串行）

**前置条件**：③b-1和③b-2全部完成  
**输入**：`integration-tests/modules/` + `integration-tests/scenarios/` + `<module>.md` + PRD  
**输出**：测试用例审查报告

**职责**（轻量快速审查，不执行测试）：
- 检查每个模块的测试文件是否存在且非空
- 检查每个test用例是否引用了有效的API路由（对照api-contract.yaml）
- 检查场景测试是否完整覆盖PRD「业务主流程」中的所有步骤
- 检查测试数据fixture是否与schema.sql字段类型一致

**审查通过标准**：无ERROR级别问题。WARNING可记录但通过。
**产出**：审查报告 + 问题清单（如有）→ ③b-1/③b-2对应Agent修正 → 重新审查。

> 此环节是Stage2的最后一道防线，仅检查"用例写对了没有"，不实际执行（执行在Stage4）。

---

### 2.8 Stage2 并行关系总结

```
① 架构专家（串行）
    ↓ 产出 spec.md + schema.sql + api-contract.yaml
    ↓
② 业务领域专家（串行，输入含 PRD）
    ↓ 产出 task.md + <module>.md（模块边界 + 验收标准）
    ↓
↺ 拷问审查循环（grill-with-docs 交叉校验 ① ↔ ②）
    │ ← 不一致则修正重跑
    ↓ 全部通过 → 产出物锁定
    ↓
    ├── ③a Mock 服务专家 → mocks/（并行 ✅）
    ├── ③b-1 单模块 API 集成测试（内部最多 2 Agent 并行 ✅）
    └── ③b-2 业务条线端到端测试（单 Agent 串行 ✅）
    ③a、③b-1、③b-2 三者并行
    ↓
③c 测试用例静态审查（串行收尾）
```

**为什么业务专家必须在 Mock 和 TDD 之前完成，且需经 ↺ 循环锁定**：

| 风险 | 原方案（三者并行） | 调整后（业务先行 + ↺ 循环锁定） |
|------|------------------|-------------------|
| 验收标准不对齐 | TDD 专家从 PRD + spec.md 自行推导验收标准，可能与业务专家定义的验收标准不一致 | ③b-1/③b-2 以 `<module>.md` 中的验收标准为唯一来源，经 ↺ 循环二次校验 |
| 测试粒度混乱 | 单模块测试和跨模块端到端测试混在一起，无明确分工 | ③b-1 按模块组织 API 测试，③b-2 按 PRD 业务主流程组织场景测试，两套目录物理隔离 |
| Mock 组织混乱 | Mock 按接口平铺，与后续开发分配不一致 | Mock 按模块组织目录结构，与 Stage3 后端 Agent 分配一一对应 |
| 时间成本 | 理论上更快（三者并行） | 业务专家纯推理几分钟 + ↺ 循环校验几分钟，串行代价极小 |

**并行前提**：③a Mock、③b-1 单模块测试、③b-2 业务条线测试均需等待 ↺ 拷问审查循环通过。三者的工作互不依赖，循环通过后即可并行启动。

**各专家内部并行策略**：
- 业务领域专家：模块拆分是全局推理，并行分析多个模块易导致边界重叠或遗漏 → 单 Agent 串行
- Mock 服务专家：Mock 间共享工具函数和数据，并行易产生命名冲突或不一致 → 单 Agent 串行
- ③b-1 单模块测试：模块测试间完全独立，无共享状态 → **最多 2 Agent 内部并行**
- ③b-2 业务条线测试：跨模块流程需统一理解，并行会导致数据工厂和断言不一致 → 单 Agent 串行
- ③c 测试用例静态审查：全局检查，需统一视角 → 单 Agent 串行

> **核心原则**：Stage2 的产出物是 Stage3 大规模并行的"契约基础"。契约的质量 > 速度，牺牲几分钟的串行时间换来全流程零返工。

**时间估算（按 PRD 复杂度）**：
- 简单 PRD（<10 个功能点）：业务专家 10-15min，↺ 循环 1 轮 10min
- 中等 PRD（10-30 个功能点）：业务专家 20-30min，↺ 循环 2 轮 30min
- 复杂 PRD（>30 个功能点）：业务专家 40-60min，↺ 循环 2-3 轮 40-60min

---

## 三、Stage3：执行阶段（大规模并行）

### 3.0 Pipeline Coordinator（任务调度器，1 个 Agent）

**定位**：Stage3 的调度中枢，负责按策略分批分配模块/页面给 Backend/Frontend Agent，确保无遗漏、无重复、无死锁。

**输入**：`task.md` + 各 `<module>.md`（含依赖清单 + 所属领域）  
**输出**：每轮的模块/页面分配指令

**通信模式**：Coordinator主动推送（push），不等待Agent请求。Coordinator维护3个后端Slot + 3个前端Slot（IDLE/BUSY），每轮扫描后主动分配。

**状态持久化**：Coordinator维护 `pipeline-state.json`（见§9.4），崩溃后重启可恢复所有slot和模块状态。

**自检机制**：
> 每轮分配后，Coordinator 必须执行「三检」：① 已分配集合 + 未分配集合 == 模块全集；② 已分配模块的依赖是否全部 DONE；③ 本轮分配数 ≤ 空闲 Agent 数。任一检查失败 → 写入 `SCHEDULER_ERROR.md` → 人类介入。

**模块分配信息摘要**（Coordinator传给Agent时不传完整`<module>.md`，传摘要版YAML以降低上下文消耗）：
```yaml
module: product
domain: 业务核心
depends_on: [user]
apis:
  - GET /api/products (list)
  - POST /api/products (create)
  - GET /api/products/:id (detail)
tables:
  - categories (id, name, parent_id)
  - products (id, name, category_id, price)
acceptance:
  happy_path: 3
  exception_path: 4
```
> Agent需要完整信息时通过文件路径按需读取 `<module>.md`。

---

#### 策略一：依赖图驱动调度（无遗漏、无重复、无死锁）

**原理**：将 `<module>.md` 中的「依赖的其他模块清单」转化为有向无环图，按层级分批调度。

```
第 1 轮：扫描所有模块，筛选「未分配 且 依赖已满足*」的模块
         → 分配给空闲 Agent
         → Agent 完成 → 标记为 DONE

第 2 轮：重新扫描，筛选「未分配 且 依赖已满足*」的模块
         → 分配给空闲 Agent
         → ...

重复直到所有模块 DONE

* 依赖已满足 = 依赖列表为空，或依赖的所有模块均已标记为 DONE
```

**调度示例**（假设 4 个模块，3 个 Agent）：

```
模块依赖关系：
  user      → 无依赖
  product   → 无依赖
  template  → 无依赖
  trace     → 依赖 user, product

第 1 轮：user / product / template（3 个无依赖模块）→ 分配给 3 个 Agent 并行
第 2 轮：trace（依赖 user + product 已 DONE）→ 分配给最先空闲的 Agent
```

**启动时依赖图自动校验**：
1. **无环检查**：拓扑排序所有模块，检测循环依赖 → 发现循环则Stage3拒绝启动
2. **隐式依赖检测**：扫描模块的接口定义，若模块A的DTO中引用了模块B的表字段但未声明依赖B → WARNING，人工确认
3. **孤儿模块检测**：未被依赖且不依赖任何模块的模块 → 正常分配
4. **数据竞争扫描**（每个领域所有模块DONE后执行一次）：提取该领域所有模块的schema定义 → 检测是否存在两个模块操作同一张表（即使不同字段）→ 检测外键关联表上的操作时序是否正确 → 发现潜在竞争 → 写入 `race-condition-warnings.md` → Stage4联调重点验证

---

#### 策略二：专家领域匹配（尽其所长）

**原理**：在每一轮中，当可分配模块数 > 空闲 Agent 数时，按 Agent 的擅长领域优先匹配。

**匹配依据**：
- 每个 `<module>.md` 第 3 项标注「所属领域」
- 每个 Backend Agent 有预设的擅长领域

| Agent | 擅长领域 | 优先匹配的模块领域 |
|-------|---------|-------------------|
| Backend-1 | 认证与权限 | 用户、角色、组织、JWT/Session |
| Backend-2 | 业务核心 | 产品、类目、订单、库存 |
| Backend-3 | 工具与配置 | 模板、码段、赋码、文件处理 |

**匹配规则**：
1. 调度器优先将模块分配给领域匹配的专家 Agent
2. 若无匹配专家空闲，降级分配给任意空闲 Agent（兜底）
3. 同领域多个模块排队时，无依赖的优先

**跨领域超量时的优先级**（候选模块跨越多个领域、且数量 > 空闲 Agent 数时）：

| 优先级 | 规则 | 说明 |
|--------|------|------|
| 1 | 被其他模块依赖次数多的优先分配 | 避免长依赖链阻塞后续轮次 |
| 2 | 同优先级模块按模块名稳定排序分配 | 确定性策略，同输入必同输出 |

---

#### 两种策略的协同流程

> **两个策略不是分支选择，而是每轮必须顺序执行的两个阶段**：策略一负责「筛选候选项」，策略二负责「优化分配」。每轮调度都严格走 依赖图筛选 → 专家匹配 → 兜底分配 三步，不存在仅用策略一或仅用策略二的路径。

```
每轮调度：
┌─────────────────────────────────────────┐
│ 1. 依赖图筛选                             │
│    → 找出所有「依赖已满足 且 未分配」的模块      │
├─────────────────────────────────────────┤
│ 2. 专家匹配                               │
│    → 在候选模块中，优先分配领域匹配的 Agent      │
│    → 匹配成功 → 分配                        │
│    → 匹配失败 → 进入兜底                      │
├─────────────────────────────────────────┤
│ 3. 兜底分配                               │
│    → 剩余模块分配给任意空闲 Agent             │
├─────────────────────────────────────────┤
│ 4. 标记分配                               │
│    → 模块标记为「已分配」，写入分配日志          │
│    → Agent 完成后标记模块为「DONE」           │
└─────────────────────────────────────────┘
```

**实例：一次完整的调度轮次走查**

假设当前进度：`user` 模块 DONE，`product` 模块 DONE，下一轮扫描出 4 个依赖已满足的候选模块，但只有 2 个 Agent 空闲：

```
候选模块（4个）          空闲 Agent（2个）
├─ trace    业务核心  被依赖 2 次       Backend-2（业务核心）自由
├─ template 工具与配置 被依赖 0 次       Backend-3（工具与配置）自由
├─ dashboard 工具与配置 被依赖 1 次       Backend-1（认证权限）正忙
└─ report   工具与配置 被依赖 0 次

调度决策：
  1. 依赖图筛选 → 4 个候选全部通过
  2. 专家匹配：
     trace    → Backend-2 领域匹配 ✅ → 分配
     template → Backend-3 领域匹配 ✅ → 分配
  3. 仅剩 2 个模块（dashboard、report），无匹配 Agent 空闲
     → 跨领域超量优先级：dashboard 被依赖 1 次 > report 被依赖 0 次
     → dashboard 标记为下一轮优先
     → report 排到队尾

下一轮：Backend-1 或 Backend-2 完成后，dashboard 优先分配（无论哪个 Agent 空闲——兜底机制）
```

> 这个例子演示了双策略协同：依赖图保证不遗漏（4 个全筛出），专家匹配保证质量（trace/template 精准分配），跨领域优先级保证不阻塞（被依赖多的 dashboard 优先），兜底保证不僵持（非领域专家也能接手）。

---

#### 防错机制

| 问题 | 机制 |
|------|------|
| **遗漏** | `task.md` 是模块全集。调度器每轮记录已分配/已完成集合，最终检查「已完成集合 == 全集」 |
| **重复** | 模块分配后立即写入「已分配」集合，后续扫描自动跳过 |
| **死锁** | Stage2 业务专家拆模块时校验依赖无环；调度器启动时二次校验依赖图 |
| **领域不匹配** | 策略二的兜底机制（降级分配给任意空闲 Agent）确保不会因等待特定专家而阻塞 |

> **调度器本身是轻量 Agent**：不做开发，不写代码。只读取 `task.md` + `<module>.md`，维护分配状态，发指令给 Backend/Frontend Agent。

---

### 3.1 后端团队：按模块 TDD 开发（最多 3 个 Agent 并行）

**调度方式**：由 Pipeline Coordinator 按 [策略一 + 策略二] 分批分配模块。  
**Agent 数量上限**：后端最多 3 个 Agent 并行。即使模块超过 3 个，也按批次执行（先完成一批再分配下一批）。

> 上限 3 基于以下约束【待验证假设】：① 上下文窗口成本——每个 Agent 独立会话消耗独立上下文配额；② 协调复杂度——Pipeline Coordinator 维护 3 个并行状态已接近人类可追踪上限；③ 模块粒度——MVP 阶段单业务域通常可拆为 3-6 个模块，分两批执行不会显著增加总耗时。

**每个后端 Agent 负责一个模块**，遵循 TDD 循环：

```
Red（写测试）→ Green（写实现）→ Refactor（重构）
     ↑_________________________________|
```

**每个 TDD 循环的代码审查（Code Review）**：

| TDD阶段 | 触发Review? | 量化标准 | Review内容 |
|---------|------------|---------|-----------|
| Red阶段（测试失败） | ❌ 不触发 | — | — |
| Green阶段（实现刚完成） | ✅ 自动触发 | 连续2次运行同一测试均失败 | 实现逻辑、API契约一致性 |
| Refactor阶段（重构中） | ❌ 不触发 | — | 开发Agent自审 |
| Refactor完成后测试失败 | ✅ 自动触发 | 单次失败即可 | 是否破坏行为、违反契约 |
| 模块间接口调用 | ⚠️ 预检 | 每次跨模块调用前异步预检 | 契约一致性 |
| 模块标记DONE前 | ✅ 强制触发 | **终审** | 全量：5层测试+代码规范+边界覆盖 |

**Code Review 由独立 Review Agent 执行**：
- Review Agent 为按需独立 spawn，不占用 Backend/Frontend Agent 配额
- 每触发一次 Review，独立 spawn 一个 Review Agent 实例，Review 完成后销毁
- 检查是否符合 `spec.md` 接口契约
- 检查 Schema 定义是否一致
- 检查异常路径是否覆盖
- 检查代码风格和最佳实践

**Review通过标准**：

| 级别 | 含义 | 动作 |
|------|------|------|
| P0（阻塞） | 接口契约不一致、安全漏洞、数据丢失风险 | 必须修复，修复后重新全量Review |
| P1（重要） | 异常路径未覆盖、潜在性能问题 | 建议修复，开发Agent决定是否立即修 |
| P2（建议） | 代码风格、命名建议 | 记录，Stage4前统一清理 |

> DONE前终审：P0必须清零，P1≤2个。

**Review Agent 产出格式**：
```markdown
<!-- <module>.review.md -->
# Code Review: <模块名>
- 审查时间: <timestamp>
- Review Agent: <实例标识>

## 问题分类
### [阻塞] 必须修复
| 序号 | 问题 | 引用条款 | 修复指引 |
|------|------|---------|---------|

### [建议] 可选修复
| 序号 | 问题 | 引用条款 | 修复指引 |
|------|------|---------|---------|

### [风格] 参考
| 序号 | 问题 | 引用条款 | 修复指引 |
|------|------|---------|---------|
```

**Review 流转**：
```
Backend Agent 读取 review 文件 → 修复 → 删除 DONE 标记 → 重新 TDD → 再次标记 DONE → Review Agent 复评
```

**打回上限**：同一模块最多 3 轮 Review，第 3 轮仍不通过 → 人类介入。

**Backend Agent 开发失败处理**：
> 同一模块 TDD 循环超过 5 轮仍无法 Green，或 Code Review 打回超过 3 轮 → 标记模块为 `BLOCKED` + 失败原因 → Pipeline Coordinator 将该模块降级为「人类开发」→ 其他无依赖模块继续并行。

**模块文件结构（每个 Agent 独立）**：
```
src/
  modules/
    <module>/
      ├── routes.ts        # 路由定义
      ├── service.ts       # 业务逻辑
      ├── schema.ts        # 表定义（引用全局 schema）
      ├── types.ts         # DTO / 类型
      └── <module>.test.ts # 单元测试
```

**后端 Agent 专家描述（spawn 时配置）**：

| Agent 编号 | 专家角色 | 擅长领域 | 分配策略 |
|-----------|---------|---------|---------|
| Backend-1 | 认证与权限专家 | 用户、角色、组织、JWT/Session | 优先分配用户/权限相关模块 |
| Backend-2 | 业务核心专家 | 产品、类目、订单、库存 | 优先分配核心业务模块 |
| Backend-3 | 工具与配置专家 | 模板、码段、赋码、文件处理 | 优先分配工具/配置类模块 |

> 每个 Backend Agent 的 system prompt 必须包含：技术栈（Hono + Drizzle + SQLite）、TDD 规范、Code Review 触发条件、模块边界约束。

**并行约束**：
- ✅ 无依赖的模块可完全并行（如用户管理 vs 类目管理）
- ⚠️ 有依赖的模块需等待依赖模块 Schema 锁定（如订单管理需等待用户管理完成）
- ❌ 禁止按代码层垂直拆分（如一个 Agent 写所有路由，另一个写所有 Service）
- 🔒 后端 Agent 数量硬上限为 3，超出模块按批次排队

---

### 3.2 前端团队：基于 Mock 并行开发（多 Agent 并行）

**输入**：`spec.md` + Mock 服务  
**输出**：Vue 3 页面 + 组件 + Composables

**Agent 数量上限**：前端最多 3 个 Agent 并行。公共组件由第一个完成的 Agent 或独立轮次处理。

**前端页面分配算法**（Coordinator按以下优先级拆分）：
1. **公共组件先行**（第0轮）：Layout、Nav、AuthGuard等 → 分配给Frontend-1
2. **按路由模块拆分**（第1轮起）：每个Agent分配一个路由模块，子页面归同一Agent
3. **负载均衡**：路由模块数 > 3时，按页面数大致均匀分配
4. **页面间无交叉**：一个路由模块只分配给一个Agent

**拆分策略**：按页面/功能模块拆分

| Agent 编号 | 专家角色 | 擅长领域 | 分配页面 |
|-----------|---------|---------|---------|
| Frontend-1 | 表单与权限专家 | 登录、用户管理、角色管理、组织管理 | 用户/权限相关页面 |
| Frontend-2 | 数据展示专家 | 列表、详情、搜索、筛选、分页 | 产品/类目相关页面 |
| Frontend-3 | 流程与配置专家 | 向导、配置、模板、码段管理 | 溯源/赋码相关页面 |

> 每个 Frontend Agent 的 system prompt 必须包含：Vue 3 + Vite 技术栈、Mock API 地址、组件规范、接口契约引用路径。

**开发原则**：
- 所有 API 调用指向 Mock 服务
- 页面逻辑、表单验证、状态管理可独立开发
- 接口契约锁定后，前端无需等待后端完成
- 🔒 前端 Agent 数量硬上限为 3，超出页面按批次排队

**前端测试层级**（前端TDD-Lite，与后端对称的三层）：

| 层级 | 测试对象 | 工具 | 触发时机 |
|------|---------|------|---------|
| **FT1 组件单元测试** | Composable函数、工具函数、Pinia Store | Vitest | 开发时同步编写 |
| **FT2 页面集成测试** | 完整页面渲染、表单交互、路由跳转 | Vitest + @vue/test-utils | 页面完成后 |
| **FT3 E2E场景测试** | 真实浏览器用户旅程 | Playwright | Stage4执行 |

> 与后端TDD的区别：前端可先写页面再补测试（Mock已就绪，视觉优先），但组件和Store必须测试先行。

**前端Mock连接规范**：
- Mock地址统一通过环境变量 `VITE_API_BASE_URL` 注入
- 开发模式下 `.env.development` 指向Mock服务（如 `http://localhost:3001`）
- Stage4联调时切换 `.env.production` 指向真实API
- 页面代码中不硬编码API地址，统一从 `api.config.ts` 读取
- Mock数据更新后，前端通过 Mock 服务热更新机制自动同步

**前端开发中的Mock持续验证**：
每个前端Agent在开发每个页面时，自动执行Mock检查：对比Mock返回的JSON结构与api-contract.yaml的Response DTO、验证happy path返回2xx/exception path返回4xx/5xx。发现不一致 → 写入 `mock-drift-issues.md` → Coordinator在Stage4开始前统一处理。

---

### 3.3 测试团队：事件驱动的边界用例补充（与后端并行）

**定位**：在 Stage2 ③b-1/③b-2 已产出的测试基础上，根据 Stage3 实际开发进展补充边界用例。

**与 Stage2 测试专家的关系**：
- Stage2 ③b-1/③b-2 负责编写**骨架用例**（happy path + 主要 exception path）
- Stage3 测试团队负责在开发过程中**补充边缘用例**（复杂边界值、并发场景、极端数据量）
- 可以是 Stage2 测试专家的同一 Agent 实例，也可以是新实例——取决于上下文窗口是否充足

**触发机制**（事件驱动，不主动轮询）：

| 触发事件 | 补充动作 | 时效要求 |
|---------|---------|---------|
| 新模块标记DONE | 追加该模块的并发场景测试、大数据量测试 | DONE后30min内 |
| Code Review发现异常路径遗漏 | 补充被遗漏的异常路径测试 | Review后15min内 |
| 一个领域的所有模块DONE | 追加该领域的跨模块数据一致性测试 | 完成后30min内 |
| 后端全部DONE | 追加全局并发压力测试 | Stage4开始前 |

**职责**：
- 根据后端开发进展补充复杂边界用例
- 对 Stage3 中实际暴露的新边界场景追加测试
- 等待 Stage3 末的统一集成测试窗口执行全量用例

**增量集成测试窗口**（嵌入Stage3，非独立Stage）：
- 每轮调度中，模块标记DONE后，立即执行该模块对应的 `integration-tests/modules/` 测试
- 该模块依赖的模块已DONE时，执行涉及的跨模块 `scenarios/` 测试子集
- 输出增量测试报告，发现失败立即反馈给对应Agent
- Stage3全部模块DONE后，执行全量集成测试作为进入Stage4的门禁

> 增量测试 ≈ 每模块DONE后10秒级快速反馈；全量测试 ≈ Stage3末分钟级门禁关卡。

### 3.4 增量测试窗口详细设计（v2.6 新增）

> **目标**：在Stage3开发过程中提供快速反馈，尽早发现集成问题，减少Stage4的集成风险。

#### 1. 模块级增量测试

**触发时机**：每个Backend Agent标记模块DONE后立即执行

```javascript
// 模块级增量测试执行器
async function executeModuleIncrementalTest(moduleName) {
  console.log(`[增量测试] 执行模块 ${moduleName} 的增量测试`);
  
  const testResults = {
    module: moduleName,
    executedAt: new Date().toISOString(),
    tests: []
  };
  
  // 1. 执行模块单元测试
  const unitTestResult = await runModuleUnitTests(moduleName);
  testResults.tests.push({
    type: 'UNIT',
    name: `${moduleName} 单元测试`,
    passed: unitTestResult.passed,
    duration: unitTestResult.duration,
    coverage: unitTestResult.coverage
  });
  
  // 2. 执行模块API集成测试
  const apiTestResult = await runModuleApiTests(moduleName);
  testResults.tests.push({
    type: 'API_INTEGRATION',
    name: `${moduleName} API集成测试`,
    passed: apiTestResult.passed,
    duration: apiTestResult.duration,
    endpoints: apiTestResult.endpoints
  });
  
  // 3. 执行模块数据库测试
  const dbTestResult = await runModuleDatabaseTests(moduleName);
  testResults.tests.push({
    type: 'DATABASE',
    name: `${moduleName} 数据库测试`,
    passed: dbTestResult.passed,
    duration: dbTestResult.duration,
    transactions: dbTestResult.transactions
  });
  
  // 4. 执行模块边界测试
  const boundaryTestResult = await runModuleBoundaryTests(moduleName);
  testResults.tests.push({
    type: 'BOUNDARY',
    name: `${moduleName} 边界测试`,
    passed: boundaryTestResult.passed,
    duration: boundaryTestResult.duration,
    edgeCases: boundaryTestResult.edgeCases
  });
  
  // 5. 计算总体结果
  testResults.overallPassed = testResults.tests.every(t => t.passed);
  testResults.totalDuration = testResults.tests.reduce((sum, t) => sum + t.duration, 0);
  
  // 6. 保存测试报告
  await saveTestReport(`reports/incremental/${moduleName}-incremental.json`, testResults);
  
  // 7. 如果失败，通知对应Agent
  if (!testResults.overallPassed) {
    await notifyAgentOfFailure(moduleName, testResults);
  }
  
  return testResults;
}
```

#### 2. 跨模块场景测试

**触发条件**：当模块的所有依赖模块都已完成时

```javascript
// 跨模块场景测试执行器
async function executeCrossModuleScenarioTests(moduleName) {
  console.log(`[增量测试] 执行模块 ${moduleName} 的跨模块场景测试`);
  
  const moduleSpec = await loadModuleSpec(moduleName);
  const dependencies = moduleSpec.depends_on;
  
  // 检查依赖是否满足
  const completedModules = await getCompletedModules();
  const allDependenciesMet = dependencies.every(dep => completedModules.includes(dep));
  
  if (!allDependenciesMet) {
    console.log(`[增量测试] 模块 ${moduleName} 的依赖未满足，跳过跨模块测试`);
    return null;
  }
  
  const testResults = {
    module: moduleName,
    dependencies: dependencies,
    executedAt: new Date().toISOString(),
    scenarios: []
  };
  
  // 1. 查找涉及该模块的场景测试
  const relevantScenarios = await findScenariosInvolvingModule(moduleName);
  
  // 2. 执行每个相关场景
  for (const scenario of relevantScenarios) {
    const scenarioResult = await runScenarioTest(scenario, [moduleName, ...dependencies]);
    testResults.scenarios.push({
      name: scenario.name,
      passed: scenarioResult.passed,
      duration: scenarioResult.duration,
      steps: scenarioResult.steps
    });
  }
  
  // 3. 计算总体结果
  testResults.overallPassed = testResults.scenarios.every(s => s.passed);
  testResults.totalDuration = testResults.scenarios.reduce((sum, s) => sum + s.duration, 0);
  
  // 4. 保存测试报告
  await saveTestReport(`reports/incremental/${moduleName}-cross-module.json`, testResults);
  
  return testResults;
}
```

#### 3. 领域级集成测试

**触发条件**：当某个领域的所有模块都已完成时

```javascript
// 领域级集成测试执行器
async function executeDomainIntegrationTests(domainName) {
  console.log(`[增量测试] 执行领域 ${domainName} 的集成测试`);
  
  const domainModules = await getModulesByDomain(domainName);
  const completedModules = await getCompletedModules();
  
  // 检查领域内所有模块是否完成
  const allDomainModulesCompleted = domainModules.every(m => completedModules.includes(m));
  
  if (!allDomainModulesCompleted) {
    console.log(`[增量测试] 领域 ${domainName} 的模块未全部完成，跳过领域集成测试`);
    return null;
  }
  
  const testResults = {
    domain: domainName,
    modules: domainModules,
    executedAt: new Date().toISOString(),
    integrationTests: []
  };
  
  // 1. 执行领域内模块间集成测试
  for (let i = 0; i < domainModules.length; i++) {
    for (let j = i + 1; j < domainModules.length; j++) {
      const moduleA = domainModules[i];
      const moduleB = domainModules[j];
      
      const integrationResult = await runModulePairIntegrationTest(moduleA, moduleB);
      testResults.integrationTests.push({
        modules: [moduleA, moduleB],
        passed: integrationResult.passed,
        duration: integrationResult.duration,
        issues: integrationResult.issues
      });
    }
  }
  
  // 2. 执行领域数据一致性测试
  const dataConsistencyResult = await runDomainDataConsistencyTest(domainName);
  testResults.integrationTests.push({
    type: 'DATA_CONSISTENCY',
    domain: domainName,
    passed: dataConsistencyResult.passed,
    duration: dataConsistencyResult.duration,
    inconsistencies: dataConsistencyResult.inconsistencies
  });
  
  // 3. 执行领域业务流程测试
  const businessFlowResult = await runDomainBusinessFlowTest(domainName);
  testResults.integrationTests.push({
    type: 'BUSINESS_FLOW',
    domain: domainName,
    passed: businessFlowResult.passed,
    duration: businessFlowResult.duration,
    flowSteps: businessFlowResult.steps
  });
  
  // 4. 计算总体结果
  testResults.overallPassed = testResults.integrationTests.every(t => t.passed);
  testResults.totalDuration = testResults.integrationTests.reduce((sum, t) => sum + t.duration, 0);
  
  // 5. 保存测试报告
  await saveTestReport(`reports/incremental/domain-${domainName}.json`, testResults);
  
  return testResults;
}
```

#### 4. 全量集成测试门禁

**触发时机**：Stage3全部模块完成后，进入Stage4前

```javascript
// 全量集成测试门禁
async function executeFullIntegrationTestGate() {
  console.log('[门禁检查] 执行全量集成测试门禁');
  
  const gateResults = {
    executedAt: new Date().toISOString(),
    checks: [],
    overallPassed: false
  };
  
  // 1. 检查所有模块是否完成
  const allModules = await getAllModules();
  const completedModules = await getCompletedModules();
  const incompleteModules = allModules.filter(m => !completedModules.includes(m));
  
  if (incompleteModules.length > 0) {
    gateResults.checks.push({
      type: 'MODULE_COMPLETENESS',
      passed: false,
      message: `以下模块未完成: ${incompleteModules.join(', ')}`
    });
    return gateResults;
  }
  
  gateResults.checks.push({
    type: 'MODULE_COMPLETENESS',
    passed: true,
    message: '所有模块已完成'
  });
  
  // 2. 执行全量单元测试
  const unitTestResult = await runAllUnitTests();
  gateResults.checks.push({
    type: 'UNIT_TESTS',
    passed: unitTestResult.passed,
    total: unitTestResult.total,
    passedCount: unitTestResult.passedCount,
    failedCount: unitTestResult.failedCount,
    coverage: unitTestResult.coverage
  });
  
  // 3. 执行全量API集成测试
  const apiTestResult = await runAllApiTests();
  gateResults.checks.push({
    type: 'API_TESTS',
    passed: apiTestResult.passed,
    total: apiTestResult.total,
    passedCount: apiTestResult.passedCount,
    failedCount: apiTestResult.failedCount
  });
  
  // 4. 执行全量场景测试
  const scenarioTestResult = await runAllScenarioTests();
  gateResults.checks.push({
    type: 'SCENARIO_TESTS',
    passed: scenarioTestResult.passed,
    total: scenarioTestResult.total,
    passedCount: scenarioTestResult.passedCount,
    failedCount: scenarioTestResult.failedCount
  });
  
  // 5. 执行跨模块集成测试
  const crossModuleResult = await runAllCrossModuleTests();
  gateResults.checks.push({
    type: 'CROSS_MODULE_TESTS',
    passed: crossModuleResult.passed,
    total: crossModuleResult.total,
    passedCount: crossModuleResult.passedCount,
    failedCount: crossModuleResult.failedCount
  });
  
  // 6. 执行性能基准测试
  const performanceResult = await runPerformanceBaselineTests();
  gateResults.checks.push({
    type: 'PERFORMANCE_TESTS',
    passed: performanceResult.passed,
    responseTime: performanceResult.responseTime,
    throughput: performanceResult.throughput,
    errorRate: performanceResult.errorRate
  });
  
  // 7. 计算总体结果
  gateResults.overallPassed = gateResults.checks.every(c => c.passed);
  
  // 8. 生成门禁报告
  await saveTestReport('reports/integration-gate.json', gateResults);
  
  // 9. 如果通过，允许进入Stage4
  if (gateResults.overallPassed) {
    console.log('[门禁检查] 全量集成测试通过，允许进入Stage4');
    await unlockStage4();
  } else {
    console.log('[门禁检查] 全量集成测试未通过，阻止进入Stage4');
    await blockStage4(gateResults);
  }
  
  return gateResults;
}
```

#### 5. 增量测试配置

```javascript
// 增量测试配置
const INCREMENTAL_TEST_CONFIG = {
  // 模块级测试配置
  moduleLevel: {
    enabled: true,
    triggerOn: 'MODULE_DONE',
    timeout: 30000, // 30秒超时
    retryCount: 2,
    failFast: true, // 快速失败
    notifyOnFailure: true
  },
  
  // 跨模块测试配置
  crossModule: {
    enabled: true,
    triggerOn: 'ALL_DEPENDENCIES_MET',
    timeout: 60000, // 1分钟超时
    retryCount: 1,
    scenarioSubsetSize: 5, // 每次最多执行5个场景
    prioritizeByRisk: true
  },
  
  // 领域级测试配置
  domainLevel: {
    enabled: true,
    triggerOn: 'ALL_DOMAIN_MODULES_DONE',
    timeout: 120000, // 2分钟超时
    retryCount: 1,
    testTypes: ['INTEGRATION', 'DATA_CONSISTENCY', 'BUSINESS_FLOW']
  },
  
  // 全量门禁配置
  fullGate: {
    enabled: true,
    triggerOn: 'ALL_MODULES_DONE',
    timeout: 300000, // 5分钟超时
    requiredCoverage: 80, // 最低覆盖率80%
    requiredPassRate: 100, // 100%通过率
    blockOnFailure: true
  },
  
  // 报告配置
  reporting: {
    generateReport: true,
    reportFormat: 'JSON',
    reportPath: 'reports/incremental/',
    includeDetails: true,
    includeMetrics: true
  },
  
  // 通知配置
  notifications: {
    onFailure: true,
    onSuccess: false,
    channel: 'CONSOLE',
    includeDetails: true
  }
};
```

#### 6. 增量测试指标

```javascript
// 增量测试指标收集
const INCREMENTAL_TEST_METRICS = {
  // 测试执行指标
  execution: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    totalDuration: 0,
    averageDuration: 0
  },
  
  // 覆盖率指标
  coverage: {
    lineCoverage: 0,
    branchCoverage: 0,
    functionCoverage: 0,
    statementCoverage: 0
  },
  
  // 质量指标
  quality: {
    defectDetectionRate: 0, // 缺陷发现率
    falsePositiveRate: 0,   // 误报率
    testEffectiveness: 0,   // 测试有效性
    regressionRisk: 0       // 回归风险
  },
  
  // 效率指标
  efficiency: {
    feedbackTime: 0,        // 反馈时间（从DONE到测试完成）
    fixTime: 0,             // 修复时间（从失败到修复）
    retestTime: 0,          // 重测时间
    cycleTime: 0            // 周期时间
  },
  
  // 收集指标
  async collectMetrics(testResults) {
    // 更新执行指标
    this.execution.totalTests++;
    if (testResults.overallPassed) {
      this.execution.passedTests++;
    } else {
      this.execution.failedTests++;
    }
    this.execution.totalDuration += testResults.totalDuration;
    this.execution.averageDuration = this.execution.totalDuration / this.execution.totalTests;
    
    // 计算质量指标
    this.quality.defectDetectionRate = this.execution.failedTests / this.execution.totalTests;
    
    // 保存指标
    await this.saveMetrics();
  },
  
  async saveMetrics() {
    await writeFile('metrics/incremental-test-metrics.json', JSON.stringify(this, null, 2));
  }
};
```

#### 7. 增量测试报告模板

```markdown
# 增量测试报告

- **报告时间**：<ISO 8601>
- **测试阶段**：<模块级/跨模块/领域级/全量门禁>
- **触发事件**：<DONE/依赖满足/领域完成/全部完成>

## 测试概览
- **总测试数**：<数量>
- **通过数**：<数量>
- **失败数**：<数量>
- **跳过数**：<数量>
- **总耗时**：<时间>
- **通过率**：<百分比>

## 模块级测试详情
| 模块 | 单元测试 | API测试 | 数据库测试 | 边界测试 | 总体结果 |
|------|---------|--------|-----------|---------|----------|
| user | ✅ | ✅ | ✅ | ✅ | ✅ |
| product | ✅ | ❌ | ✅ | ✅ | ❌ |

## 跨模块测试详情
| 场景 | 涉及模块 | 结果 | 耗时 |
|------|---------|------|------|
| 用户创建产品 | user, product | ✅ | 1.2s |
| 产品下单 | product, order | ❌ | 2.1s |

## 失败详情
| 测试名称 | 失败原因 | 影响范围 | 建议修复 |
|---------|---------|---------|----------|
| product-api-create | 状态码不匹配 | 产品创建功能 | 检查API实现 |

## 覆盖率报告
- **行覆盖率**：<百分比>
- **分支覆盖率**：<百分比>
- **函数覆盖率**：<百分比>

## 性能指标
- **平均响应时间**：<毫秒>
- **95%响应时间**：<毫秒>
- **吞吐量**：<请求/秒>
- **错误率**：<百分比>

## 建议
1. <建议1>
2. <建议2>
```

---

## 四、Stage4：集成与验收（串行收敛）

### 4.0 Stage4 Coordinator（集成协调者）

Stage4虽串行，但涉及后端合并、前端联调、集成测试、Bug修复等多个角色，需要明确的协调者。可复用Stage3的Pipeline Coordinator实例（上下文已有全局视图），或使用独立轻量Agent。

**职责**：
1. 编排4个子阶段的执行顺序
2. 接收联调问题 → 分类（契约问题/实现问题/理解偏差）→ 分发（后端/前端/Mock）
3. 接收集成测试报告 → 提取Bug → 分配Debug Agent → 跟踪修复状态
4. 最终门禁检查

---

### 4.1 后端模块合并（四步子流程）

**Step 1 合并前检查**：
- 确认所有模块状态为 DONE（非 BLOCKED/DEFER）
- 验证依赖链闭环——各模块的依赖声明与最终状态一致
- Schema冲突检测——检查不同模块是否定义了同名但不同类型的字段
- 路由冲突检测——无重复的 HTTP Method + Path 组合

**Step 2 路由聚合**：
- 收集所有模块 routes.ts 中的路由定义
- 按路径前缀分组，挂载到统一 Hono app
- 验证中间件链顺序（auth → body-parser → router → error-handler）

**Step 3 Schema引用解析**：
- 检查每个模块 schema.ts 对全局 schema 的 import 路径正确性
- 运行 Drizzle Schema 编译验证

**Step 4 合并后验证**：
- 启动应用（至少 import 级验证，确认无启动异常）
- 运行全量单元测试（必须全部通过）
- 运行全量集成测试

**Drizzle Migration 执行时机**：
> Stage4 后端合并完成后统一执行。Stage3 各模块开发时使用 `db:push`（开发模式，直接同步 Schema 到本地 SQLite），不执行正式 Migration。Stage4 合并后执行 `drizzle-kit generate` + `drizzle-kit migrate`，生成正式 Migration 文件纳入版本控制。

---

### 4.2 前后端联调

- 前端切换 Mock → 真实后端 API
- 按模块逐个联调
- 记录接口不匹配问题

**切换策略**：
> 按模块逐个切换。某模块后端 DONE 且通过 Code Review 后，前端对应页面即可切换。切换方式：前端配置文件 `api.config.ts` 中按模块映射 baseURL（`user: mock` → `user: real`）。回退策略：切换后发现问题 → 标记该模块为 `BLOCKED` → 回退到 Mock → Debug Agent 修复 → 再次切换。

> 联调问题记录模板见配套 SKILL.md Stage4 章节。白皮书定义流程和门禁，SKILL.md 定义具体模板和检查清单。

---

### 4.3 集成测试执行

**执行者**：测试团队  
**输入**：完整系统 + `integration-tests/`  
**输出**：测试报告 + Bug 清单

**测试覆盖**：
- Happy Path：PRD 中的主流程场景
- Exception Path：异常、边界、权限、并发
- 端到端场景：跨模块业务流程

**通过率阈值**：
> Happy Path 100% 通过，Exception Path ≥80% 通过。低于阈值：停止交付 → Debug Agent 按优先级修复（阻塞问题 > 功能缺陷 > 边界偏差）→ 修复后重新执行全量集成测试。

**Stage4回滚协议**（触发条件：任一满足且人类确认后执行）：

| 触发条件 | 回滚路径 |
|---------|---------|
| 集成测试发现P0缺陷 > 3个 | 回滚到Stage3最后一个全量测试通过的检查点 |
| Bug修复引入了新的P0缺陷 | 保留所有模块代码，状态回退到检查点 |

回滚操作流程：
1. 读取 `pipeline-state.json` 上一个绿色检查点
2. 对比差异 → 移除检查点后变更（保留Bug修复）
3. 重置模块状态 → 重新执行Stage4门禁

风险控制：
- 回滚是手动触发（需人类确认）
- 回滚前Git备份当前代码
- 回滚后仍无法通过 → 标记"本轮不可交付"，进入Stage5复盘

---

### 4.4 Bug 修复循环

```
集成测试发现 Bug
    ↓
分配给 Debug 修复专家 Agent
    ↓
定位根因（代码 / 设计 / 需求理解偏差），标记根因分类（见§12.2）
    ↓
修复 → 单元测试验证 → Code Review
    ↓
回归集成测试
    ↓
通过？→ 是：关闭 / 否：继续循环
```

**循环终止条件**：

| 终止条件 | 定义 | 说明 |
|---------|------|------|
| **正常终止** | 所有 P0/P1 Bug 已修复 | 最高优先级 |
| **时间终止** | 超过预设时间（如4小时） | 进入后续迭代 |
| **回归终止** | 同一Bug修复3次仍失败 | 标记为「技术债务」，记录到 `TECH_DEBT.md` |
| **人工终止** | 人工判断该Bug不值得修 | 记录决策理由 |

**Debug 修复专家职责**：
- 接收 Bug 报告，复现问题
- 判断是代码缺陷、接口不一致还是需求理解偏差
- 修复并补充回归测试
- 高风险修改需重新走 Code Review

**回归测试目录与管理**：

目录结构新增 `integration-tests/regression/`：
- 每个Bug修复必须创建一个回归测试文件：`regression/bug-<编号>-<简述>.test.ts`
- 回归测试必须独立（不依赖其他测试状态），包含：Bug复现步骤+断言+修复验证
- 每次全量集成测试时 `regression/` 必须全部执行
- 回归测试套件单调增长（只增不减），确保历史Bug不重现
- 超过5轮迭代无失败的回归测试可标记为"低价值"但不删除

---

### 4.5 产物归档

**交付目录结构**：
```
delivery/
  ├── docs/
  │   ├── PRD.md
  │   ├── spec.md
  │   ├── api-contract.yaml
  │   └── task.md
  ├── backend/
  │   ├── src/
  │   └── tests/
  ├── frontend/
  │   ├── src/
  │   └── tests/
  └── integration-tests/
      ├── modules/
      └── scenarios/
```

### 4.6 E2E测试门禁（v2.6 新增）

> **目标**：确保真实用户使用时不遇到阻塞问题。E2E测试必须覆盖所有关键业务路径。

#### 4.6.1 E2E覆盖率最低标准

| 模块类型 | 最低 E2E 用例数 | 说明 |
|---------|:-----------:|------|
| 登录认证 | 12+ | 正常登录(每角色) + 错误密码 + 入口匹配 + 改密(3场景) + 找回密码 + 退出 |
| 角色管理 | 6+ | CRUD + 启用/禁用 + 权限分配 + 非管理员拒绝 |
| 账号管理 | 8+ | CRUD + 启用/禁用 + 重置密码 + 权限查看 + 手机号校验 + 非管理员拒绝 + 禁用后不可登录 |
| 渠道管理 | 10+ | CRUD + 企业/个人类型 + 启用/禁用 + 重置密码 + 重复手机号 + 关联弹窗 + 销售可创建 |
| 客户管理 | 8+ | CRUD + 单/多联系人 + 关联弹窗 + 渠道人员隔离 + 搜索 |
| 商机管理 | 15+ | 创建+审核(通过/驳回/撤销)+跟进+状态流转+调配+编辑退回+汇总+伙伴报备+隔离 |
| 首页仪表盘 | 3+ | KPI卡片 + 图表 + 按角色数据正确 |
| 导航与布局 | 5+ | 菜单权限(每角色) + 页面跳转 + 用户信息显示 |
| **合计最低** | **70+** | 覆盖所有 PRD 验收标准 + 所有角色 + 所有错误路径 |

> 实际用例数按模块复杂度等比放大。如商机管理含状态机+审批流，应 20+。

#### 4.6.2 阻塞场景必测清单

**1. 登录流程（12+ 用例）**
```typescript
// 登录测试矩阵
const LOGIN_TEST_MATRIX = [
  // 正常登录
  { scenario: '管理员正常登录', role: 'admin', expect: 'success' },
  { scenario: '销售人员正常登录', role: 'sales', expect: 'success' },
  { scenario: '渠道人员正常登录', role: 'partner', expect: 'success' },
  
  // 错误路径
  { scenario: '错误密码', role: 'admin', password: 'wrong', expect: 'error' },
  { scenario: '空手机号', phone: '', expect: 'validation_error' },
  { scenario: '无效手机号格式', phone: '123', expect: 'validation_error' },
  
  // 入口匹配
  { scenario: '管理员入口登录', entryType: 'admin', expect: 'redirect_admin' },
  { scenario: '销售入口登录', entryType: 'sales', expect: 'redirect_sales' },
  
  // 改密场景
  { scenario: '首次登录强制改密', firstLogin: true, expect: 'change_password' },
  { scenario: '修改密码成功', action: 'change_password', expect: 'success' },
  { scenario: '修改密码-旧密码错误', action: 'change_password', oldPwd: 'wrong', expect: 'error' },
  
  // 找回密码
  { scenario: '找回密码流程', action: 'forgot_password', expect: 'success' },
  
  // 退出
  { scenario: '退出登录', action: 'logout', expect: 'success' }
];
```

**2. 菜单导航（5+ 用例）**
```typescript
// 菜单测试矩阵
const MENU_TEST_MATRIX = [
  { scenario: '管理员菜单完整性', role: 'admin', expectedMenus: ['dashboard', 'users', 'roles', 'products', 'orders'] },
  { scenario: '销售人员菜单完整性', role: 'sales', expectedMenus: ['dashboard', 'customers', 'opportunities'] },
  { scenario: '渠道人员菜单完整性', role: 'partner', expectedMenus: ['dashboard', 'my_customers', 'my_opportunities'] },
  { scenario: '菜单权限校验', role: 'sales', forbiddenMenu: 'users', expect: '403' },
  { scenario: '菜单跳转功能', menu: 'products', expect: 'page_load' },
  { scenario: '404页面处理', path: '/nonexistent', expect: '404_page' },
  { scenario: '面包屑导航', page: 'products', expect: 'breadcrumb_visible' }
];
```

**3. CRUD 闭环（7+ 用例/模块）**
```typescript
// CRUD测试模板
const CRUD_TEST_TEMPLATE = {
  // 创建
  create: {
    success: '表单填写完整 → 提交 → 成功 → 列表可见',
    validation_error: '必填字段为空 → 提交 → 显示验证错误',
    duplicate: '重复数据提交 → 显示唯一性错误'
  },
  
  // 读取
  read: {
    list: '列表页加载 → 分页 → 搜索 → 筛选',
    detail: '点击列表项 → 详情页加载 → 数据完整'
  },
  
  // 更新
  update: {
    success: '编辑表单 → 修改数据 → 提交成功 → 列表更新',
    cancel: '编辑表单 → 取消 → 数据不变',
    validation_error: '编辑 → 清空必填字段 → 提交 → 显示错误'
  },
  
  // 删除
  delete: {
    success: '点击删除 → 确认 → 成功 → 列表更新',
    cancel: '点击删除 → 取消 → 数据不变',
    undo: '删除后 → 撤销删除 → 数据恢复'
  }
};
```

#### 4.6.3 全流程深度测试

| 角色 | 必测全流程 | 最少用例 |
|------|-----------|:------:|
| 管理员 | 登录 → 查看统计 → 创建角色 → 创建账号 → 审核商机(通过+驳回+撤销) → 商机调配 → 查看汇总 | 8 |
| 销售人员 | 登录 → 创建渠道 → 创建客户(关联渠道) → 创建商机 → 查看我的商机 → 商机跟进 → 查看汇总 | 7 |
| 渠道人员 | 登录 → 创建客户 → 报备商机 → 查看商机列表 → 查看商机状态 → 验证数据隔离 | 6 |

#### 4.6.4 账号准备自修复模式

```typescript
// 账号准备自修复函数
export async function ensureAccountReady(request, phone, entry) {
  // 尝试 1: 直接登录
  let resp = await request.post(`${API}/auth/login`, { 
    data: { phone, password: '123456', entryType: entry } 
  });
  
  // 尝试 2: 密码被改 → 自动重置
  if (!resp.token) {
    await request.post(`${API}/auth/forgot-password`, { data: { phone } });
    resp = await request.post(`${API}/auth/login`, {
      data: { phone, password: '123456', entryType: entry }
    });
  }
  
  // 尝试 3: 仍失败 → 抛出明确错误
  if (!resp.token) {
    throw new Error(`Login failed for ${phone}`);
  }
  
  // 处理后 firstLogin
  if (resp.firstLogin) {
    await request.post(`${API}/auth/change-password`, {
      data: { oldPassword: '123456', newPassword: 'newPassword123' }
    });
  }
  
  return resp;
}
```

#### 4.6.5 E2E测试文件组织

```
tests/e2e/
├── helpers.ts              # 共享辅助函数（账号准备、登录、导航）
├── auth.spec.ts            # 登录认证（每角色 + 错误路径 + 改密）
├── dashboard-navigation.spec.ts  # 首页 + 导航 + 布局
├── roles-accounts.spec.ts  # 角色管理 + 账号管理
├── channels.spec.ts        # 渠道管理
├── customers.spec.ts       # 客户管理
├── opportunities.spec.ts   # 商机管理（最复杂，用例最多）
├── workflows-internal.spec.ts  # 内部全流程（管理员+销售）
└── workflows-partner.spec.ts   # 合作伙伴全流程（渠道人员）
```

#### 4.6.6 E2E门禁检查清单

```markdown
# E2E 门禁检查清单

## 覆盖率检查
- [ ] 总用例数 ≥ 70（全量模式）
- [ ] 登录流程 ≥ 12 用例
- [ ] 菜单导航 ≥ 5 用例
- [ ] 每个模块 CRUD ≥ 7 用例
- [ ] 工作流测试 ≥ 21 用例（管理员8+销售7+渠道6）

## 质量检查
- [ ] 每个API端点至少1个Happy Path + 1个Error Path
- [ ] 每个角色至少1个权限校验用例
- [ ] 每个表单至少1个空字段提交 + 1个正常提交
- [ ] 状态机每个状态转换至少1个用例
- [ ] 数据隔离至少1个跨角色验证用例

## 执行检查
- [ ] ensureAccountReady 函数正常工作
- [ ] 测试数据隔离（beforeAll重置）
- [ ] 失败测试自动截图
- [ ] 无flaky tests（连续3次通过）
```

---

## 五、角色与 Agent 映射

| 角色 | Agent 数量 | 并行度 | 关键产出 | 所属阶段 | 预期耗时 | 质量门禁 |
|------|-----------|--------|---------|---------|---------|---------|
| 产品经理 | 1 | 串行 | PRD（MECE 完整） | Stage1 | 1-2h | PRD MECE 检查 + 6项质量门禁通过 |
| 架构专家（①） | 1 | 串行 | `spec.md`, `schema.sql`, `api-contract.yaml` | Stage2 | 30-60min | Schema 无冗余字段，接口覆盖率 100%，↺循环通过 |
| 业务领域专家（②） | 1 | 串行 | `task.md`, `<module>.md` | Stage2 | 20-60min | 模块边界清晰，验收标准完整，↺循环通过 |
| 拷问审查（↺） | 1 | 串行循环 | 审查报告 | Stage2 | 10-60min | 4个审查维度全部通过 |
| Mock 服务专家（③a） | 1 | 与 ③b-1/③b-2 并行 | `mocks/` | Stage2 | 30-60min | 覆盖全部接口 happy path |
| 单模块测试专家（③b-1） | 最多 2（内部并行） | 与 ③a/③b-2 并行 | `integration-tests/modules/` | Stage2 | 1-2h | 验收标准覆盖率 100% |
| 业务条线测试专家（③b-2） | 1 | 与 ③a/③b-1 并行 | `integration-tests/scenarios/` | Stage2 | 1-2h | PRD 主流程全覆盖 |
| 测试用例审查（③c） | 1 | ③a/③b完成后串行 | 审查报告 | Stage2 | 15-30min | 无ERROR级别问题 |
| Pipeline Coordinator | 1 | Stage3 按轮次调度 | 每轮分配指令 | Stage3 | — | 无遗漏、无重复、无死锁 |
| Stage4 Coordinator | 1（可复用） | Stage4 串行编排 | 联调问题分发 | Stage4 | — | 所有门禁通过 |
| 后端开发 | 最多 3 个 | 按模块批次 | 各模块代码 + 单元测试 | Stage3 | 2-4h/模块 | 单元测试覆盖率 ≥80%，R-G-R 全通过，Code Review P0清零 |
| 前端开发 | 最多 3 个 | 按页面批次 | 页面 + 组件 + Mock 对接 | Stage3 | 2-3h/页面 | FT1+FT2全部通过，联调无阻塞问题 |
| 测试补充 | 1 | 事件驱动 | 边界用例 | Stage3 | 视触发频率 | 补充用例有效 |
| Code Review | 1（独立） | 按需触发 | Review 意见 | Stage3 | 15-30min | P0问题清零，P1≤2 |
| Debug 修复 | 1（独立） | 按需触发 | Bug 修复 + 回归测试 | Stage4 | 视复杂度 | 回归测试通过 |
| 复盘 Agent | 1 | 串行 | `retrospective.md` | Stage5 | 30-60min | 模式/反模式提取完整 |

> 注：产品经理角色可复用为同一 Agent 实例。

### 白皮书Agent角色到Skill文件映射

| 白皮书Agent角色 | Skill文件路径 | 核心职责 |
|--------------|-------------|---------|
| 产品经理 | `.qoder/skills/kf-mvp-product-manager/SKILL.md` | 需求分析、PRD生成 |
| 架构专家（①） | `.qoder/skills/kf-mvp-arch-expert/SKILL.md` | 技术选型、Schema设计 |
| 业务领域专家（②） | `.qoder/skills/kf-mvp-biz-expert/SKILL.md` | 模块划分、边界定义 |
| 拷问审查（↺） | `.qoder/skills/grill-with-docs/SKILL.md` | 交叉验证 |
| Mock服务专家（③a） | `.qoder/skills/kf-mvp-mock-service/SKILL.md` | Mock服务搭建 |
| 单模块测试专家（③b-1） | `.qoder/skills/kf-mvp-test-single/SKILL.md` | 单模块API测试 |
| 业务条线测试专家（③b-2） | `.qoder/skills/kf-mvp-test-e2e/SKILL.md` | 端到端场景测试 |
| Pipeline Coordinator | `.qoder/skills/kf-pipeline-coordinator/SKILL.md` | 任务调度、依赖管理 |
| 后端TDD Agent | `.qoder/skills/kf-mvp-backend-tdd/SKILL.md` | TDD开发 |
| 前端Agent | `.qoder/skills/kf-mvp-frontend-dev/SKILL.md` | Vue开发、Mock对接 |
| Code Review Agent | `.qoder/skills/kf-mvp-code-review/SKILL.md` | 代码审查 |
| Debug Agent | `.qoder/skills/kf-mvp-debug/SKILL.md` | Bug定位、修复 |

> 每个Agent创建时，必须从对应的Skill文件读取完整的system prompt配置。Skill文件是Agent创建的**唯一来源**。

---

## 六、关键决策原则

### 6.1 什么时候必须串行？

1. **PRD 未锁定前**：所有 Stage2 Agent 必须等待产品经理完成 PRD
2. **↺ 拷问审查循环未通过前**：Mock、TDD、场景测试等所有并行子角色必须等待循环通过、产出物锁定
3. **模块间强依赖**：如订单依赖用户，用户模块必须先完成（由 Pipeline Coordinator 按依赖图调度）
4. **接口契约变更**：一旦变更，所有依赖该接口的 Agent 必须同步
5. **集成测试阶段**：必须等前后端都完成后才能开始

### 6.2 什么时候可以并行？

1. **③a Mock、③b-1 单模块测试、③b-2 业务条线测试**：↺ 拷问循环通过后三者同时启动
2. **③b-1 内部**：最多 2 Agent 按模块平分并行写单模块测试
3. **无依赖模块的后端开发**：用户管理 vs 类目管理可同时开发（Pipeline Coordinator 调度）
4. **前端 vs 后端**：Mock 就绪后前端即可并行开发，无需等待后端
5. **Stage3 测试补充**：事件驱动，与后端开发同步

### 6.3 人类决策点完整清单

| 决策点 | 触发条件 | 决策内容 | 决策时限 | 离线自动策略 |
|--------|---------|---------|---------|-------------|
| PRD评审 | Stage1完成 | PRD是否通过评审 | 无时限 | **不自动通过**，挂起 |
| ↺循环未决 | 3轮未通过 | 采纳推荐方案或自定义 | 24h | 自动采纳grill推荐方案 |
| 单模块反复失败 | 同一模块重试3次仍失败 | 跳过/降低标准/等待 | 4h | 跳过模块，标记WARNING |
| 联调发现架构问题 | 接口不匹配>5个 | 修正契约/实现/边界 | 1h | 记录问题，继续其他模块 |
| Schema变更 | 锁定后需要变更 | 批准/驳回 | 4h | **永不自动批准** |
| BLOCKED超时 | 标记后2h无人处理 | 降级/跳过/等待 | 2h | 降级分配，跳过阻塞链 |

### 6.4 Agent 异常处理原则

| 异常类型 | 判定条件 | 处理路径 |
|---------|---------|---------|
| 质量不达标 | 产出物经 Review 后仍不满足锁定标准 | 触发 Review Agent 介入 → 仍不达标则降级为人类接管 |
| 上下文耗尽 | Agent 上下文窗口使用超过 70% | 将当前工作摘要写入 `<agent>.context.md` → 销毁旧实例 → spawn 新实例 → 新实例读取摘要 + 相关锁定版产物 → 继续工作 |
| 写入冲突 | 多个 Agent 同时操作同一文件 | 文件锁机制：`WIP-<module>` 标记文件。写入前检查是否存在 `WIP` 标记，存在则等待 |
| 开发失败 | TDD 循环超过 5 轮仍无法 Green 或 Code Review 打回超过 3 轮 | 标记模块为 `BLOCKED` + 失败原因 → Pipeline Coordinator 降级为「人类开发」→ 其他无依赖模块继续并行 |

**上下文摘要格式**：
```markdown
# Agent 上下文摘要
- 角色: Backend-1
- 当前模块: user
- 已完成: 路由定义、Service 实现、5/12 测试通过
- 待完成: 7 个测试用例、Code Review
- 关键决策: 使用 bcrypt 而非 argon2（性能考量）
```

**Stage边界上下文重置**：
- 每个Stage结束 → 当前Agent输出写入文件系统 → 下一Stage Agent为新spawn实例（上下文归零）
- 例外：Coordinator跨Stage复用时，每轮调度前执行上下文精简（保留当前状态+分配日志，丢弃已完成模块的调试信息）
- Long-running Agent上下文超80%窗口 → 记录WARNING → 下一可用边界强制重置

---

## 七、流程图

```
Stage1: 需求对齐（串行）
    └── 产品经理 Agent → PRD（MECE 完整，锁定）
    ↓
Stage2: 计划（① → ② → ↺ 循环 → ③a ∥ ③b-1 ∥ ③b-2 → ③c）
    ├── ① 架构专家 → spec.md + schema.sql + api-contract.yaml
    ├── ② 业务领域专家 → task.md + <module>.md（输入含 PRD）
    ├── ↺ 拷问审查（grill-with-docs 交叉校验 ① ↔ ②，不一致则修正重跑）
    │       ↓ 通过，产出物锁定
    ├── ③a Mock 服务 → mocks/
    ├── ③b-1 单模块 API 测试（内部最多 2 Agent 并行）
    └── ③b-2 业务条线端到端测试（单 Agent）
    ③a、③b-1、③b-2 三者并行
    ↓
    ③c 测试用例静态审查（串行收尾）
    ↓
Stage3: 执行（大规模并行，有上限）
    ├── Pipeline Coordinator → 依赖图 + 专家匹配 分批调度（含自检三检）
    ├── 后端团队 → 模块 TDD（最多 3 Agent，Red-Green-Refactor，含Review流转+打回上限）
    ├── 前端团队 → 页面开发（最多 3 Agent，基于 Mock + 三层测试）
    └── 测试团队 → 事件驱动补充边界用例
    ↓
Stage4: 集成（串行收敛）
    ├── Stage4 Coordinator 编排
    ├── 后端合并 + Migration执行 + 单元测试全量通过
    ├── 前后端联调（按模块切换策略）
    ├── 集成测试执行（modules/ + scenarios/，含通过率阈值）
    └── Bug 修复循环（Debug 专家，含终止条件）
    ↓
Stage5: 流程复盘与经验沉淀
    ├── 流程健康度评分
    ├── 异常模式识别
    ├── 模式/反模式提取
    └── 白皮书修订提案
    ↓
交付 + 知识库更新
```

---

## 八、产物清单

| 阶段 | 产物 | 负责人 |
|------|------|--------|
| Stage1 | PRD（MECE 完整） | 产品经理 Agent |
| Stage2 | `spec.md` | 架构专家 |
| Stage2 | `schema.sql` / Drizzle Schema | 架构专家 |
| Stage2 | `api-contract.yaml` | 架构专家 |
| Stage2 | `task.md` | 业务领域专家（②） |
| Stage2 | `<module>.md` (N 个) | 业务领域专家（②） |
| Stage2 | `mocks/` | Mock 服务专家（③a） |
| Stage2 | `integration-tests/modules/` | 单模块测试专家（③b-1） |
| Stage2 | `integration-tests/scenarios/` | 业务条线测试专家（③b-2） |
| Stage2 | 测试用例审查报告 | 审查Agent（③c） |
| Stage3 | `src/modules/<module>/` | 后端 Agent |
| Stage3 | `src/views/`, `src/components/` | 前端 Agent |
| Stage3 | 单元测试文件 (`*.test.ts`) | 后端 Agent |
| Stage3 | 前端组件测试 (`*.test.ts`) | 前端 Agent |
| Stage4 | 集成测试报告 | 测试团队 |
| Stage4 | Bug 修复记录 + 根因分类 | Debug 专家 |
| Stage4 | `delivery/` 归档包 | 集成团队 |
| Stage5 | `retrospective.md` | 复盘 Agent |
| 跨项目 | `pipeline-state.json` | Coordinator |
| 跨项目 | `pipeline-metrics.json` | Coordinator（自动采集） |
| 跨项目 | `pipeline-execution-log.md` | Coordinator（全程记录） |

---

## 九、Agent 间通信协议

### 9.1 通信原则

本文档描述的 Agent 协作采用**文件驱动、单协调者**模式：

- **文件驱动**：所有 Agent 通过读写约定目录下的文件进行协作，不依赖 Agent 间直接消息通信
- **单协调者**：每个阶段的协调角色是唯一的调度中枢，各工作 Agent 之间不直接通信
- **状态即文件**：Agent 的产出物本身就是状态信号——文件出现 / 更新 = 状态变更，Coordinator 扫描文件系统即可获得全局一致性视图
- **人类交互唯一入口**：所有需要人类决策的场景均由当前阶段的协调者汇总后统一提交，执行 Agent 不直接与人类交互

### 9.2 各阶段通信实现

| 阶段 | 协调者 | 被协调者 | 通信方式 |
|------|--------|---------|---------|
| Stage2 ↺ 拷问审查 | grill-with-docs Skill | ① 架构、② 业务 | grill 读取双方产出文件 → 写入审查报告 → ①/② 读取修正 → grill 重新校验 |
| Stage3 模块分配 | Pipeline Coordinator | Backend / Frontend | Coordinator 写分配指令 → Agent spawn 时读入 → Agent 完成写 DONE 标记 → Coordinator 扫描确认 |
| Stage3 Code Review | Review Agent | Backend Agent | Review 读取模块代码文件 + 契约文件 → 写 Review 意见 → Backend 读取修正 |
| Stage4 Bug 修复 | Stage4 Coordinator | Debug 专家 | 测试报告文件 → Debug Agent spawn 时读入 → 修复后更新文件 |

### 9.3 文件状态约定

| Agent 状态 | 文件标记 | Coordinator 动作 |
|-----------|---------|------------------|
| 就绪待分配 | 模块目录不存在 | 下一轮扫描时分配 |
| 已分配 | 模块目录已创建，无 `DONE` 标记 | 等待，不重复分配 |
| 已完成 | 模块目录下存在 `DONE` 标记文件 | 释放下游依赖模块 |
| 异常 / 阻塞 | 模块目录下存在 `BLOCKED` 标记文件 + 原因 | 读取原因，决定降级或等待 |
| 部分交付 / 推迟 | 模块目录下存在 `DEFER` 标记文件 + `reason.md` | 级联DEFER下游依赖模块，其余模块继续执行 |

**DEFER 状态**（主动推迟，不同于被动BLOCKED）：

触发条件：
- 模块经2轮重新分配仍未完成（复杂度超出预期）
- 或依赖的外部服务/接口无法就绪
- 或需求存在争议需长周期讨论

处理流程：
1. Coordinator标记该模块为DEFER（`DEFER`标记文件 + `reason.md`）
2. 依赖该模块的下游模块级联标记为DEFER
3. 其余模块继续执行，不受影响
4. DEFER模块进入下一迭代的Backlog，本轮交付标注"部分交付"

> BLOCKED是被动等待（等待依赖/修复），DEFER是主动推迟（无法/不值得本轮完成）。两者互斥：一个模块不能同时为BLOCKED和DEFER。

**DONE 标记文件标准内容**：
```markdown
<!-- DONE 标记文件示例: src/modules/user/DONE -->
# 模块完成标记
- 模块: user
- 完成时间: 2026-05-21T14:30:00Z
- 负责 Agent: Backend-1
- 单元测试: 12/12 通过
- Code Review: 通过（review-user.md v1）
- 依赖模块: 无
```

**原子性保证**：
> 标记文件写入采用「先写临时文件再重命名」策略：`DONE.tmp` → 原子重命名为 `DONE`。Coordinator 只识别不以 `.tmp` 结尾的标记文件。

> **为什么不用消息通信**：消息通信引入时序依赖。文件状态是幂等的——Coordinator 随时扫描文件系统即可获得全局一致性视图。

### 9.4 Coordinator状态持久化

Coordinator维护 `pipeline-state.json`，每次状态变更原子写入（先写临时文件→重命名）：

```json
{
  "pipeline_id": "uuid",
  "stage": "Stage3",
  "current_round": 2,
  "agent_slots": {
    "backend": [],
    "frontend": []
  },
  "module_states": {},
  "last_checkpoint": "2026-05-21T10:30:00Z"
}
```

Coordinator崩溃后重启读取该文件恢复状态，差异以文件系统为准（ground truth）。如状态文件损坏 → 退化到全量扫描。

### 9.5 Agent间知识共享协议

**共享上下文**（每个Agent的system prompt必须包含）：

| 类别 | 内容 | 来源 |
|------|------|------|
| 项目目标 | PRD「项目背景」章节摘要（≤200字） | PRD.md |
| 技术栈约束 | 完整技术栈清单 | mvp-tech-stack-default.md |
| 当前阶段 | 所在Stage、角色、门禁条件 | 白皮书对应章节 |
| 契约文件路径 | api-contract.yaml、schema.sql绝对路径 | Coordinator分配时提供 |
| 前置产出物 | 当前模块依赖的其他模块接口摘要 | <module>.md依赖清单 |
| 文件约定 | 产出物目录结构、命名规范 | 白皮书第八/九章 |

**产物依赖声明**：每个产出物文件头增加 `依赖:` 字段：
```
依赖: PRD.md, spec.locked.md, schema.locked.sql
```
> Coordinator启动时解析全部依赖图，发现缺失依赖 → 阻止进入下一阶段。

**禁止共享**：其他Agent的实现代码（只通过API契约交互）、其他Agent的测试数据、未锁定的产出物、人类对话历史。

---

## 十、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| PRD不完整或模糊 | 中 | 后续全返工 | Stage1 MECE评审 + 质量门禁 |
| Schema中途变更 | 中 | 受影响模块返工 | Stage2严格锁定 + 变更评审 |
| ↺循环超3轮 | 低 | 进入人类降级 | 自动裁决作为兜底 |
| 模块间接口不匹配 | 高 | 集成失败 | Code Review + Mock前置验证 |
| Mock与真实API不一致 | 中 | 前端联调返工 | Mock持续验证 + 同步协议 |
| 隐式依赖遗漏→死锁 | 低 | 调度阻塞 | 依赖图自动校验 |
| 模块间数据竞争 | 低-中 | 数据不一致 | 领域DONE后自动扫描 |
| 上下文窗口溢出 | 中 | Agent质量下降 | 单Agent单实例 + prompt ≤500 tokens |
| Coordinator崩溃 | 低 | Stage3全停 | 状态持久化+恢复协议 |
| Agent崩溃 | 低 | 单模块阻塞 | 失败恢复模型（见§11.1） |
| 人类不在线阻塞决策 | 中 | 流程挂起 | 自动降级矩阵（见§6.3） |
| Bug修复引入新问题 | 中 | 回归失败 | 每次修复补充回归测试 |

---

## 十一、Agent失败恢复

### 11.1 失败分类与恢复策略

| 失败类型 | 判定依据 | 恢复动作 | Coordinator行为 |
|---------|---------|---------|----------------|
| 超时未响应 | spawn后N分钟无产出 | 重试（最多2次） | 标记「待重试」，释放Slot |
| 产出不合格 | CR发现≥3个P0问题 | 打回→修正→重新Review | 模块保持「已分配」 |
| 产出严重偏离 | 产出与模块定义完全不符 | 重新spawn新实例 | 废弃旧产出，回「未分配」 |
| Agent崩溃 | 心跳超时(60s) | 重启，从checkpoint恢复 | 模块保持「已分配」，等待重启 |
| 死循环 | 重复同类错误≥3次 | 终止→升级人类 | 标记BLOCKED(human_decision) |

### 11.2 Agent心跳机制

每个Agent启动时创建 `agent-heartbeat.yaml`：
```yaml
agent_id: "backend-1"
module: "user"
started_at: "2026-05-20T10:00:00Z"
last_ping: "2026-05-20T10:05:00Z"
status: "ALIVE"  # ALIVE / DEAD / COMPLETED
```
Coordinator每30秒扫描心跳文件，超时60秒判定Agent崩溃。

**Agent执行时限参考**（超时分级：WARNING=80% / ESCALATE=120% / TERMINATE=200%）：

| Agent角色 | 建议时限 | 说明 |
|----------|---------|------|
| PM Agent | 120min | PRD复杂度差异大 |
| 架构专家 | 60min | Schema+契约一次性输出 |
| 业务领域专家 | 60min | 按PRD复杂度分级 |
| Mock专家 | 60min | 全量Mock一次性搭建 |
| 单模块测试 | 120min | 按模块数分摊 |
| Backend Agent | 30min/模块 | 超2倍→Coordinator标记STUCK |
| Frontend Agent | 30min/页面 | 同上 |
| Code Review | 15min | 超过→超时降级为快速审查 |
| Coordinator | 持续运行 | 不设时限，靠检查点恢复 |

> 超时后Agent仍可继续完成当前工作并输出，但Coordinator同步启动备用方案（如重新分配、标记STUCK）。

### 11.3 BLOCKED标记生命周期

```
Agent标记 BLOCKED → Coordinator扫描发现
    ↓
判断阻塞类型：
  ├── 依赖未就绪 → 等待依赖DONE → 自动解除
  ├── 契约问题 → 走变更申请流程
  ├── Agent自身问题 → 重试协议（§11.1）
  └── 未知/其他 → 升级人类
    ↓
超时2h（见§6.3降级矩阵）：
  ├── 可降级 → 跳过模块，标记WARNING
  └── 不可降级 → 等待人类决策
    ↓
阻塞解除：删除BLOCKED → 模块回「未分配」→ 重新调度
```

---

## 十二、质量度量与持续改进

### 12.1 核心质量指标（每项目自动采集）

Coordinator在Stage4完成后自动采集到 `pipeline-metrics.json`：

| 指标 | 计算方式 | 目标值 | 告警值 |
|------|---------|--------|--------|
| **Grill首次通过率** | ↺第1轮通过的维度数 / 4 | ≥ 75% | < 50% |
| **Grill收敛速度** | 通过所有维度所需轮次 | ≤ 2轮 | ≥ 3轮 |
| **首次CR通过率** | 一次Review通过的模块数 / 总模块数 | ≥ 70% | < 40% |
| **P0问题密度** | P0总数 / 模块数 | ≤ 1/模块 | ≥ 3/模块 |
| **Bug逃逸率** | Stage4发现的Bug / 全流程Bug总数 | ≤ 20% | ≥ 50% |
| **并行度利用率** | 实际并行Agent数 / 最大并行Agent数 | ≥ 80% | < 50% |
| **E2E覆盖率** | E2E用例数 / 最低标准(70+) | ≥ 100% | < 80% |
| **登录流程覆盖** | 登录用例数 / 最低标准(12) | ≥ 100% | < 90% |
| **菜单导航覆盖** | 菜单用例数 / 最低标准(5) | ≥ 100% | < 80% |
| **CRUD闭环覆盖** | 模块CRUD用例数 / 最低标准(7/模块) | ≥ 100% | < 70% |
| **工作流覆盖** | 工作流用例数 / 最低标准(21) | ≥ 100% | < 85% |
| **MSVP通过率** | A类Bug数 / 总检查项 | 0 A类Bug | 任何A类Bug |
| **增量测试反馈时间** | 模块DONE到测试完成的时间 | ≤ 30秒 | > 2分钟 |
| **契约一致性** | 通过契约检查的模块数 / 总模块数 | 100% | < 90% |
| **跨模块调用合规** | 通过跨模块检查的模块数 / 总模块数 | 100% | < 85% |

### 12.2 错误根因分类

每个Bug修复时标注根因类型：

| 一级分类 | 二级分类 | 示例 | 标记 |
|---------|---------|------|------|
| **需求层面** | PRD歧义/遗漏/矛盾 | 同一术语两种理解 | `CAUSE:PRD_*` |
| **设计层面** | 契约设计不合理/Schema缺陷/模块边界错误 | 接口粒度太粗 | `CAUSE:DESIGN_*` |
| **实现层面** | 逻辑错误/契约不一致/测试不足 | 条件判断写反 | `CAUSE:IMPL_*` |

**反馈规则**：某分类连续2个项目占比 > 阈值 → 触发该阶段的流程增强。

### 12.3 项目后自动回溯（L1）

每个项目Stage4完成后，Coordinator自动生成回溯报告（`retro-<project>.md`），包含：质量概览、过程瓶颈识别、根因分布统计、自动改进建议。某分类占比超阈值时，自动建议对应的流程改进措施。

### 12.4 渐进式质量门禁

门禁标准随项目代际自动收紧：

| 项目代际 | Grill首次通过率 | 首次CR通过率 | P0密度上限 | Bug逃逸率上限 |
|---------|---------------|-------------|-----------|-------------|
| 第1-2个项目（探索期） | ≥ 50% | ≥ 50% | ≤ 3/模块 | ≤ 30% |
| 第3-5个项目（稳定期） | ≥ 75% | ≥ 70% | ≤ 1/模块 | ≤ 20% |
| 第6+个项目（成熟期） | ≥ 90% | ≥ 85% | ≤ 0.5/模块 | ≤ 10% |

连续2个项目达到当前代际所有指标目标 → 自动升级到下一代标准。连续2个项目不达标 → 触发深度回溯（需人类参与），不降低标准。

### 12.5 方法论版本管理

白皮书采用语义版本号（`vX.Y.Z`）：
- 大版本（X+1）：新增章节/重大流程变更
- 次版本（Y+1）：新增子流程/新增门禁
- 补丁（Z+1）：措辞修正/示例补充

所有配套Skill和Agent prompt模板需在头部声明 `@based_on: QoderMVP白皮书 vX.Y.Z`。

---

## 十三、Stage5：流程复盘与经验沉淀（串行，1 个 Agent）

**定位**：不是产品复盘，而是**流程本身的复盘**——审视多 Agent 并行开发流程的执行效果，提取可复用的模式与反模式。

**输入**：
- `pipeline-execution-log.md`（完整执行记录）
- `pipeline-metrics.json`（Stage4 自动采集的质量指标）
- 各阶段实际耗时 vs 预期耗时
- 审查报告历史（grill-with-docs 各轮次输出）
- Bug 清单（分类：需求理解偏差 / 契约不一致 / 实现缺陷）

**输出**：`retrospective.md` + 可选的「白皮书修订提案」

**retrospective.md 必须包含**：
1. 流程健康度评分（各 Stage 实际耗时 / 预期耗时 的比值）
2. Agent 效率分析（各角色产出质量、返工率）
3. 契约偏差分析（spec.md 与实际实现的差异点）
4. 模式提取（本次迭代验证有效的实践）
5. 反模式记录（本次迭代暴露的流程缺陷）
6. 白皮书修订建议（具体条款 + 修订理由）

### 13.1 异常模式识别清单

**检查项**：
- [ ] 是否有模块实际耗时 > 预期 2 倍？→ 标记为「高风险模块类型」
- [ ] 是否有 Agent 角色 Code Review 打回率 > 30%？→ 标记为「需强化该角色 Skill」
- [ ] 是否有阶段实际耗时 > 预期 1.5 倍？→ 标记为「瓶颈阶段」
- [ ] Bug 分类中某类占比 > 40%？→ 标记为「系统性缺陷来源」

**模式响应**：

| 异常模式 | 自动响应 |
|---------|---------|
| 某类模块总是超时 | 下轮迭代拆分更细，或分配更强 Agent |
| 某 Agent 角色打回率高 | 检查该角色 Skill 是否需要更新 |
| 瓶颈阶段 | 增加该阶段的并行度或简化流程 |
| 系统性缺陷来源 | 在对应阶段增加专项检查 |

> Stage5 的复盘与 §12.3 的 L1 自动回溯互补：L1 自动生成数据报告（定量），Stage5 由复盘 Agent 进行深度定性分析，并决定是否将经验纳入 §14 经验知识库。

---

## 十四、经验知识库（持续更新）

> 本章节记录从实际迭代中沉淀的模式、反模式和最佳实践。每次迭代完成后，由 Stage5 复盘 Agent 评估是否将新经验纳入本章节。

### 14.1 已验证模式（Do）

| 模式 | 来源迭代 | 说明 |
|------|---------|------|
| 5层测试覆盖 | 迭代1 | L1单元+L2 API+L3数据库+L4有头浏览器+L5无头CI |
| 测试数据工厂 | 迭代15 | 统一 TestFactory，自增ID避免冲突 |
| 有头/无头差异对照 | 迭代1 | 3种常见问题及解决方案 |
| Stage3 门禁强化 | 迭代18 | 强制 L1-L5 全部通过 |

### 14.2 已识别反模式（Don't）

| 反模式 | 来源迭代 | 后果 | 规避方法 |
|--------|---------|------|---------|
| 测试断言太弱 | 迭代1 | "not null" 而非检查具体值，漏检bug | 强制检查具体值 |
| hardcoded ID | 迭代15 | 测试数据冲突 | 使用 TestFactory 自增ID |
| 有头/无头配置混乱 | 迭代1 | CI通过但人工测试失败 | 分离配置，强制对比 |
| Stage3 门禁过松 | 迭代18 | 有头/无头测试未强制 | 门禁强制 L1-L5 |

### 14.3 待验证假设

| 假设 | 提出迭代 | 验证状态 |
|------|---------|---------|
| 业务专家串行优于并行 | 初始 | ✅ 已验证（20轮迭代未改变） |
| 3 Agent 硬上限最优 | 初始 | ⚠️ 待验证（未测试 4 Agent 场景） |
| grill-with-docs 3轮上限合理 | 初始 | ⚠️ 待验证（实际平均 1.5 轮，但样本不足） |
| 模块粒度 5-15 接口最优 | v2.1 | ⚠️ 待验证（需更多迭代数据） |

---

*本文档为 QoderMVP 项目多 Agent 并行开发的执行标准，所有 Agent 必须遵循。*

---

## 附录：项目基础设施（v2.6 新增）

### A.1 平台与技能体系

| 项目 | 说明 |
|------|------|
| 开发平台 | **Qoder**（唯一平台，已移除 Claude Code / Trae 支持） |
| 技能路径 | `.qoder/skills/`（43 个技能，覆盖 Stage1-5 全流程） |
| 项目配置 | `.qoder/settings.json`（模型路由、规则注入、环境变量） |
| Hook 机制 | `~/.qoder/hooks/` 下 `.cmd` 脚本（自动触发 Token 监控） |

### A.2 ultra-cost-effective 极致节能引擎

七层 Token 节省架构，综合节省 60-90%，不影响输出质量：

| 层 | 名称 | 机制 |
|----|------|------|
| L1 | 输出压缩 | tokenforge PreToolUse Hook 管道注入 |
| L2 | KV Cache | DeepSeek 共享前缀缓存，命中率 >90% |
| L3 | 上下文预热 | PRD/Spec 长文档触发 KV Cache checkpoint |
| L4 | 技能按需加载 | 非活跃技能 → ~25 token stub |
| L5 | 阶段智能跳过 | 变更检测驱动，小变更跳过不必要阶段 |
| L6 | A2A 通信压缩 | agent-spawn-guard 注入 session-memory 索引 |
| L7 | 模型智能路由 | DeepSeek Pro↔Flash 按需切换（3x 成本差） |

### A.3 项目级全链路 Token 监控

`ultra-cost-effective/helpers/project-monitor.cjs` 提供三维度追踪：

| 维度 | 内容 |
|------|------|
| **主会话** | JSONL 扫描，统计每次 LLM 调用的输入/输出 Token |
| **A2A 通信** | 检测 Agent 工具调用次数 + Prompt/Response Token 估算 |
| **子Agent 穿透** | 扫描子 Agent JSONL 会话，聚合 Token 消耗 |
| **理论节约** | 按 L1-L7 分别计算若全开可节省的 Token + 成本 |
| **成本估算** | 基于 `pricing.json` 动态定价，Flash 实际 vs Pro 无优化对比 |

运行命令：
```bash
node ultra-cost-effective/helpers/project-monitor.cjs          # 全链路报告
node ultra-cost-effective/helpers/project-monitor.cjs --watch  # 实时监控
node ultra-cost-effective/helpers/project-monitor.cjs --json   # JSON 输出
```

### A.4 E2E 测试质量门禁

E2E 质量通过以下自动化门禁保障（逻辑嵌入 `.qoder/skills/all-in-mvp/SKILL.md` Stage3/Stage4 gate）：

| 门禁 | 用途 |
|------|------|
| E2E 覆盖率门禁 | 静态检查 E2E 用例数量是否达标（总计≥70, Login≥12, Menu≥5, CRUD≥7/模块, Workflow≥21, Data Isolation≥1） |
| 有头/无头一致性门禁 | 有头/无头测试结果一致性对比（Type1渲染差异/Type2 CORS差异/Type3弱断言检测） |

> 注：自动化校验脚本 `check-e2e-coverage.js` / `check-e2e-parity.js` 原位于 `scripts/` 目录，v2.6 清理后逻辑已集成至 all-in-mvp SKILL.md 的 CI gate 中。

### A.5 设计哲学（来源：WhyMe.md）

本流程的设计源自对传统研发团队工作流的反思与 AI 时代转型实践：

**传统团队流程**：与客户确定需求 → 待办整理 → 原型制作 → 原型宣讲 → 分头行动 → 集成测试

**AI 辅助转型**：产品不画原型但写 PRD 大纲 → AI 产生与 PRD 高度一致的原型宣讲 → 研发评审 Spec → 研发编码

**激进 AI 驱动模式（本流程目标）**：一人完成设计-开发-测试，不画原型、不直接写代码：

```
orig-requirements → prd → ui-prototype → spec → code → unit test → integration test
```

基于 Spec 按模块拆分给不同 Agent 完成不同模块的开发和测试。

**贯穿始终的核心原则**：
- **PRD、Spec、代码必须保持一致**——人工修改代码后，也必须让 AI 回写 PRD 和 Spec
- **Spec 是唯一的真相来源**（Single Source of Truth），所有 Agent 基于 Spec 并行工作
- **文档驱动开发**（Document-Driven Development）：先冻结文档，再开始编码
