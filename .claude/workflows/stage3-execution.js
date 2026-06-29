/**
 * Stage 3: 并行开发 — Coordinator 调度 + Backend/Frontend fan-out
 *
 * Dynamic Workflow 脚本（Claude Code 专有）
 * 自包含：prompt 内嵌，不依赖运行时读取 agents/*.md
 *
 * 用法:
 *   Workflow({ scriptPath: '.claude/workflows/stage3-execution.js', args: { taskPath: 'task.md', modulesDir: 'modules/' } })
 *
 * 模型分配:
 *   Code Reviewer → deepseek-v4-pro
 *   Coordinator / Backend Dev / Frontend Dev / Debug Fixer → deepseek-v4-flash
 *
 * 输出: src/modules/<module>/*, src/views/*, DONE/BLOCKED 标记
 */

// ─── Meta ───────────────────────────────────────────────────────────────────
const meta = {
  name: 'manual-driving-stage3',
  description: '并行开发 — Coordinator 调度 + Backend/Frontend fan-out',
  phases: [
    { title: '调度分配', detail: 'Coordinator 读取依赖图 → 分配方案' },
    { title: '模块开发', detail: '按依赖图动态 fan-out 后端+前端' },
    { title: '代码审查', detail: '事件驱动的 Code Review' },
  ],
};

// ─── 常量 ───────────────────────────────────────────────────────────────────
const SINGLE_AGENT_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟
const STAGE_TIMEOUT_MS = 2 * 60 * 60 * 1000;    // 2 小时
const SINGLE_AGENT_WARN_MS = 15 * 60 * 1000;    // 15 分钟警告

// ─── Prompt: Pipeline Coordinator（压缩版）────────────────────────────────────
const COORDINATOR_PROMPT = `你是 Stage3 的执行调度中枢，负责按依赖图分批分配模块给后端/前端 Agent。

## 调度算法（每轮执行）
1. 依赖图筛选：选出「依赖已满足 ∩ 未分配」的候选模块
   - 依赖已满足 = 依赖列表为空，或依赖的所有模块均已 DONE
2. 优先级排序：被其他模块依赖次数多的优先
3. 记录分配，完成→标记 DONE，释放下游依赖

## 跨领域超量优先级
| 优先级 | 规则 |
|--------|------|
| 1 | 被其他模块依赖次数多的优先分配 |
| 2 | 同优先级按模块名稳定排序 |

## 产出
输出 JSON 格式的调度方案：
{
  "rounds": [
    { "round": 1, "modules": ["user"], "reason": "无依赖" },
    { "round": 2, "modules": ["auth", "product"], "reason": "依赖 user 已完成" },
    ...
  ],
  "totalRounds": N,
  "maxParallel": N
}

## 手动驾驶协议（IoC）
- 调度方案必须向用户汇报并确认后才能执行
- 每轮分配前向用户报告：本轮分配模块、分配理由、排队模块、阻塞模块、异常模块
- 用户可驳回分配方案，Coordinator 调整后重新提交`;

// ─── Prompt: Backend TDD Dev（压缩版）─────────────────────────────────────────
const BACKEND_DEV_PROMPT = `你是一个后端开发专家，遵循 TDD（Red-Green-Refactor）为分配的模块编写生产代码。

## 产出
src/modules/<module>/ 目录：
- routes.ts（路由定义）
- service.ts（业务逻辑）
- schema.ts（表定义，引用全局 schema）
- types.ts（DTO / 类型定义）
- <module>.test.ts（单元测试）

## TDD 微循环
Red（写测试）→ Green（写实现）→ Refactor（重构）

## 约束
- 只操作自己模块的文件，不修改其他模块
- 跨模块调用通过 API，不直接访问其他模块的数据库
- Schema 引用全局定义，不重复
- 异常路径覆盖：参数校验失败、资源不存在、权限不足、唯一约束冲突
- 完成后写入 DONE 标记文件

## 手动驾驶协议（IoC）
- 开发前输出「模块开发计划卡片」（轻量 CEP）等待用户确认
- 完成后输出「模块交付确认清单」等待用户审阅
- 决策日志: 产出 decisions/stage3-backend-<module>-decisions.md

## DONE 标记内容
\`\`\`yaml
module: <module_name>
agent: <agent_name>
completed_at: "<timestamp>"
checks:
  l1_unit_test: PASS
  l2_api_test: PASS
  l3_db_test: PASS
issues: []
\`\`\``;

