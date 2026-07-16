# GitLab CI/CD Guide

面向 `liquid-glass-starter` 系脚手架的完整 CI/CD 上线手册。当 skill 触发 add-ci 流程或用户答"Y"选择 include-ci 时，需要向用户导读本文件。

---

## 1. CI 结构概览

流水线包含 6 个 Job，分布在 3 个 Stage 中：

| Stage  | Job             | 触发条件                     | 依赖                        | 作用                                                                                                                        |
| ------ | --------------- | ---------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| check  | `check`         | push / MR / schedule / web   | —                           | Bun 安装 + `build:shared` + **`migrate:check`** + **`arch:check`** + **`test:ci`**（三档质量门禁）                          |
| build  | `build`         | 分支 `main` / schedule / web | `check`                     | `docker build`（不 push）+ `docker save` 导出为 `image.tar.gz` artifact，供后续两个 job 并行消费                            |
| build  | `retag`         | 分支 `prod`                  | —                           | 从 registry 拉取 main 已构建的 `$SHA` 镜像，retag 为 `:latest` 并推回                                                       |
| deploy | `push-registry` | 分支 `main` / schedule / web | `build` (artifact)          | 从 artifact `docker load` 后 push `$SHA` 与 `test-latest` 到阿里云 Registry（与 `deploy-test` 并行）                        |
| deploy | `deploy-test`   | 分支 `main`                  | `check`, `build` (artifact) | SCP `compose.test.yml` + `deploy.sh` + `image.tar.gz` 到测试机，执行 `./deploy.sh test-latest image.tar.gz`（tar 加载模式） |
| deploy | `deploy-prod`   | 分支 `prod` / schedule / web | `check`, `retag`            | wget POST 到 `FLOW_WEBHOOK_URL` 触发阿里云 Flow 部署                                                                        |

### 双分支模型

- **`main` 分支** = 测试环境。每次合入 → `build` 生成 tar artifact → `push-registry` 推阿里云 并行 `deploy-test` SCP 到测试机启动。
- **`prod` 分支** = 生产环境。要求以 **Fast-Forward 合并 main → prod**（不允许 Squash / Merge commit），保证 prod HEAD SHA 与 main 已构建 SHA 一致 → `retag` 复用镜像 → `deploy-prod` 触发 Flow webhook。
- **合并原则**：测试通过的镜像 == 生产运行的镜像，不重复 build（`push-registry` 推的 `$SHA` 即 `retag` 拉的 `$SHA`）。

### workflow.rules 去重

有关联 MR 的 push 事件不会重复触发流水线：

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "push" && $CI_OPEN_MERGE_REQUESTS
      when: never
    - when: always
```

---

## 1.5 `check` job 三档速查

| 命令                             | 代码                                                                                                                    | 作用                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `bun --filter api migrate:check` | [apps/api/scripts/migrate-check.ts](../../../apps/api/scripts/migrate-check.ts)                                         | drizzle journal / `.sql` / snapshot 三方一致 + 内存 SQLite 重放 + drift 检测 |
| `bun run arch:check`             | [scripts/arch-check.ts](../../../scripts/arch-check.ts)                                                                 | UI 层禁 `@/lib/api` / `axios` / `sonner` 直连；页面必须 `React.lazy()`       |
| `bun run test:ci`                | [apps/web/vitest.config.ts](../../../apps/web/vitest.config.ts) + [apps/api/bunfig.toml](../../../apps/api/bunfig.toml) | 前端 vitest istanbul 覆盖率 + 后端 Bun 原生覆盖率                            |

本地提交阶段还有 [scripts/check-migration-staged.ts](../../../scripts/check-migration-staged.ts)（`.husky/pre-commit` 触发）拦截“新增 SQL 但漏 stage journal / snapshot”的断尾提交。

**覆盖率阀值**：模板阶段默认为 0（避免业务空缺卡红 CI）。业务成型后按需上提：前端 `lines/statements/functions=90 / branches=75`，后端 `coverageThreshold=0.85`。具体历史坑（Bun v8 provider 不兼容、bunfig 阀值必须单值等）见对应配置文件顶部注释。

**add-ci 向遗留项目下发时不会自动接管的两类配置**（避免覆盖项目已有）：`package.json` 里的 `test:*` / `arch:check` / `migrate:check` scripts；`apps/web/vitest.config.ts` 与 `apps/api/bunfig.toml` 的覆盖率配置。skill 在结束时会提醒核对。

---

## 1.6 构建入口：scripts/build-server.sh

Dockerfile builder 层唯一命令 `RUN sh scripts/build-server.sh`，做三件事：`build:shared` → `bun build --compile` 出 `dist/server` → `build:web`。本地可直接 `sh scripts/build-server.sh` 复现容器产物。抽出脚本的详细动因见 [scripts/build-server.sh](../../../scripts/build-server.sh) 顶部注释。

---

## 2. 首次上线 GitLab CI/CD Variables 清单

在 GitLab 项目 **Settings > CI/CD > Variables** 里配置。默认 CI 文件里保留了模板项目自己的值，实际上线**必须**替换以下：

### 必配变量

| Key                           | Type             | Protected | Masked | 值说明                                                                                                                                              |
| ----------------------------- | ---------------- | --------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `G_LOCAL_SERVER_000_SSH_PKEY` | File 或 Variable | 是        | 是     | 测试机的 SSH 私钥内容（**整段** `-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END OPENSSH PRIVATE KEY-----`）。如果用组级变量已存在，此项可跳过。   |
| `FLOW_WEBHOOK_URL`            | Variable         | 是        | 否     | 阿里云 Flow 流水线 Webhook 地址，形如 `http://flow-openapi.aliyun.com/pipeline/webhook/xxxxx`。**仅当项目要接入生产部署时必配**；纯测试环境不影响。 |

