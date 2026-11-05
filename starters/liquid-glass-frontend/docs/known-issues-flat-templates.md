# 已知问题：flat-go / flat-java 脚手架生成项目不可用（共享契约缺失）

- **状态**：🔴 未修复（本文档只记录问题、证据与候选方案，**不含代码改动**）
- **发现时间**：2026-11-05（Batch 4「审计日志」做 `--clean-demo` 脚手架联动验证时暴露）
- **影响版本**：当前 main（`31ccbb8` 及之后的工作区，含 B1~B4）
- **影响范围**：仅 `--type flat-go` / `--type flat-java` 生成的项目；**monorepo 模板与生成项目不受影响**
- **是否本次批次引入**：否，属既有缺陷；B4 仅做了「flat 不生成审计前端页」的部分缓解
- **建议处理方式**：单独开一批修复（暂称 Batch 7 / flat 修复批），不阻塞 B4、B5

---

## 1. 问题摘要

`scaffold.ts` 的 flat 转换会把 `apps/web` 搬到 `frontend/`，并删除根 `packages/`（含 `packages/shared`）与根 `package.json`，但**没有同步处理前端对 `shared` 契约包的依赖**：

- `frontend/package.json` 仍保留 `"shared": "*"`；
- 前端仍有大量文件 `import ... from "shared"`；
- 没有 workspace，也没有 `file:` 本地依赖或路径映射 → `bun install` 会从 npm 安装**另一个同名的无关包**。

结果：flat 生成项目的前端 `typecheck` / `build` / `lint` / `test` 全部失败，当前 flat 模板实际不可交付。

## 2. 复现步骤

```bash
# 1) 生成 flat 项目（脚本优先使用本地模板缓存 ~/wecode/liquid-glass-starter）
bun run skills/wecode-project-scaffolder/scripts/scaffold.ts \
  --name demo-flat \
  --target /tmp/demo-flat \
  --type flat-go \
  --db none \
  --clean-demo true

# 2) 在前端目录验证（flat-java 同理）
cd /tmp/demo-flat/frontend
bun install
bun run typecheck   # = tsc --noEmit
bun run build       # = tsc && vite build
bun run lint
bun run test
```

flat-java 与 flat-go 走同一段 flat 转换逻辑，问题一致；`--db none` 只是跳过 `go get`，不影响本问题。

## 3. 实际证据（2026-11-05 实测）

1. **依赖指向错误**

   ```jsonc
   // /tmp/demo-flat/frontend/package.json
   "dependencies": { "shared": "*" }
   ```

   根 `packages/` 已被删除，`shared` 无法按 workspace 解析，于是从 npm 装了同名包：

   ```jsonc
   // /tmp/demo-flat/frontend/node_modules/shared/package.json
   {
     "name": "shared",
     "version": "0.2.0",
     "description": "Shared objects over MongoDB",
   }
   ```

2. **前端源码仍引用契约包**：`grep -rl 'from "shared"' frontend/src | wc -l` → **19** 个文件（页面 / hooks / services / stores / 组件测试）。

3. **typecheck / build 失败**（示例）：

   ```
   src/components/shared/PermissionGate.tsx(17,37): error TS2306:
     File '.../node_modules/shared/lib/shared.d.ts' is not a module.
   src/components/layout/TopBar.tsx(51,26): error TS2353:
     Object literal may only specify known properties, and 'limit' does not exist in type 'UseNotificationsOptions'.
   ```

4. **lint 失败**：根 `eslint.config.js` 被 flat 转换删除，但 `frontend` 仍沿用 monorepo 的 lint 脚本：

   ```
   $ eslint . --cache --cache-strategy content
   ESLint couldn't find an eslint.config.* file.
   ```

5. **test 失败**：`bun run test -- --run` → `4 failed | 31 passed`、`16 failed | 280 passed`（均为 shared 契约缺失/类型不匹配引发的连锁失败）。

## 4. 根因分析

相关代码：[scaffold.ts](../skills/wecode-project-scaffolder/scripts/scaffold.ts)

### 4.1 flat 转换步骤（约 L695–L720）

1. `apps/web` → `frontend/`（整目录搬迁）；
2. 删除 `apps/` 与 `packages/`（`packagesDir` 整棵删除，含 `packages/shared`）；
3. 删除根 `package.json`、`bun.lock`、`eslint.config.js`、`init.sh`；
4. **没有改写** `frontend/**` 里的 `import ... from "shared"`，也没有替换 `frontend/package.json` 的 `"shared"` 依赖。

### 4.2 为什么没有报错却被“装成功”

- 没有根 workspace 后，`bun install` 把 `"shared": "*"` 当成普通 npm 依赖解析，恰好存在同名包 `shared@0.2.0`，安装“成功”；
- `frontend/tsconfig.json` 只有 `@/*` 映射，没有 `shared` 的 paths 映射；
- `build:shared` 只在 monorepo 分支执行（约 L1234），flat 也不会产出 `packages/shared/dist`。

## 5. 关联缺陷（同一 flat 分支，建议一起决策）

| #   | 问题                                                                                                                                                                                                                           | 现状                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1   | flat 后端只有 `/api/hello`（[go main.go.template L21](../skills/wecode-project-scaffolder/templates/go/main.go.template)、[kotlin App.kt.template L19](../skills/wecode-project-scaffolder/templates/kotlin/App.kt.template)） | 即使前端修到可编译，所有业务页 API 仍 404，只是「能编译的空壳」 |
| 2   | `--include-ci` 仅支持 monorepo（scaffold 约 L1190 显式警告跳过）                                                                                                                                                               | flat 生成项目无 CI / Docker / 测试端口能力                      |
| 3   | 根 `eslint.config.js` 被删除，但 frontend 仍用 monorepo 脚本                                                                                                                                                                   | `bun run lint` 必失败（见证据 4）                               |
| 4   | 文档仍把 flat-go / flat-java 当作正式可选项（README「备用方案」、[SKILL.md](../skills/wecode-project-scaffolder/SKILL.md) Style B 段落）                                                                                       | 与真实可用性不符，易误导入                                      |

