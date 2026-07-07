# 质量宪法 v1.0 — 全量模式 E2E 不可削减底线

> **文件性质**：不可压缩（uncompressable）、不可跳过、不可降级。
> **生效范围**：ALL-IN-MVP 全量模式 / 增量模式。
> **违反后果**：Stage 门禁脚本返回 FAIL → 流水线阻塞。

---

## 宪法条文（6 条）

### 第 1 条：浏览器交互配额
**每个 E2E spec 文件中，使用 `page.fill|click|goto|locator` 的浏览器交互用例 ≥ 总用例数的 30%。**
- 检查脚本：`e2e-quality-gate.ps1 --check browser-ratio`
- 违反判定：任意 spec 文件浏览器交互占比 < 30% → **BLOCKED**

### 第 2 条：权限交叉矩阵
**多角色项目（≥2 角色）必须覆盖角色×端点组的全组合，含预期 403 格。**
- 检查脚本：`e2e-quality-gate.ps1 --check permission-matrix`
- 违反判定：存在角色×端点组合无对应测试用例 → **BLOCKED**

### 第 3 条：状态双向断言
**每次状态机转换必须同时验证：target 列表包含 + source 列表不包含。**
- 检查脚本：`e2e-quality-gate.ps1 --check bidirectional`
- 违反判定：存在 `approve/reject/revoke/reassign` 调用后缺失反向断言 → **BLOCKED**

### 第 4 条：CRUD 生命周期
**每个 CRUD 实体至少覆盖：C(浏览器创建)、R(详情非空)、U(编辑预填)、D(禁用/删除)。**
- 检查脚本：`e2e-quality-gate.ps1 --check crud-lifecycle`
- 违反判定：实体缺失任一生命周期测试 → **BLOCKED**

### 第 5 条：断言质量
**禁止以下断言模式：**
- `expect([200, 403]).toContain(status)` — 模糊状态码
- `expect(resp.status()).toBe(200)` 后无 body 内容断言
- `expect(body.data.list).toBeDefined()` 后不检查 `list.length > 0`
- `try { expect(...) } catch { /* ignore */ }` — 静默吞断言
- 检查脚本：`e2e-quality-gate.ps1 --check assertion-quality`
- 违反判定：命中任意禁止模式 → **BLOCKED**

### 第 6 条：门禁不可绕过
**Stage 2 ③c 和 Stage 4 入口必须运行 `e2e-quality-gate.ps1 --all` 并返回 PASS。**
- 脚本返回非零退出码 → Stage 入口门禁不通过
- 禁止 Agent 以"上下文不足""节能模式压缩"等理由跳过门禁脚本

---

## 幂等性声明

此宪法内容**不受以下因素影响**：
- 会话上下文长度
- 节能模式压缩级别（standard/extreme）
- Agent 中途中断与恢复
- 多 Agent 并行时的上下文隔离

**生效方式**：通过可执行脚本（`.ps1`）而非 LLM 记忆来保证。脚本不依赖 Agent 是否"记得"规则 — 它直接扫描文件系统并返回客观判定。