### 可选覆盖（默认已在 `.gitlab-ci.yml` `variables:` 段中硬编码）

| Key         | 默认值                                          | 何时需要覆盖                            |
| ----------- | ----------------------------------------------- | --------------------------------------- |
| `TEST_HOST` | `192.168.110.214`                               | 用不同的内网测试机                      |
| `TEST_PORT` | `63022`                                         | 测试机 SSH 端口不同                     |
| `TEST_USER` | `wecode`                                        | 部署用户名不同                          |
| `TEST_PATH` | `/home/wecode/<project>`                        | 部署目录不同（scaffold 已按项目名替换） |
| `IMAG_REG`  | `registry.cn-beijing.aliyuncs.com/wecode-cloud` | 使用其它镜像仓库前缀                    |

覆盖方式：不改 `.gitlab-ci.yml`，在 GitLab UI Variables 里新加同名 Key，Runtime 会覆盖 yml 内的默认值。

---

## 3. SSH 私钥生成与投放

首次接入需要给 GitLab CI 一个能 SSH 到测试机的私钥。

### 3.1 生成密钥对（本地）

```bash
ssh-keygen -t ed25519 -C "gitlab-ci@<project>" -f ~/.ssh/gitlab_ci_<project>
# 一路回车，不要设置 passphrase（CI 无法交互输入）
```

产物：

- `~/.ssh/gitlab_ci_<project>` — 私钥（后续贴到 GitLab）
- `~/.ssh/gitlab_ci_<project>.pub` — 公钥（追加到测试机）

### 3.2 把公钥装到测试机

```bash
ssh -p 63022 wecode@192.168.110.214
# 登录后：
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<粘贴 gitlab_ci_<project>.pub 的完整内容>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
exit
```

本地验证：

```bash
ssh -i ~/.ssh/gitlab_ci_<project> -p 63022 wecode@192.168.110.214 "hostname && whoami"
```

### 3.3 把私钥装到 GitLab

- **组级共享（推荐）**：管理员在 Group Settings > CI/CD > Variables 里配 `G_LOCAL_SERVER_000_SSH_PKEY`，组内所有项目自动继承。
- **项目单配**：Project Settings > CI/CD > Variables → Add Variable：
  - Key: `G_LOCAL_SERVER_000_SSH_PKEY`
  - Type: `Variable`（不是 File，因为 `.gitlab-ci.yml` 里用 `echo "$..." > private_key` 展开）
  - Protected: 建议 ✅
  - Masked: 尝试勾选；如果 GitLab 拒绝（多行/含特殊字符），取消 masked 但保留 protected
  - Value: 整段私钥内容（含首尾 BEGIN/END 行）

---

## 4. 首次触发流水线

三种方式：

1. **Push 到 `main`（自动）**

   ```bash
   git push origin main
   ```

   → 触发 `check` + `build` + `push-registry` + `deploy-test`（后两者并行）。

2. **GitLab Web UI 手动触发**
   - Project → CI/CD → Pipelines → Run pipeline
   - Branch: `main`（或 `prod`）
   - 适合首次配好 Variables 后想立即验证但没有代码改动的场景。

