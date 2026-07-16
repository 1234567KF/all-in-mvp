---
name: wecode-project-scaffolder
description: Scaffold a new project, initialize a project workspace, and setup a full-stack TS Monorepo, Go, or Kotlin Spring Boot architecture from the Liquid Glass / WeCode starter template. Also supports adding a GitLab CI/CD pipeline to an existing scaffolded project (see "Utility: 为已有项目添加 CI" below).
metadata:
  pattern: inversion + pipeline
---

# Scaffolding Workflow

When triggered, first classify the user's intent:

- **Intent A: Initialize a new project** (“新建项目 / 初始化 / 搭个脚手架”) → Phase 1 + Phase 2 下面。
- **Intent B: Add CI to an existing project** (“为已有项目加 CI / 加个流水线 / 接部署配置”) → 跳至下方 “Utility: 为已有项目添加 CI”。
- **Intent C: Refresh template cache** (“更新模板 / 拉最新模板”) → 跳至 “Utility: Update Template Cache Only”。

Otherwise, treat as Intent A by default.

## Phase 1: Inversion (Interview)

Before writing any files, you MUST interview the user in Chinese to gather the configuration parameters. Make sure to remind the user that **Bun** must be installed on their system to run the template. Ask the following questions in a friendly, structured manner:

1. **项目名称** (Project Name, e.g., `my-liquid-app`)
2. **目标物理路径** (Target Directory absolute path, e.g., `/Users/username/Desktop/my-liquid-app`). **Ask the user whether to scaffold directly inside the current directory** (the current workspace root) or **create a new subfolder**.
   - If they choose the current directory, use the absolute path of the current workspace root.
   - If they specify a custom parent directory (e.g., `/Users/acker/Desktop/Project`), append the project name to it to construct the target path (e.g., `/Users/acker/Desktop/Project/<PROJECT_NAME>`).
3. **架构选型** (Architecture Choice):
   - **A) [Recommended] 全栈 TS Monorepo** (Vite+React + Hono API + Bun Workspaces. _Reason for Tech: Zero context switching, write TypeScript end-to-end, shared type safety via workspaces. Reason for Non-Tech: Best for rapid MVP/product delivery, lowest development cost, fastest time-to-market._)
   - **B) 平铺异构结构** (Frontend React + Backend Go/Kotlin in separate flat folders. _Reason for Tech: Best for separated concerns and independent scaling. Reason for Non-Tech: Best for large corporate projects where frontend and backend are built by different dedicated teams._)
4. **后端语言** (Only if B is chosen):
   - **A) [Recommended] Go** (GORM + SQLite. _Reason for Tech: Starts in milliseconds, 20MB RAM under load, excellent concurrency. Reason for Non-Tech: Extremely cost-effective on servers, lightweight, and starts instantly._)
   - **B) Kotlin (Spring Boot + Gradle)** (Spring Boot JPA + H2. _Reason for Tech: Enterprise ecosystems, strict OOP, Java compatibility. Reason for Non-Tech: Best for traditional corporate compliance, heavy transactional systems, or Java-standardized teams._)