> Batch 4（审计日志）已做的缓解：flat 类型默认不生成审计日志前端页（页面/路由/菜单/service/hook 全清），避免在既坏项目上再叠一个无后端支撑的 404 路由；该策略在生成项目中已验证通过（文件层面）。

## 6. 候选修复方案

以下按「先确认使用需求，再选方案」排列，均尚未实施。

### 方案 A：flat 保留 `packages/shared`（改动最小，优先评估）

- flat 转换不再删除 `packages/shared`；
- 保留/生成最小根 `package.json`（仅用于 workspace 解析），或把 `frontend/package.json` 改为 `"shared": "file:../packages/shared"`；
- `frontend/tsconfig.json` 增加 `shared` 的 paths 映射需与构建产物对齐；
- `bun install` 前先 `bun run --filter shared build`（或 flat 的等价命令）。
- **优点**：契约仍是单一事实源，改动集中在 scaffold；flat 与 monorepo 契约完全一致。
- **风险/成本**：flat 的「双目录平铺」定位会被削弱（根目录多出 `packages/`）；需要处理 `file:` 依赖下 `dist` 的构建顺序。
- **代价**：约 1 个聚焦批次（scaffold + 文档 + 生成项目验证）。

### 方案 B：把前端契约下沉进 `frontend/src/shared`

- flat 转换时把 `packages/shared/src` 复制到 `frontend/src/shared`（或仅复制前端消费的部分）；
- 批量改 `import ... from "shared"` → `@/shared`；
- 后端（Go/Kotlin）按自己的语言重新维护契约。
- **优点**：生成项目自包含，不再依赖 workspace，与「前后端独立平铺」定位一致。
- **风险/成本**：契约双写（前端 / 异构后端）易漂移；需要维护「从 packages/shared 同步到 frontend」的机制。
- **代价**：改动面最大，涉及 scaffold 的批量重写与后续同步规则。

### 方案 C：flat 改走 OpenAPI 契约生成（长期方向）

- 按 README「技术选型」里 flat 场景的建议，用 OpenAPI / Orval / openapi-typescript 生成前端类型；
- flat 前端不再 import `shared`，改为生成产物；
- 需要后端先生成 OpenAPI 文档（Go/Kotlin 侧新增）。
- **优点**：最符合异构后端定位，前后端解耦、契约由后端产出。
- **风险/成本**：需要额外契约产物流程与后端改造，周期最长。
- **代价**：独立批次（可能 2 批以上）。

### 推荐决策顺序

1. **先确认 flat 模板是否仍在维护 / 有实际使用方**（CI 不支持、后端仅 hello，倾向「实验性」）；
2. 若无人使用 → **文档 + CLI 明确标记 experimental**，并加 fail-fast 提示（或在帮助中隐藏），避免误生成；
3. 若确定要用 → **方案 A** 先恢复「可编译、可测试」底线，再评估 B/C 的契约治理。

## 7. 临时规避（未修复前）

- 正式项目/需要 CI 的项目：**优先使用 `--type monorepo`**；
- 必须用 flat 时，生成后手动修复：从模板仓库复制 `packages/shared` 到项目根、把 `frontend/package.json` 的 `"shared"` 改为 `file:../packages/shared`、把根 `eslint.config.js` 复制到前端目录，并先构建 shared。该方式未纳入脚本，属于临时手工兜底。

## 8. 修复验收标准

- [ ] 生成 `--type flat-go` 与 `--type flat-java` 项目后，`cd frontend && bun install && bun run typecheck && bun run build && bun run lint` 全部通过；
- [ ] `bun run test` 通过（或明确记录并豁免与 shared 无关的既有失败项）；
- [ ] `frontend/node_modules/shared` 不再指向 npm 同名包（不存在或指向本项目契约）；
- [ ] 契约来源单一且文档说明清晰（方案 A/B/C 三选一并落地）；
- [ ] `--clean-demo` / `--clean-audit-log` 在 flat 下仍正常（当前基线：审计前端默认移除）；
- [ ] README / SKILL.md 更新 flat 的定位、限制与验证命令；
- [ ] 生成项目根 `bun install` 不再安装无关 npm 包（可加生成后自检）。

## 9. 相关代码与文档索引

- flat 转换：`skills/wecode-project-scaffolder/scripts/scaffold.ts`（flat 分支、删除 packages/根配置、install/build 分支、`--include-ci` 限制）
- 前端契约依赖：[apps/web/package.json](../apps/web/package.json)（`"shared": "*"`）、[packages/shared](../packages/shared)
- 后端最小模板：`skills/wecode-project-scaffolder/templates/go/main.go.template`、`templates/kotlin/App.kt.template`
- 审计日志联动策略（已实施）：[README.md](../README.md) 脚手架规则说明、[SKILL.md](../skills/wecode-project-scaffolder/SKILL.md)
- 批次计划参考：[docs/ai-native-enhancement-plan.md](./ai-native-enhancement-plan.md)（Batch 5/6 与本文档无关，可插队修 flat）

## 10. 处理状态

- 未排期、未拆分任务；
- 本文档仅记录，等确认 flat 模板的维护意图后，再决定是否开修复批（以及选方案 A/B/C）。