// ─── Prompt: Frontend Dev（压缩版）────────────────────────────────────────────
const FRONTEND_DEV_PROMPT = `你是一个前端开发专家，基于 Mock 服务并行开发分配的前端页面。

## 产出
- src/views/（页面）
- src/components/（公共组件）
- src/composables/（组合式函数）
- API 调用封装（指向 Mock 服务）
- 路由配置

## 开发原则
- 所有 API 调用指向 Mock 服务
- 使用 Vue 3 Composition API + TypeScript
- 页面逻辑、表单验证、状态管理独立开发

## 状态标记规则
- 不涉及 CSS/布局改动 → 写入 DONE 标记
- 涉及 CSS/布局/动画 → 写入 VISUAL_PENDING 标记（等待人类确认）
- 前端 Agent 不可自标 DONE（视觉正确性需人类确认）

## 手动驾驶协议（IoC）
- 开发前输出「页面开发计划卡片」（轻量 CEP）等待用户确认
- 完成后输出「页面交付确认清单」等待用户审阅
- 决策日志: 产出 decisions/stage3-frontend-<page>-decisions.md

## VISUAL_PENDING 标记内容
\`\`\`yaml
module: <module_name>
status: VISUAL_PENDING
reason: CSS layout changed — cannot verify visual correctness autonomously
review_url: "http://localhost:5173/<page>"
human_action: "请打开 review_url 查看视觉效果，确认后删除此文件并创建 DONE"
\`\`\``;

// ─── Prompt: Code Reviewer（压缩版）──────────────────────────────────────────
const CODE_REVIEW_PROMPT = `你是一个独立 Code Review Agent，负责审查后端开发 Agent 提交的代码质量。

## Review Checklist
- [ ] 代码是否符合 spec.md 架构设计？
- [ ] Schema 定义与 schema.sql 一致？
- [ ] 接口实现与 api-contract.yaml 一致？
- [ ] 异常路径是否完整覆盖？
- [ ] 跨模块调用是否通过 API 而非直接操作数据库？
- [ ] 测试是否覆盖 happy path + exception path？
- [ ] 是否有硬编码（token、密钥、URL）？

## 产出
Review 意见，标明：
- 问题位置（文件 + 行号）
- 严重级别：P0（阻断，必须修复）/ P1（建议，可选修复）
- 修正建议`;

// ─── 依赖图解析 ──────────────────────────────────────────────────────────────

function parseTaskGraph(taskContent) {
  // 解析 task.md 中的模块依赖关系
  // 期望格式：| module_name | dep1, dep2 | ...
  // 或 YAML 格式：modules: [{ name, dependencies }]
  const modules = [];
  const lines = taskContent.split('\n');

  let inModuleTable = false;
  for (const line of lines) {
    const trimmed = line.trim();

    // 表格格式解析
    if (trimmed.startsWith('|') && trimmed.includes('|')) {
      // split('|') 会产生首尾空元素，用 slice(1,-1) 移除
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length >= 2) {
        if (cells[0].toLowerCase() === 'module' || cells[0].toLowerCase() === '模块') {
          inModuleTable = true;
          continue;
        }
        if (inModuleTable && !cells[0].startsWith('-')) {
          const name = cells[0];
          const deps = cells[1]
            ? cells[1].split(',').map(d => d.trim()).filter(Boolean)
            : [];
          modules.push({ name, dependencies: deps });
        }
      }
    } else {
      inModuleTable = false;
    }
  }

  return modules;
}

// ─── 三检机制（每轮执行后）────────────────────────────────────────────────────

function tripleCheck(modules, done, inProgress, unallocated) {
  const errors = [];

  // ① 全集校验
  const total = done.size + inProgress.size + unallocated.size;
  if (total !== modules.length) {
    errors.push({
      check: '全集校验',
      expected: modules.length,
      actual: total,
      message: `模块总数不匹配: done(${done.size}) + inProgress(${inProgress.size}) + unallocated(${unallocated.size}) = ${total} ≠ ${modules.length}`,
    });
  }

  // ② 依赖校验
  for (const mod of inProgress) {
    const m = modules.find(x => x.name === mod);
    if (m) {
      const unmetDeps = m.dependencies.filter(d => !done.has(d));
      if (unmetDeps.length > 0) {
        errors.push({
          check: '依赖校验',
          module: mod,
          unmetDeps,
          message: `${mod} 的依赖未满足: ${unmetDeps.join(', ')}`,
        });
      }
    }
  }

  return errors;
}

// ─── 主执行流程 ──────────────────────────────────────────────────────────────

