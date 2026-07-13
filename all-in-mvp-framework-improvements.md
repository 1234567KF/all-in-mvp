# all-in-mvp 技能框架改进建议

> **触发 Bug**: Bug#3 账号管理搜索过滤不起效
> **分析日期**: 2026-07-06
> **来源**: WeCRM 项目实战复盘

---

## 一、隐患复盘

### 1.1 Bug 完整链路

```
PRD §3.3.2: "账号列表：展示姓名、手机号、职位…"
  → 未定义搜索/过滤行为（隐含UX需求遗漏）
    → Domain Expert: AC-A1 仅覆盖"获取分页列表"
      → 单元测试: 只测分页，无搜索/过滤用例
        → 后端: paginationSchema 未加 .passthrough()
          → validate 中间件 Zod strip 丢弃 keyword/role_id
            → 搜索静默失效（HTTP 200，前端无报错）
              → Bug#3 修复: 只修表层，未追根到 Zod strip
```

### 1.2 为什么各阶段门禁全部绿灯？

| 阶段 | 门禁项 | 结果 | 为什么没拦住 |
|------|--------|:--:|------------|
| Stage 1 PM | PRD 验收标准 | ✅ | AC-26 只提"账号创建+手机号校验"，未覆盖列表搜索 |
| Stage 2.2 Domain | AC 覆盖率 | ✅ | AC-A1~A7 全部匹配 PRD 功能，但不包含隐含交互 |
| Stage 2.3 Grill | PRD→API 映射 | ✅ | 逐条对照查出 6 项问题，但无法发现 PRD 本身的遗漏 |
| Stage 2.7 Test Review | AC 数量覆盖 | ✅ | 53/53 AC 都有测试文件，但未检查每个 AC 的测试深度 |
| Stage 3 TDD | 单元测试通过 | ✅ | 25 个测试全通过，但无搜索/过滤用例 |
| Stage 3 Code Review | 8 项 checklist | ✅ | 未检查"同类模块中间件一致性" |
| Bug 修复 | 功能修复 | ❌ | 改表层，未执行请求全链路追踪诊断 |

**核心问题**: 每个阶段的门禁都是"向前对照上一阶段产出物"，而不是"向下预见实际运行场景"。当 PRD 遗漏了隐含需求，整个管道无法自愈。

---

## 二、改进方案

### P0 🔴 改进点 7：Stage 4 Bug 修复增加「根因深度诊断协议」

**当前问题**: Bug 修复只处理表层症状，不追踪整个请求链路。

**适用范围**: 所有 P0/P1 级"功能不起效"类 Bug

**诊断协议（五层验证，不可跳过）**:

```
1. 前端层 → DevTools Network 验证请求 URL/Payload 是否正确发出
2. 中间件层 → 验证 validate/auth/guard 是否拦截或修改了请求参数
3. 控制器层 → 验证 controller 收到的 query/body 参数是否完整
4. 服务层 → 验证 SQL 查询是否正确使用了过滤条件
5. 数据库层 → 验证数据本身是否符合查询条件

每层验证通过才能判定"该层无问题"。
连续 2 次修复同一 Bug 仍失败 → 触发人工审查（已有规则）。
```

**Agent prompt 修改位置**: `agents/stage4-coordinator.md` 或 `agents/debug-fixer.md`

---

### P0 🔴 改进点 4：Stage 2.7 Test Review 从「数量覆盖」升级到「深度覆盖」

**当前问题**: Test Review 只检查"文件存在"和"AC 数量"，不检查每个 AC 的测试用例深度。

**示例**: `account-module | 7 AC | 7/7 | ✅` 通过了，但 AC-A1 只有 4 个基础分页测试，没有搜索/过滤测试。

**新增审查维度: AC 测试深度检查**:

对每个列表类端点的 AC，检查是否覆盖以下场景：

| # | 场景 | 示例 | 必选 |
|---|------|------|:--:|
| 1 | 基础分页 | 含默认值、含 role_name | ✅ |
| 2 | 关键词搜索 | 按姓名模糊搜索 | ✅ |
| 3 | 条件过滤 | 按角色/状态/类型过滤 | ✅ |
| 4 | 联合过滤 | 关键词 + 角色同时使用 | ✅ |
| 5 | 空结果 | 无匹配 → 返回空列表 | ✅ |
| 6 | 异常参数 | pageSize 超限 → 400 | ✅ |

**判定标准**:
- 缺失 ≥ 2 项 → **ERROR**（阻塞）
- 缺失 1 项 → **WARNING**（建议修复）

**Agent prompt 修改位置**: `agents/test-review.md`，在"场景覆盖完整性"维度下新增子检查

---

### P1 🟡 改进点 2：Stage 2.2 Domain Expert — AC 增加「列表隐含交互」子项

**当前问题**: Domain Expert 只从 PRD 提取显式 AC。PRD 未提搜索，AC 就没有搜索。

**解决方案**: 在每个 `module.md` 的列表类端点 AC 中，展开隐含交互子 AC。

**模板示例**:

```markdown
### AC-A1: 获取账号分页列表

#### Happy Path
- [ ] A1.1 获取分页列表，包含 role_name
- [ ] A1.2 不传分页参数使用默认值

#### Search & Filter
- [ ] A1.3 按关键词模糊搜索（姓名/手机号）
- [ ] A1.4 按角色ID过滤
- [ ] A1.5 关键词+角色联合过滤
- [ ] A1.6 无匹配返回空列表

#### Exception Path
- [ ] A1.7 pageSize 超过 100 → 400
- [ ] A1.8 非 admin → 403
- [ ] A1.9 无 token → 401
```

