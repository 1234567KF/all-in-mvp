# 质量门禁规则

> **关联体系**：[gate-rules.yaml](../gate-rules.yaml) — R020/R021 | [PLAYBOOK.md](../PLAYBOOK.md) — B019/B020
> **触发配置**：[settings.json](../settings.json) — `hooks.PostToolUse` → [.qoder/scripts/quality-gate-hook.ps1](../scripts/quality-gate-hook.ps1)（路径命中即向 Agent 注入门禁指令）
> **背景**：修复模式不走 Stage 流程 → 门禁全部失效。此文件补充非 Stage 流程下的强制行为约束。

## 强制行为

1. 修改 `src/` 下任何源码文件后，必须执行受影响区域代码审查（触发 `kf-mvp-code-review`）
2. 修改 API 路由或共享类型文件后，必须校验前后端字段契约一致性（触发 `kf-mvp-test-review`）
3. 任何涉及 Dialog/弹窗/共享 UI 组件的 CSS/组件修改，必须打开真实浏览器（browser-use MCP 或人工）确认所有控件可见
4. 弹窗类修改 → 验证所有控件可见 + 提交成功（对应 R020 门禁 2）
5. 列表类修改 → 验证排序/分页/筛选联动（对应 R020 门禁 2）
6. 共享组件修改 → 验证其 CSS 变体不破坏 Checkbox/Radio/Switch（对应 R021）

## 禁止行为

- 禁止在未通过 code-review 前标记任务为 COMPLETE
- 禁止跳过冒烟验证就将修改视为"已验证"
- 禁止用"改动太小"作为跳过审查的理由（血案 B020）
- 禁止修改共享 UI 组件后不检查非标准控件（血案 B019）

## 审查清单（code-review 必查项）

- [ ] **CSS 副作用（R021）**：修改的 class 是否影响相邻/嵌套组件？`*:w-full`、`flex-col` 等是否为 Checkbox/Radio/Switch 引入副作用？
- [ ] **契约一致（R002/R014）**：前端字段名、枚举值与后端 Zod schema / api-contract.yaml 一致？
- [ ] **回归范围**：同一页面/弹窗内所有控件是否正常？
- [ ] **错误处理（R015）**：.catch() 回调有 console.warn() 或 toast？
- [ ] **数据源绑定（R018）**：显示的用户名/角色/权限来自 auth store 而非硬编码？
- [ ] **导入清理**：是否引入未使用的 import？

## 触发链

```
文件写入 / 编辑（Write | Edit | MultiEdit）
    ↓
Qoder hooks.PostToolUse → quality-gate-hook.ps1 读取 tool_input.file_path
    ↓
路径命中门禁规则 → stderr 输出 [QUALITY-GATE] + exit 2（Agent 可见，写入本身不回滚）
    ↓
┌─ 源码命中 ────→ 派发子 Agent mvp-code-reviewer（技能 kf-mvp-code-review）
├─ 契约层命中 ─→ 技能 kf-mvp-test-review 校验字段/枚举一致性
└─ 共享 UI/页面命中 → 子 Agent mvp-verifier 做 MSVP 冒烟
    ↓
审查子 Agent 独立发现 → 修复 → 再审查 → PASS
    ↓
冒烟验证（真实浏览器 / 子 Agent mvp-verifier）
    ↓
DONE
```

> **未命中路径时 hook 静默 exit 0**，不打扰普通编辑。
> **手工兜底**：hook 只在会话重启后生效；无法依赖 hook 的场景，按上方三条自行派发。
> **历史说明**：v2.18 用 `settings.json#qualityGates` 声明这三条映射，但 Qoder CLI 不识别该键 → 从未生效。现由 hooks 承接，映射关系不变。