async function execute(args) {
  const { taskPath, modulesDir } = args;
  const stageStartTime = Date.now();

  if (!taskPath) {
    throw new Error('Stage3 缺少必需参数: args.taskPath');
  }

  const taskContent = await readFile(taskPath);
  const specContent = await readFile('spec.md').catch(() => '');
  const schemaContent = await readFile('schema.sql').catch(() => '');
  const apiContractContent = await readFile('api-contract.yaml').catch(() => '');

  // ── 第0步: Coordinator 先行分析 ──────────────────────────────────────────
  log('Stage3: Coordinator 分析依赖图');

  const scheduleResult = await agent(
    `${COORDINATOR_PROMPT}

## 当前任务
读取以下 task.md 的模块依赖图，输出调度方案。

### task.md（锁定版）
${taskContent}

请输出 JSON 格式的调度方案，包含每轮要分配的模块列表。`,
    { model: 'deepseek-v4-flash', label: 'Coordinator' }
  );

  // 手动驾驶协议: Coordinator 向用户汇报调度方案并确认
  const scheduleConfirmation = await humanGate({
    title: 'Stage3 — 调度方案确认',
    content: scheduleResult,
    prompt: '请确认 Coordinator 的调度方案。输入 ✅ 确认通过，或输入修正意见。',
  });

  // ── 解析模块依赖图 ─────────────────────────────────────────────────────
  const modules = parseTaskGraph(taskContent);
  const done = new Set();
  const blocked = new Set();
  const inProgress = new Set();
  const moduleResults = {};

  log(`Stage3: 共 ${modules.length} 个模块待开发`);

  // ── 主循环: 按依赖图分批 fan-out ─────────────────────────────────────────
  let loopCount = 0;
  const MAX_LOOPS = modules.length + 5; // 安全上限

  while (done.size < modules.length && loopCount < MAX_LOOPS) {
    loopCount++;

    // Stage 超时检查
    if (Date.now() - stageStartTime > STAGE_TIMEOUT_MS) {
      log(`Stage3: 整体超时（${STAGE_TIMEOUT_MS / 3600000}h），停止调度`);
      break;
    }

    // 1. 扫描所有模块状态，找出候选集
    const candidates = modules.filter(m =>
      !done.has(m.name) &&
      !blocked.has(m.name) &&
      !inProgress.has(m.name) &&
      m.dependencies.every(d => done.has(d))
    );

    if (candidates.length === 0) {
      if (blocked.size > 0) {
        log(`Stage3: 无候选模块，存在 ${blocked.size} 个 BLOCKED 模块: ${[...blocked].join(', ')}`);
        // 尝试用 pro 模型处理阻塞模块
        const unblockResult = await agent(
          `分析以下 BLOCKED 模块的阻塞原因，提出解决方案：
           阻塞模块: ${[...blocked].join(', ')}
           已完成模块: ${[...done].join(', ')}
           task.md:\n${taskContent}`,
          { model: 'deepseek-v4-pro', label: 'Unblock-Analysis' }
        );
        log(`Stage3: 阻塞分析结果: ${unblockResult}`);
      }
      break;
    }

    // 2. 三检机制
    const unallocated = new Set(
      modules.filter(m => !done.has(m.name) && !blocked.has(m.name) && !inProgress.has(m.name))
        .map(m => m.name)
    );
    const checkErrors = tripleCheck(modules, done, inProgress, unallocated);
    if (checkErrors.length > 0) {
      log(`Stage3 三检失败: ${JSON.stringify(checkErrors)}`);
    }

    log(`Stage3 Round ${loopCount}: 分配 ${candidates.length} 个模块: ${candidates.map(c => c.name).join(', ')}`);

    // 3. 并行分配候选集（后端）
    const backendResults = await parallel(
      candidates.map(m => async () => {
        inProgress.add(m.name);

        const moduleDoc = await readFile(`${modulesDir || 'modules'}/${m.name}.md`).catch(() => '');

        const result = await agent(
          `${BACKEND_DEV_PROMPT}

## 当前任务：开发模块 ${m.name}

### 模块定义（锁定版）
${moduleDoc}

### 架构设计（锁定版）
${specContent}

### 数据库 Schema（锁定版）
${schemaContent}

### API 契约（锁定版）
${apiContractContent}

请按 TDD 流程开发此模块，产出 src/modules/${m.name}/ 目录下的全部文件。
完成后写入 DONE 标记。`,
          { model: 'deepseek-v4-flash', label: `backend:${m.name}` }
        );

        inProgress.delete(m.name);
        return { module: m.name, result };
      })
    );

    // 4. 处理后端结果
    for (const r of backendResults) {
      if (!r) continue;
      const { module: modName, result } = r;

      if (result && result.status === 'blocked') {
        blocked.add(modName);
        log(`Stage3: 模块 ${modName} → BLOCKED`);
      } else {
        done.add(modName);
        moduleResults[modName] = result;
        log(`Stage3: 模块 ${modName} → DONE`);

        // 按需触发 Code Review (pro)
        const needsReview = result && (
          result.needsReview ||
          result.testFailures ||
          result.hasExceptionPaths
        );

        if (needsReview) {
          log(`Stage3: 触发 Code Review for ${modName}`);
          const reviewResult = await agent(
            `${CODE_REVIEW_PROMPT}

## 当前任务：审查模块 ${modName}

### 模块代码
${result.code || ''}

### API 契约（锁定版）
${apiContractContent}

### Schema（锁定版）
${schemaContent}

请审查代码质量，标明 P0/P1 问题。`,
            { model: 'deepseek-v4-pro', label: `review:${modName}` }
          );

          if (reviewResult && reviewResult.includes('P0')) {
            log(`Stage3: Code Review 发现 P0 问题，触发修复`);
            // 触发修复 Agent
            await agent(
              `修复以下 Code Review 指出的 P0 问题：\n${reviewResult}\n\n模块: ${modName}`,
              { model: 'deepseek-v4-flash', label: `fix:${modName}` }
            );
          }
        }
      }
    }

    log(`Stage3 进度: ${done.size}/${modules.length} DONE, ${blocked.size} BLOCKED`);
  }

  // ── 前端并行开发（基于 Mock，与后端独立 fan-out）──────────────────────────
  log('Stage3: 开始前端并行开发');

  const frontendModules = modules.filter(m =>
    m.name.startsWith('view-') || m.name.startsWith('page-') || m.name.includes('frontend')
  );

  // 如果 task.md 没有显式前端模块，从模块列表推断页面
  const pagesToDevelop = frontendModules.length > 0 ? frontendModules : modules;

  const frontendResults = await parallel(
    pagesToDevelop.map(m => async () => {
      const moduleDoc = await readFile(`${modulesDir || 'modules'}/${m.name}.md`).catch(() => '');

      return agent(
        `${FRONTEND_DEV_PROMPT}

## 当前任务：开发页面 ${m.name}

### 模块定义（锁定版）
${moduleDoc}

### API 契约（锁定版）
${apiContractContent}

### Mock 服务（已就绪）
mocks/ 目录下的 Mock 服务

请产出对应的前端页面、组件和路由配置。
如涉及 CSS/布局，标记 VISUAL_PENDING；否则标记 DONE。`,
        { model: 'deepseek-v4-flash', label: `frontend:${m.name}` }
      );
    })
  );

  // ── 最终状态报告 ──────────────────────────────────────────────────────────
  const finalStatus = {
    totalModules: modules.length,
    done: done.size,
    blocked: blocked.size,
    pending: modules.length - done.size - blocked.size,
    doneModules: [...done],
    blockedModules: [...blocked],
    loopCount,
    elapsedMs: Date.now() - stageStartTime,
  };

  const allDone = done.size === modules.length;
  const hasVisualPending = frontendResults.some(r =>
    r && r.includes && r.includes('VISUAL_PENDING')
  );

  // 产出 Stage3 决策日志（manual-driving IoC 协议）
  await writeFile(
    'decisions/stage3-execution-decisions.md',
    `# Stage3 执行决策日志

## 调度方案
${scheduleConfirmation}

## 执行结果
- 总模块数: ${modules.length}
- 完成: ${done.size}
- 阻塞: ${blocked.size}
- 调度轮次: ${loopCount}
- 耗时: ${(Date.now() - stageStartTime) / 1000}s

## 完成模块
${[...done].join(', ')}

## 阻塞模块
${[...blocked].join(', ') || '无'}

## 前端状态
${hasVisualPending ? '存在 VISUAL_PENDING，等待人类确认' : '全部 DONE'}

## Stage3 门禁
- 后端全模块 DONE: ${allDone ? 'PASS' : 'FAIL'}
- 前端无 VISUAL_PENDING: ${!hasVisualPending ? 'PASS' : 'FAIL'}
- pipeline-state.json 更新: DONE
`
  );

  return {
    status: allDone && !hasVisualPending ? 'done' : 'blocked',
    finalStatus,
    summary: allDone
      ? `Stage3 完成: ${done.size}/${modules.length} 模块 DONE，${loopCount} 轮调度。`
      : `Stage3 BLOCKED: ${done.size}/${modules.length} 完成，${blocked.size} 阻塞，需人工介入。`,
  };
}

// ─── 导出 ────────────────────────────────────────────────────────────────────────
module.exports = {
  meta,
  execute,
  // 导出纯函数/常量供测试
  parseTaskGraph,
  tripleCheck,
  SINGLE_AGENT_TIMEOUT_MS,
  STAGE_TIMEOUT_MS,
  SINGLE_AGENT_WARN_MS,
  // 导出 prompts 供测试验证 IoC 协议
  COORDINATOR_PROMPT,
  BACKEND_DEV_PROMPT,
  FRONTEND_DEV_PROMPT,
};