3. **CI/CD Schedules 定时**
   - Project → CI/CD → Schedules → New schedule
   - Cron: 如 `0 3 * * *`（每天 3 点）
   - Branch: `main`
   - 会带 `CI_PIPELINE_SOURCE=schedule`，触发 `build` + `deploy-prod`（若在 prod 分支上定时）。

---

## 5. 常见错误排错

### 5.1 `retag` job 拉镜像失败

日志形如：

```
❌ 拉取镜像失败：registry.cn-beijing.aliyuncs.com/wecode-cloud/<project>:<sha>
  当前 prod HEAD SHA (...) 在 Registry 中不存在。
```

**原因**：合并 main → prod 时用了 Squash 或 Merge commit，prod 的 HEAD SHA 与 main 已构建的 SHA 不同。

**修复**：

```bash
git checkout prod
git reset --hard <上一个正确的 SHA>
git merge --ff-only main
git push origin prod
```

以后合并 main → prod 一律选择 Fast-Forward。

### 5.2 `deploy-test` 健康检查超时

日志形如：

```
ERROR: Health check timeout (60s)
```

**可能原因**：

- 应用启动时数据库迁移失败 → 看 `docker compose logs` 尾部
- 端口冲突（测试机已有服务占用 `WEB_PORT`）→ 修改测试机 `.env` 里的 `WEB_PORT`
- 应用监听地址不是 `0.0.0.0:3000` → 检查 API server 启动配置

### 5.2.1 `deploy-test` tar 包丢失 / 镜像不存在

日志形如：`ERROR: tar 包不存在` 或 `docker: no such image`。

**可能原因**：

- `build` job artifact 过期（默认 `expire_in: 1 day`）但 `deploy-test` 重跑时 artifact 已被清理 → 重新触发 `build`
- 测试机上旧的 `image.tar.gz` 未正常删除（deploy.sh 中 `rm -f` 因权限失败）→ SSH 上去手动 `rm image.tar.gz` 后重新部署
- `compose.test.yml` 的 `pull_policy` 被改成 `always` → tar 加载模式下会反而去拉阿里云，确保保持 `missing`

### 5.2.2 `push-registry` 失败但 `deploy-test` 成功

`push-registry` 与 `deploy-test` 并行。如果 `push-registry` 失败（阿里云网络抖动、介质临时不可用等）但 `deploy-test` 成功：

- **测试环境不受影响**（镜像已从 tar 加载）
- **但阿里云 Registry 缺了这个 `$SHA` 镜像** → 后续 FF 合并到 prod 时 `retag` 会拉不到镜像
- **修复**：在 GitLab UI 中手动 retry `push-registry` job 即可

### 5.3 Registry 登录失败

`docker pull` 报 401 / unauthorized：

- GitLab Runner 未登录内部 registry。如果 registry 是内网公开可拉，无需登录；若需要 Basic Auth，在 CI 里加 `docker login` 步骤并配置 `REGISTRY_USER` / `REGISTRY_PASS` 两个 GitLab Variables。

### 5.4 `check` job 失败（typecheck / migrate:check / arch:check / test:ci）

本地先单独重现、修好再 push：

```bash
bun run build:shared            # 前置，shared 包没编译会满版报错
bun run typecheck               # 可选：先排除类型错误
bun --filter api migrate:check  # 迁移 / snapshot / drift 三维一致性
bun run arch:check              # UI 层约束 + 页面 lazy
bun run test:ci                 # 前后端覆盖率阈值
```

常见败因：`schema.ts` 改了但忘跑 `bunx drizzle-kit generate`（migrate:check 报 drift）；UI 层直接 `import axios`（arch:check 报）；新增大块业务代码但未写测试（test:ci 覆盖率低于阀值）。临时无法及时修时可在 `apps/web/vitest.config.ts` / `apps/api/bunfig.toml` 里调低阀值，但需尽快追齐到目标基线。

### 5.5 生产 Flow Webhook 报 404 / 403

- `FLOW_WEBHOOK_URL` 变量未配 → 到 GitLab Variables 里加
- URL 里的 token 已作废 → 到阿里云 Flow 流水线里重新生成 Webhook 触发器

---

## 6. 验证 CI 结构改动

模板项目本身就能跑，CI 结构变更直接在 `~/wecode/liquid-glass-starter/` 上改并 push，用它自己的测试环境冒烟验证（测试机 `192.168.110.214:11070`）。

---

## 7. GitLab CI 上线清单（Success Output 用）

当 skill 完成 init 带 CI 或 add-ci 后，向用户输出：

