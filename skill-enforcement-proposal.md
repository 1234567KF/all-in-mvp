# 技能强制门禁改造建议

**日期**: 2026-07-16  
**背景**: 复盘报告 → `docs/retrospective-2026-07-16.md`  
**结论**: kf-mvp-* 技能存在但无人强制调用，需增加自动触发机制

---

## 一、改什么

### 1. `.qoder/settings.json` — 增加 `qualityGates` 配置块

在现有 `rules` 同级新增：

```jsonc
{
  // ... 现有的 env / model / rules / permissions 保持不变 ...

  "qualityGates": {
    // 代码审查：修改前端/后端/共享包源码时自动触发
    "codeReview": {
      "enabled": true,
      "trigger": [
        "apps/web/src/**",
        "apps/api/src/**",
        "packages/shared/src/**"
      ],
      "skill": "kf-mvp-code-review",
      "mode": "auto",
      "description": "修改完成后自动派发 code-review subagent"
    },

    // 契约校验：修改 API 路由时自动触发
    "contractCheck": {
      "enabled": true,
      "trigger": [
        "apps/api/src/routes/**",
        "packages/shared/src/**"
      ],
      "skill": "kf-mvp-test-review",
      "mode": "auto",
      "description": "API 路由修改自动校验前后端字段一致性"
    },

    // 冒烟验证：修改 UI 组件或页面时建议触发
    "smokeVerify": {
      "enabled": true,
      "trigger": [
        "apps/web/src/components/ui/**",
        "apps/web/src/pages/**"
      ],
      "skill": "kf-mvp-msvp-verifier",
      "mode": "on-demand",
      "description": "弹窗/表单修改后人工确认冒烟"
    },

    // E2E 回归：任何 apps 目录变更后建议跑
    "e2eRegression": {
      "enabled": false,
      "trigger": ["apps/**"],
      "skill": "kf-mvp-test-e2e",
      "mode": "manual",
      "note": "待 Playwright 版本冲突修复后启用为 auto"
    }
  }
}
```

### 2. 新建 `.qoder/rules/quality-gate.md` — Agent 行为约束规则

```
路径: .qoder/rules/quality-gate.md
```

内容：

```markdown
# 质量门禁规则

## 强制行为
1. 修改 apps/web/src/ 或 apps/api/src/ 任何文件后，必须调用 kf-mvp-code-review 审查
2. 修改 apps/api/src/routes/ 任何文件后，必须校验前后端字段契约一致性
3. 任何涉及 Dialog/弹窗的 CSS/组件修改，必须打开预览浏览器人工确认

## 禁止行为
- 禁止在未通过 code-review 前标记任务为 COMPLETE
- 禁止跳过 E2E 回归就将修改视为"已验证"
- 禁止用"改动太小"作为跳过审查的理由

## 审查清单（code-review 必查项）
- [ ] CSS 副作用：修改的 class 是否影响相邻/嵌套组件
- [ ] 契约一致：前端字段名、枚举值与后端 Zod schema 一致
- [ ] 回归范围：同一页面/弹窗内所有控件是否正常
- [ ] 导入清理：是否引入未使用的 import
```

### 3. 修复 E2E 阻断项

```
优先级: P1
问题: Playwright 版本冲突，91 个 E2E 测试无法运行
位置: starters/weidian-crm/e2e/playwright.config.ts
操作: 对齐 root package.json 与 e2e 目录的 @playwright/test 版本
目标: qualityGates.e2eRegression 由 manual 改为 auto
```

---

## 二、改造前后对比

| 维度 | 改造前 | 改造后 |
|------|--------|--------|
| 触发方式 | Agent 自愿决定 | 文件路径匹配自动触发 |
| 跳过成本 | 零（直接忽略） | 高（违反 rules 约束） |
| 审查覆盖 | 0% | 100%（所有 src 变更） |
| 漏修发现 | 用户手动点名 | 审查 subagent 独立发现 |
| E2E 回归 | 从不跑 | Playwright 修好后自动跑 |

---

## 三、落地步骤

```
Step 1（立即）: 建 .qoder/rules/quality-gate.md
Step 2（立即）: 改 .qoder/settings.json 加 qualityGates 块
Step 3（本周）: 修复 Playwright 版本冲突，启用 e2eRegression
Step 4（验证）: 做一次真实修改，确认 auto 模式正确触发
```

---

## 四、风险与边界

- `mode: "auto"` 会增加每次修改的耗时（审查 subagent 启动 + 分析 + 返回），预估 +30s~2min
- 极小修改（如注释、格式化）也会触发审查，可能产生噪音——后期可加 `exclude` 白名单
- 技能本身的质量也需迭代：前几次自动审查可能漏报/误报，需要调优