**Agent prompt 修改位置**: `agents/domain-expert.md`，在"验收标准"生成规则中增加列表端点展开逻辑

---

### P1 🟡 改进点 1：Stage 1 PM Agent — PRD 增加「列表页交互标准」模板

**当前问题**: PRD 只描述列表展示字段，不描述搜索/过滤/排序/分页行为。

**解决方案**: 在 PM Agent 的 PRD 输出模板中，为列表类功能增加标准交互表：

```markdown
### X.X 功能名称

#### 列表交互（标准列表页需逐一确认）

| 交互能力 | 是否支持 | 规则说明 |
|---------|:------:|---------|
| 分页 | ✅ | 默认 20 条/页，最大 100 条 |
| 关键词搜索 | ✅ | 搜索范围：姓名/手机号，模糊匹配 |
| 角色筛选 | ✅ | 下拉单选，来源角色列表 |
| 状态筛选 | — | 本期不做 |
| 排序 | — | 默认按创建时间倒序 |
```

**Agent prompt 修改位置**: `agents/pm-agent.md`，在 PRD 生成模板的"功能模块"部分增加交互标准表

---

### P1 🟡 改进点 5：Stage 2.7 或 2.3 增加「跨模块一致性检查」

**当前问题**: 4 个模块用了 `.passthrough()`，唯独 account 没加。Grill 和 Test Review 都没发现这种模式不一致。

**解决方案**: 在 Test Review（或 Grill）中增加跨模块模式比较：

```markdown
## 跨模块一致性检查 (Cross-Module Pattern Check)

对同类端点实现模式进行对比，发现不一致即标记：

| 检查项 | channel | customer | opportunity | partner | account | 不一致？ |
|--------|:-----:|:-----:|:-----:|:-----:|:-----:|:------:|
| paginationSchema 是否 passthrough | ✅ | ✅ | ✅ | ✅ | ❌ | **account** |
| 错误消息格式 | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| 分页响应格式 | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| validate 中间件用法 | ✅ | ✅ | ✅ | ✅ | ✅ | — |

> 发现不一致 → ERROR（P0 阻塞）
```

**检查方法**: 正则扫描所有 `router.ts` 中的 `z.object({...})` 定义，对比 `.passthrough()` 使用情况

**Agent prompt 修改位置**: `agents/test-review.md`，作为新增的第 6 个审查维度

---

### P2 🟢 改进点 3：Stage 2.3 Grill Review — 增加「隐含交互完整性」审查维度

**当前问题**: Grill 只逐条对照 PRD → API，无法发现 PRD 本身的遗漏。

**解决方案**: 在 Grill 现有 4 个审查维度基础上增加第 5 个：

```markdown
| 5 | **隐含交互完整性** | 列表页是否缺少搜索/过滤/排序？<br>表单页是否缺少校验规则？<br>详情页是否缺少按钮交互？ | 审查 ①② 双方 |
```

**判断逻辑**:
- 识别所有列表端点 → 检查 PRD 是否定义了搜索/过滤
- 识别所有表单端点 → 检查 PRD 是否定义了校验规则
- 缺失项 → WARNING 级别（非阻塞，但需在 decisions 中记录）

**Agent prompt 修改位置**: `agents/grill-review.md`，在审查维度表中新增一行

---

### P2 🟢 改进点 6：Stage 3 Code Reviewer — Checklist 增加「中间件一致性」项

**当前问题**: Code Reviewer 的 8 项 checklist 未检查路由层 validate schema 完整性。

**解决方案**: 在 Code Reviewer checklist 增加：

```markdown
- [ ] 路由层 `validate(schema, 'query')` 的 schema 是否完整覆盖所有查询参数？
      （检查：有无 `.passthrough()` 或显式声明了 keyword/status/type 等过滤字段？）
- [ ] 与同类模块的实现模式是否一致？
      （检查：paginationSchema 定义模式、错误处理模式、响应包装模式）
```

**Agent prompt 修改位置**: `agents/code-reviewer.md`，在现有 8 项 checklist 末尾追加

---

## 三、优先级矩阵

| # | 改进点 | 影响面 | 实施难度 | 优先级 |
|---|--------|:----:|:----:|:----:|
| P7 | Bug 修复根因诊断协议 | 全部 Bug 修复 | 低（纯流程） | 🔴 P0 |
| P4 | Test Review AC 深度检查 | 所有列表端点 | 中（逻辑增强） | 🔴 P0 |
| P2 | Domain Expert AC 隐含交互展开 | 所有模块 AC | 低（模板修改） | 🟡 P1 |
| P1 | PM PRD 列表交互标准 | PRD 质量 | 低（模板修改） | 🟡 P1 |
| P5 | 跨模块一致性检查 | 模式不一致检测 | 中（新逻辑） | 🟡 P1 |
| P3 | Grill 隐含交互完整性维度 | 审查覆盖增强 | 低（加一行） | 🟢 P2 |
| P6 | Code Review 中间件一致性 | 特定类型端点 | 低（加一条） | 🟢 P2 |

---

## 四、防御层级

改进后形成四层防御：

```
Layer 1: PRD 定义交互标准        → 从源头预防遗漏
Layer 2: AC 展开隐含交互子项      → 测试有据可依
Layer 3: Test Review 深度检查    → 门禁拦截浅测试
Layer 4: Bug 诊断五层验证         → 修复必追根
```

**关键原则**: 不再依赖单一阶段拦截所有问题，而是让每个阶段的产出物质量更高，减少问题流入下游。