```markdown
### GitLab CI 上线清单

代码推到 GitLab 前，请在项目 **Settings > CI/CD > Variables** 配好：

- [ ] `G_LOCAL_SERVER_000_SSH_PKEY` —— 测试机 SSH 私钥
- [ ] `FLOW_WEBHOOK_URL` —— 生产 Flow Webhook（仅生产上线时；阿里云 Flow 需逐项目单独配置）

如果你的部署环境与模板默认不同，还需覆盖：`TEST_HOST` / `TEST_PORT` / `TEST_USER` / `TEST_PATH` / `IMAG_REG`

**【add-ci 向遗留项目下发时额外确认】**

- [ ] `package.json` scripts 已包含：`arch:check` / `test:ci` / `test:coverage` / `test:api:coverage`；`apps/api/package.json` 包含 `migrate:check`
- [ ] `apps/web/vitest.config.ts` 已启用 `provider: "istanbul"` + `thresholds`
- [ ] `apps/api/bunfig.toml` 已配 `coverageThreshold` 与 `coveragePathIgnorePatterns`
- [ ] `apps/web/package.json` devDependencies 已加 `@vitest/coverage-istanbul`
- [ ] 本地先跑一次 `bun run build:shared && bun --filter api migrate:check && bun run arch:check && bun run test:ci` 所有项均绿

首次触发方式：`git push origin main` 或 GitLab UI → Pipelines → Run pipeline。

详见：`skills/wecode-project-scaffolder/references/ci-guide.md`
```

---

## 8. Skill `add-ci` 模式手册

本节是 SKILL.md 中 “Intent B: 为已有项目添加 CI” 的行为契约与用户对话流程详情，SKILL.md 只留触发规则和一行命令，具体流程读这里。

### 8.1 触发条件

用户意图为“为已有项目加 CI”时直接进入 8.2，**不要跑完整 Phase 1 Interview**（不问项目名、架构、DB 等）。

### 8.2 Add-CI Interview（中文）

1. **确认目标项目目录**：默认当前 workspace root；不确定时向用户确认绝对路径。
2. **告知将写入的 10 个文件**（含质量门禁脚本）：
   - CI 定义：`.gitlab-ci.yml`
   - 镜像构建：`Dockerfile` / `ci-tools/Dockerfile` / `.dockerignore`
   - 部署编排：`deploy.sh` / `compose.yml` / `compose.test.yml`
   - 质量门禁脚本：`scripts/arch-check.ts` / `scripts/check-migration-staged.ts` / `apps/api/scripts/migrate-check.ts`

   若目标目录中任一文件已存在 → 报错，需用户确认后加 `--force`。

3. **提示上线前必配项**：向用户读出本文 §2 的 Variables 清单和 §7 的 `add-ci 向遗留项目下发` 清单，强调 `package.json` scripts / `bunfig.toml` / `vitest.config.ts` / devDependencies 需要人工核对（本 skill 只写入 CI 文件，不改这些配置）。
4. Stop and wait。用户回复 “开始 / 继续 / 确认” 后再执行 8.3。

### 8.3 Add-CI Execution

```bash
bun run <SKILL_DIR>/scripts/scaffold.ts \
  --mode add-ci \
  --target "<TARGET_PATH>" \
  [--force]
```

- 项目名从 `apps/web/package.json`（monorepo）或 `frontend/package.json`（flat，暂不支持）自动推断。
- 结构自检：monorepo 必须存在 `apps/api/src/index.ts` + `apps/web/package.json` + `packages/shared/package.json`。
- 冲突检测：默认不覆盖已存在的 CI 文件，除非传 `--force`。

### 8.4 错误处理

| 错误信息                                                    | 处理                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `CI files already exist`                                    | 列出冲突文件，询问用户是否 `--force` 覆盖                            |
| `Project structure does not match monorepo CI expectations` | 项目结构与模板已偏离，需人工核对 `apps/api/src/index.ts` 等关键文件  |
| `Flat layout CI is not sedimented yet`                      | 当前 flat-go / flat-java 项目不支持自动注入 CI，建议手写或等后续迭代 |

### 8.5 完成后的 Post-Success

输出 §7 中的 “GitLab CI 上线清单” 模板。

---

## 9. 测试端口分配（skill 自动分配 + SSH 探测）

### 9.1 端口段划分

| 段位          | 用途                                    | 备注                                              |
| ------------- | --------------------------------------- | ------------------------------------------------- |
| `11070`       | 模板 `liquid-glass-starter` self-deploy | 保留，不参与递增分配                              |
| `11080`       | 预留给主业务项目的固定端口              | registry 以 `source: manual` 登记，不参与递增分配 |
| `11081-11199` | 新项目递增分配段                        | skill port-allocator 自动挑选                     |
| `11200+`      | 预留（其他服务 / 未来扩展）             | 不使用                                            |

