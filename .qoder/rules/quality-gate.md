# 质量门禁规则

> **关联体系**：[gate-rules.yaml](../gate-rules.yaml) — R020/R021 | [PLAYBOOK.md](../PLAYBOOK.md) — B019/B020
> **触发配置**：[settings.json](../settings.json) — `qualityGates` 块控制自动/手动触发模式
> **背景**：修复模式不走 Stage 流程 → 门禁全部失效。此文件补充非 Stage 流程下的强制行为约束。

## 强制行为

1. 修改 `src/` 下任何源码文件后，必须执行受影响区域代码审查（触发 `kf-mvp-code-review`）
2. 修改 API 路由或共享类型文件后，必须校验前后端字段契约一致性（触发 `kf-mvp-test-review`）
3. 任何涉及 Dialog/弹窗/共享 UI 组件的 CSS/组件修改，必须打开预览浏览器人工确认所有控件可见
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
文件修改
    ↓
settings.json qualityGates 路径匹配
    ↓
┌─ auto ────→ 自动派发 kf-mvp-code-review subagent
├─ on-demand → 建议触发，Agent 提示用户确认
└─ manual ──→ 用户手动调用 /skill-name
    ↓
审查 subagent 独立发现 → 修复 → 再审查 → PASS
    ↓
冒烟验证（Preview 浏览器 / kf-mvp-msvp-verifier）
    ↓
DONE
```
