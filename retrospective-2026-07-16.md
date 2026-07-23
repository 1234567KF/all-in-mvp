# 全自动CRM 开发复盘报告

**日期**: 2026-07-16
**触发**: 新增账号弹窗职位区域控件显示异常漏修
**严重级别**: 中等 — 单点遗漏，但暴露系统性缺陷

---

## 1. 问题全景

| # | 问题 | 根因 | 修复轮次 | 状态 |
|---|------|------|----------|------|
| 1 | 新增账号弹窗字段名/下拉值不显示 | Radix UI Select Portal 与 Dialog focus trap 冲突 | 1 轮（只修了 Select） | ✅ |
| 1b | 职位下方管理员复选框布局异常 | Field 组件 `*:w-full` 变体强制 Checkbox 拉伸 100% 宽度 | 2 轮（用户点名后才修） | ✅ |
| 2 | 审核商机通过/驳回失败 | 前后端字段名 mismatched (rejectReason/reason, protectEnd/protectDuration) | 前一个会话修复 | ✅ |
| 3 | 审计日志只有登录日志 | ORDER BY ASC 导致种子数据（旧登录日志）排在首页，所有操作日志被淹没 | 1 轮 | ✅ |
| 4 | 知识库无富文本编辑器 | Textarea 替代 PRD 要求的富文本，未集成 TipTap | 1 轮 | ✅ |

---

## 2. 核心遗漏：为什么没发现 Checkbox 异常？

### 2.1 我的分析路径（有问题）

```
1. 用户报告 "新增账号弹窗显有字段名和下拉值不显示"
2. 我读取 AccountPage → 发现 Dialog 内有 Select
3. 认定根因是 Select Portal 与 Dialog focus trap 冲突
4. 实现 usePortal={false} 修复
5. 认为问题解决 → 但实际只解决了 "下拉值不显示" 部分
```

### 2.2 真正的问题链

```
Field 组件 vertical 变体 = "flex-col *:w-full"
                                ^^^^^^^^^
此 CSS 将 Field 所有直接子元素强制 width: 100%

当 Field 用于 Checkbox 行时：
<Field className="flex items-center gap-2">   ← flex 覆盖了 flex-col，但 *:w-full 仍在
  <Checkbox ... />                              ← size-4 被 width:100% 覆盖 → 视觉异常
  <FieldLabel ...>管理员</FieldLabel>            ← 也被强行 stretch
</Field>
```

### 2.3 为什么会漏掉？

| 原因 | 说明 |
|------|------|
| **问题描述解耦不充分** | 用户说 "字段名和下拉值不显示"，我聚焦于 Select 下拉，忽略了 "字段名" 也可能是其他字段 |
| **Fix-one-and-done 心态** | 找到 Select Portal 根因后，未经全面 regress 即关闭问题 |
| **CSS 副作用未穷举** | `*:w-full` 对所有子元素的影响未在 Checkbox 这种非标准表单控件上验证 |
| **缺少可视化验收** | 没有用 Preview 浏览器亲眼检查修复后的弹窗全貌 |

---

## 3. 技能体系诊断（为什么达不到期望效果）

### 3.1 单 Agent 模式下的盲区

当前会话采用单一 Agent 串行修复模式，存在以下结构性缺陷：

| 缺陷 | 表现 | 影响 |
|------|------|------|
| **审查盲区** | 同一 Agent 既写代码又自查，认知偏差不可避免 | 遗漏率 ~25%（4 个问题漏 1 个） |
| **契约验证缺失** | 前后端枚举/字段名不匹配（问题2）直到运行时才发现 | 每次手动修复耗时 10-20 分钟 |
| **CSS 上下文盲区** | Field 组件的 `*:w-full` 是 liquid-glass 脚手架的继承设计，Agent 不熟悉其副作用 | 问题1b 完全靠用户发现 |

### 3.2 kf-* Skill 体系未发挥作用

项目中存在完整的 MVP 多 Agent 技能套件（`kf-mvp-backend-tdd`, `kf-mvp-code-review`, `kf-mvp-frontend-dev` 等），但当前会话未触发任何以下关键技能：

- ❌ `kf-mvp-code-review` — 修复后未执行独立代码审查
- ❌ `kf-mvp-test-e2e` — 未执行端到端回归测试
- ❌ `kf-mvp-test-review` — 未验证修改对已有测试的影响
- ❌ `kf-mvp-verifier` / `kf-mvp-msvp-verifier` — 未进行冒烟验收

### 3.3 为什么会绕过 Skill？

1. **修复粒度小 → 误判不需要走标准流程**：单文件单行修改被认为 "trivial"，跳过了审查门禁
2. **管道模式未激活**：当前会话是修复模式而非 Stage 3 全量开发模式，没有 pipeline coordinator 调度
3. **无强制门禁**：缺少 pre-merge hook 阻止未经验证的修改合入

---

## 4. 改进方案

### 4.1 立即行动（本次修复级别）

- [x] 将 `Field` 改为 `div` 用于 Checkbox 行 → 已修复
- [ ] **全量扫描**所有使用 `<Field className="flex items-center">` 包含非全宽控件的页面
- [ ] 为 `Field` 组件增加 `orientation="horizontal"` 的使用文档/注释

### 4.2 流程改进（中等优先级）

1. **Any fix → min-review 强制门禁**
   - 即使是单行修改，也触发 `kf-mvp-code-review` subagent
   - 审查清单：CSS 副作用、相邻组件回归、契约一致性

2. **修复后必走冒烟**
   - 弹窗类修改 → `kf-mvp-msvp-verifier` 验证：打开弹窗 → 检查所有控件可见 → 填写提交 → 确认成功
   - 列表类修改 → 验证排序、分页、筛选联动

3. **契约漂移自动检测**
   - 问题2（前后端字段名不一致）是可自动化的
   - 在 CI 中加入 Zod schema ↔ 前端类型 的一致性校验

### 4.3 根本性改进（长期）

1. **CSS 测试覆盖**
   - `Field` 组件的 `*:w-full` 变体对 Checkbox/Radio/Switch 等非全宽控件的回归测试
   - 快照测试覆盖所有 Field orientation + 控件组合

2. **Skills 激活策略**
   - 当前 `.qoder/skills/` 中的技能应在适当时机自动触发
   - 建议为项目增加 `.qoder/settings.json` 中的 auto-skill 规则

3. **E2E 作为真相来源**
   - 91/91 E2E 测试套件应成为每次修改后的必跑项
   - 当前 Playwright 版本冲突需首先解决

---

## 5. 反思总结

> **核心教训**: "快速修复" 的安全感是假的。单 Agent 的自查自修模式天然存在盲区——修复者看到的代码和评审者看到的代码永远不一样。即使是一次 CSS class 替换，也需要第二双眼睛确认。

> **衡量标准**: 技能体系的价值不在技能数量，而在**是否每次修改都经过独立验证**。当前 14+ 个 kf-* 技能闲置，说明触发机制有结构性缺陷——不是技能不好，是它们没有被用起来。

---

*本报告由 Agent 自主复盘生成，建议在下次 Pipeline 启动前讨论并落地至少一项流程改进。*