### 9.2 分配行为

**单次 SSH 原子事务**：远端 `flock` + `python3` 一口气完成读 registry → 扫 `ss -tlnH` LISTEN → 写 registry。具体实现见 [scripts/lib/port-allocator.ts](../../scripts/lib/port-allocator.ts) 顶部注释。

**Registry 位置**：`wecode@192.168.110.214:/home/wecode/port-registry.json`（团队共享单一权威源，无本地缓存）。

**幂等**：registry 已有同名 project → 直接复用（`reused=true`）；否则从 `11081` 递增找第一个「LISTEN 未占 + registry 未登记」的端口。

### 9.3 SSH 免密降级链

目标：`wecode@192.168.110.214:63022`，密码 `wecode`（硬编码于 [scripts/lib/test-server.ts](../../scripts/lib/test-server.ts)）。

1. `ssh -o BatchMode=yes` 试当前 key ——成功即返
2. 失败 → 无 `~/.ssh/id_ed25519` 则 `ssh-keygen` 生成 → `sshpass` / `expect` 密码登录后 `ssh-copy-id`
3. 二次 BatchMode 验证

`sshpass` / `expect` 都未安装时 skill 报错并提示 `brew install hudochenkov/sshpass/sshpass`。

### 9.4 CLI 用法与手动兜底

**自动模式**（默认，推荐）：

```bash
bun run <SKILL_DIR>/scripts/scaffold.ts --mode add-ci --target "<PATH>"
```

**手动指定端口**（跳过远端探测，仅走 registry 冲突检查）：

```bash
bun run <SKILL_DIR>/scripts/scaffold.ts --mode add-ci --target "<PATH>" --port 11099
```

**完全跳过**（保留模板默认 11070 占位符，用户后续手改）：

```bash
bun run <SKILL_DIR>/scripts/scaffold.ts --mode add-ci --target "<PATH>" --skip-port-alloc
```

**直接调用分配器**（初始化 / 调试 / 手动登记）：

```bash
bun run <SKILL_DIR>/scripts/lib/port-allocator.ts demo-app --port 11080 --source manual
bun run <SKILL_DIR>/scripts/lib/port-allocator.ts myproject
```

### 9.5 修复 / 撤销分配

**手工回填历史部署**（例如之前有人 SSH 上去手起了服务占了 11085）：

```bash
ssh -p 63022 wecode@192.168.110.214 'vi /home/wecode/port-registry.json'
# 在 allocations 数组里手动追一条：
# { "project": "legacy-x", "port": 11085, "allocatedAt": "2026-07-14", "source": "manual" }
```

**释放某项目的端口**（项目已下线）：同上 `vi`，删除对应 allocations 条目即可；下次分配时自然可以抢中。

**重置整个 registry**（谨慎，会丢失所有历史分配记录）：

```bash
ssh -p 63022 wecode@192.168.110.214 'rm /home/wecode/port-registry.json'
# skill 下次分配时会重新创建空 registry
```

**撤销测试机对本机的免密授权**（例如离职 / 换机器）：

```bash
ssh -p 63022 wecode@192.168.110.214
# 编辑 ~/.ssh/authorized_keys 移除本机公钥行
```

### 9.6 常见错误

| 错误信息                                         | 处理                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `SSH 免密配置失败：缺少 sshpass/expect`          | macOS `brew install hudochenkov/sshpass/sshpass` 或手动 `ssh-copy-id -p 63022 wecode@192.168.110.214` 输密码 `wecode` 一次 |
| `端口 XXXX 已被项目 YYY 占用（remote registry）` | 换 `--port` 或上去 `vi /home/wecode/port-registry.json` 清理 YYY 条目                                                      |
| `端口段 11081-11199 已全部占用`                  | 上去清理长期不用的 registry 条目；或扩容 `test-server.ts` 中的 `portRangeEnd`                                              |
| `远端分配失败 (exit N): ...`                     | SSH 本身可达但远端脚本报错（python 缺失 / registry 文件損坏）；stderr 会带上完整错误信息                                   |
| `ssh-copy-id 已执行但免密验证仍失败`             | 手动 `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`，或用 `ssh -vvv` 排查                                          |

### 9.7 TODO

多测试机支持 / 凭据环境变量兜底 / `--sync-remote` 自动回填——需要时再加。