5. **是否配置数据库/ORM层** (Configure Database / ORM?):
   - **none**: 不使用数据库 (No database, keeps boilerplate static. _Reason for Non-Tech: Best for quick visual demos, client pitches, or static mock-ups. Zero database setup or maintenance required._)
   - **drizzle [Recommended for TS]**: Drizzle ORM + SQLite (仅在选择 A 全栈 TS 时可用。_Reason for Tech: Zero heavy query engines, zero setup, natively supported by Bun, 100% type-safe. Reason for Non-Tech: Standard database setup for unified TS projects._)
   - **gorm [Recommended for Go]**: GORM + SQLite (仅在选择 B Go 后端时可用。_Reason for Tech: Go's most mature ORM with rich features and community resources. Reason for Non-Tech: Standard database setup for Go projects._)
   - **jpa [Recommended for Kotlin]**: Spring Boot JPA + H2 (仅在选择 B Kotlin 后端时可用。_Reason for Tech: Enterprise-standard JPA stability and transaction management. Reason for Non-Tech: Standard database setup for Kotlin/Java projects._)
6. **是否清理演示页面** (Clean Demo Pages? y/N):
   - **[Recommended] N / No** (Keep demo pages. _Reason: Retains functional dashboards, login templates, charts, and overlay examples to serve as copy-pasteable reference code._)
   - **y / Yes** (Clean up all boilerplate code, leaving a blank startup template shell.)
7. **是否现在就配置 GitLab CI/CD** (Configure GitLab CI/CD now? y/N):
   - **[Recommended] N / No** (跟随 MVP 优先哲学，不射入 CI 文件。代码结构稳定后可再次调用本 skill 并说“为此项目加 CI”追加。)
   - **y / Yes** (一次性射入 `.gitlab-ci.yml` / `Dockerfile` / `ci-tools/` / `deploy.sh` / `compose.yml` / `compose.test.yml` / `.dockerignore`，过后需到 GitLab 项目的 CI/CD Variables 里配合环境变量，详见 `references/ci-guide.md`。)

Stop and wait for the user's response. Do NOT proceed to the pipeline phase until all inputs are resolved.

_Note on target folder validation_: Before executing the script, check if the `<TARGET_PATH>` exists and contains files other than `.git`, `.agents`, `.gemini`, `.qoder`, and `.DS_Store`. If it is not empty, warn the user in Chinese that files might be overwritten and ask if they wish to proceed. If they approve, append `--force` to the execution command.

## Phase 2: Pipeline (Execution)

Once the user approves the parameters, execute the scaffolding pipeline step-by-step.

### Step 1: Execute the Scaffolder Script

1. Locate the absolute path to this skill's folder on your machine. Let's refer to this as `<SKILL_DIR>`.
2. Run the helper script using Bun. The script automatically clones and pulls the template cache from GitLab (`git@192.168.110.2:starters/liquid-glass-starter.git`) into `~/wecode/`, falling back to the existing cache if offline.
   _Note: The script will automatically run `bun install` at the end to generate the lockfile._

Run command:

```bash
bun run <SKILL_DIR>/scripts/scaffold.ts \
  --name "<PROJECT_NAME>" \
  --target "<TARGET_PATH>" \
  --type "<monorepo|flat-go|flat-java>" \
  --clean-demo <true|false> \
  --db "<none|drizzle|gorm|jpa>" \
  [--include-ci true] \
  [--port <N> | --skip-port-alloc] \
  [--force]
```

_Only append `--include-ci true` when the user answered Y to question 7. `--include-ci` is only meaningful for `--type monorepo` in this iteration; the script warns and skips CI stamping for flat layouts._

_When `--include-ci true`, the skill will SSH to the internal test server `wecode@192.168.110.214:63022`, probe LISTEN ports, and allocate the first free port in `11081-11199`. The registry is a single team-shared file at `wecode@192.168.110.214:/home/wecode/port-registry.json` — atomic reads/writes via remote `flock` + `python3`. Details: see [`references/ci-guide.md` §9](./references/ci-guide.md). Override with `--port <N>`, or skip entirely with `--skip-port-alloc` (keeps template default 11070; user must adjust manually)._

### Step 2: Tailor Configuration & Final Cleanup

Depending on the architecture style chosen:

#### For Style A (Full-stack TS Monorepo):

- If `--clean-demo true` was selected, the script deleted the files, but you should review `<TARGET_PATH>/apps/web/src/App.tsx` and verify that the deleted page imports are removed and the default router points to a clean `DashboardPage.tsx` or empty shell.

#### For Style B (Flat Heterogeneous):

- Review `<TARGET_PATH>/frontend/vite.config.ts` and ensure the API proxy targets the correct backend port (e.g., `localhost:8080` for Go/Java).
- If `--clean-demo true` was selected, verify the demo files under `<TARGET_PATH>/frontend/src/pages/` are removed and `<TARGET_PATH>/frontend/src/App.tsx` is simplified.

### Step 3: Git Initialization

The helper script initializes the Git repository and makes the first commit. Verify that a `.gitignore` is present in the target directory and matches the language stack.

---

## Utility: Update Template Cache Only

If the user only wants to refresh the local template cache (e.g., pulling latest changes from GitLab) without scaffolding a new project, run the script with `--update-only`:

```bash
bun run <SKILL_DIR>/scripts/scaffold.ts --update-only
```

This clones (if absent) or pulls (if cached) the template repo into `~/wecode/liquid-glass-starter` and exits immediately. No `--name` or `--target` required.

---

## Utility: 为已有项目添加 CI

当用户意图为“为已有项目加 CI / 流水线 / 部署配置”时，**不要走 Phase 1 Interview**。完整行为契约、对话流程、错误处理均见 [`references/ci-guide.md` §8](./references/ci-guide.md)。

核心命令（确认后执行）：

```bash
bun run <SKILL_DIR>/scripts/scaffold.ts --mode add-ci --target "<TARGET_PATH>" [--port <N> | --skip-port-alloc] [--force]
```

默认会自动 SSH 测试机挖一个空闲端口写死到 compose\*.yml 与 .gitlab-ci.yml（端口段 11081-11199），并推送本机公钥（首次会需要本地安装 sshpass 或 expect，也可先手动跑一次 `ssh-copy-id -p 63022 wecode@192.168.110.214` 后重试）。

---

## Error Handling & Self-Correction

If the `scaffold.ts` script exits with a non-zero exit code, analyze the stderr log and self-correct:

- **"Error: Target directory is not empty..."**: Prompt the user in Chinese that the directory has files, ask if they want to overwrite, and if they confirm, rerun the command adding the `--force` flag.
- **"Failed to clone template from GitLab..."**: Inform the user in Chinese that the script could not connect to the internal GitLab IP and there is no cached template available on this machine yet. Suggest checking their VPN or network connection to the internal server.
- **Add-CI 相关错误** (`CI files already exist` / `Project structure does not match...` / `Flat layout CI is not sedimented`)：见 [`references/ci-guide.md` §8.4](./references/ci-guide.md)。

---

## Gotchas

- **Cross-platform compatibility**: The helper script uses cross-platform Node/Bun APIs. Always invoke it using `bun run` as Bun is installed in the environment.
- **Path escaping**: Ensure target paths are fully resolved absolute paths (no relative `../`).
- **OpenAPI contracts**: Remind the user that for heterogeneous architectures, they should use OpenAPI/Swagger to generate TypeScript types for the frontend instead of directly sharing types via Monorepo.

---

## Success Output Template (in Chinese)

After the pipeline completes successfully, output the result in Chinese showing the generated directory structure and instructions on how to start the project.

Example output:

```markdown
🎉 **项目初始化成功！**

您的项目已成功生成在：`<TARGET_PATH>`

### 📂 目录结构

[显示生成的树状目录结构]

### 🚀 快速启动

1. 进入项目根目录：`cd <TARGET_PATH>`
2. 启动开发服务器：
   - 全栈 TS: `bun run dev`
   - 异构结构: `task dev` (需要安装 go-task: `brew install go-task`)

### 🎨 自定义设计

- 编辑 `theme-tokens.css` 自定义主色调。
- API 服务契约可在 `services/` 目录下完成对接。
```

### Post-Success Additions

- **当未射入 CI 时**：在成功输出末尾补一句提示——“当项目稳定后需要 CI/CD 时，可重新调用 `/wecode-project-scaffolder` 并说‚为此项目加 CI‘追加。”
- **当已射入 CI 时**（init 带 `--include-ci true` 或 add-ci 成功）：在成功输出末尾追加“GitLab CI 上线清单”小节，列出必配变量（从 `references/ci-guide.md` 的“GitLab CI/CD Variables”章节提取）及首次触发方式（push main / GitLab Web UI / CI/CD Schedules）。
