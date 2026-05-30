---
name: kf-mvp-integration
description: >-
  Load when user asks to integrate frontend and backend, run integration tests,
  or verify system end-to-end. Triggers: 集成, 联调, 前后端集�? integration,
  前后端联�? 系统验证, 验收测试. Also load when Stage4 integration
  is needed.
metadata:
  pattern: pipeline
  domain: mvp-stage4
recommended_model: qwen-3.7-Max
graph:
  dependencies:
    - target: kf-mvp-backend-tdd
      type: sequential
    - target: kf-mvp-frontend-dev
      type: sequential
    - target: kf-mvp-test-single
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Integration Specialist �?集成验证技�?

> **Core Belief**: Integration is where the real system meets the designed system. The goal: swap mock for real API with zero user-visible changes.

**Division of Labor**: This Skill focuses on **frontend-backend integration** and **system verification**. It outputs integration test reports and bug fixes. Follows Pipeline pattern with strict phase gates.

---

# Core Philosophy

Derived from MVP Whitepaper Section 4 �?集成与验�?

1. **Mock to real swap** �?Change API URL, nothing else should change
2. **Schema consistency** �?Verify all API contracts are honored
3. **End-to-end verification** �?Every PRD acceptance criterion must pass
4. **Bug fix loop** �?Issues found �?fixed �?retested until clean

---

# Integration Workflow

```
┌─ Integration Workflow ──────────────────────────────────�?
�?                                                         �?
�? Phase 1: Backend Merge                                 �?
�?   �?Merge all module routes to unified entry           �?
�?   �?Verify global Schema consistency                  �?
�?   �?Run all unit tests (must pass)                     �?
�?                                                         �?
�? Phase 2: Frontend Integration                         �?
�?   �?Swap mock API �?real API URL                      �?
�?   �?Verify all API calls work                        �?
�?   �?Check response format compatibility              �?
�?                                                         �?
�? Phase 3: Integration Tests                           �?
�?   �?Run all integration tests                        �?
�?   �?Execute E2E scenarios                            �?
�?   �?Document failures                               �?
�?                                                         �?
�? Phase 4: Bug Fix Loop                                �?
�?   �?For each failure: investigate �?fix �?retest    �?
�?   �?Loop until all tests pass                       �?
�?                                                         �?
└──────────────────────────────────────────────────────────�?
```

---

# Stage 1: Backend Merge

## Route Consolidation

```typescript
// src/index.ts (before)
import { Hono } from 'hono';
import { userRoutes } from './modules/user/routes';
import { productRoutes } from './modules/product/routes';

const app = new Hono();

// Each module as separate route
app.route('/api/users', userRoutes);
app.route('/api/products', productRoutes);

export default app;
```

## Schema Verification

**Check each module:**
- [ ] All tables defined in global schema
- [ ] No conflicting column definitions
- [ ] Foreign keys reference existing tables
- [ ] Indexes don't conflict

**Output**:
```markdown
## Schema一致性检�?

| 模块 | �?| 状�?| 问题 |
|------|-----|------|------|
| user | users | �?| - |
| product | products | �?| - |
| trace | trace_codes | �?| 缺少索引 |

**问题清单**:
- [ ] WARNING: trace_codes表缺少code索引
```

## Unit Test Verification

```bash
# Run all unit tests
npm test

# Expected: all tests pass
# If any fail �?fix before proceeding
```

---

# Stage 2: Frontend Integration

## API URL Swap

**Development (.env)**:
```
VITE_API_BASE_URL=http://localhost:3001/api
```

**Production (.env)**:
```
VITE_API_BASE_URL=https://api.example.com/api
```

## Integration Verification Steps

1. **Start real backend**
   ```bash
   npm run dev:backend
   ```

2. **Verify frontend can reach backend**
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Test each API call**
   - [ ] Login works
   - [ ] CRUD operations work
   - [ ] Error responses handled
   - [ ] Authentication persists

## Verification Template

```markdown
## API联调检�?

| 模块 | API | 前端→后�?| 后端→前�?| 状�?|
|------|-----|----------|----------|------|
| auth | POST /auth/login | �?| �?| 通过 |
| user | GET /users | �?| �?| 通过 |
| product | POST /products | �?| �?| 400错误 |

**问题清单**:
- [ ] product创建返回400，字段类型不匹配
```

---

# Stage 3: Integration Tests

## Test Execution

```bash
# Run all integration tests
npm run test:integration

# Run E2E scenarios
npm run test:e2e

# Run full test suite
npm run test:all
```

## Async Flow Integration Testing (MUST �?迭代5核心修复)

**问题**：O2O/电商等系统有大量异步流程（下单→派单→骑手接单→配送→完成），之前异步状态同步bug只在人工测试时发现（如：订单已配送但状态未更新）�?

**解决方案**：MUST 编写 **异步流程集成测试**，覆盖轮询、WebSocket、事件驱动三种模式�?

### 异步流程测试模板

```typescript
// integration-tests/async/order-delivery-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestFactory } from '../factories/TestFactory';

describe('O2O Async Flow �?Order to Delivery', () => {
  const factory = new TestFactory();

  beforeAll(async () => { await factory.setup(); });
  afterAll(async () => { await factory.cleanup(); });

  // 模式1：轮询模式测�?
  describe('Polling Mode', () => {
    it('should update order status through polling', async () => {
      // 1. 创建订单
      const order = await factory.createOrder({ items: [{ productId: 1, qty: 2 }] });
      expect(order.status).toBe('PENDING');

      // 2. 模拟派单（后台任务）
      await factory.simulateDispatch(order.id);

      // 3. 轮询等待状态变更（MUST：不是固定sleep�?
      const finalStatus = await factory.pollForStatus(
        order.id,
        'DISPATCHED',
        { interval: 500, timeout: 10000 } // 500ms轮询，最�?0�?
      );
      expect(finalStatus).toBe('DISPATCHED');

      // 4. 验证状态流转时间戳
      const updated = await factory.getOrder(order.id);
      expect(updated.dispatchedAt).toBeInstanceOf(Date);
      expect(updated.dispatchedAt.getTime()).toBeGreaterThan(order.createdAt.getTime());
    });

    it('should timeout if status never changes', async () => {
      const order = await factory.createOrder({ items: [{ productId: 1, qty: 2 }] });
      
      // 不触发派单，直接轮询
      await expect(
        factory.pollForStatus(order.id, 'DISPATCHED', { interval: 100, timeout: 1000 })
      ).rejects.toThrow('Polling timeout');
    });
  });

  // 模式2：WebSocket模式测试
  describe('WebSocket Mode', () => {
    it('should receive status update via WebSocket', async () => {
      const order = await factory.createOrder({ items: [{ productId: 1, qty: 2 }] });
      
      // 建立WebSocket连接
      const ws = await factory.connectWebSocket(`/ws/orders/${order.id}`);
      const messages: any[] = [];
      ws.onMessage((msg) => messages.push(msg));

      // 触发派单
      await factory.simulateDispatch(order.id);

      // MUST：等待WebSocket消息（不是固定sleep�?
      await factory.waitForMessage(ws, (msg) => msg.type === 'STATUS_UPDATE', 5000);

      expect(messages).toContainEqual(
        expect.objectContaining({ type: 'STATUS_UPDATE', status: 'DISPATCHED' })
      );

      ws.close();
    });

    it('should handle WebSocket reconnection', async () => {
      const order = await factory.createOrder({ items: [{ productId: 1, qty: 2 }] });
      const ws = await factory.connectWebSocket(`/ws/orders/${order.id}`);
      
      // 模拟断线
      ws.simulateDisconnect();
      
      // MUST：自动重连后仍能收到消息
      await factory.waitForConnection(ws, 3000);
      
      await factory.simulateDispatch(order.id);
      await factory.waitForMessage(ws, (msg) => msg.type === 'STATUS_UPDATE', 5000);
      
      ws.close();
    });
  });

  // 模式3：事件驱动模式测�?
  describe('Event-Driven Mode', () => {
    it('should process events in correct order', async () => {
      const events: string[] = [];
      
      // 订阅事件
      factory.onEvent('order.created', () => events.push('created'));
      factory.onEvent('order.dispatched', () => events.push('dispatched'));
      factory.onEvent('order.delivered', () => events.push('delivered'));

      // 执行完整流程
      const order = await factory.createOrder({ items: [{ productId: 1, qty: 2 }] });
      await factory.simulateDispatch(order.id);
      await factory.simulateDelivery(order.id);

      // MUST：事件顺序正�?
      expect(events).toEqual(['created', 'dispatched', 'delivered']);
    });

    it('should handle event duplication (idempotency)', async () => {
      let deliveryCount = 0;
      factory.onEvent('order.delivered', () => { deliveryCount++; });

      const order = await factory.createOrder({ items: [{ productId: 1, qty: 2 }] });
      await factory.simulateDelivery(order.id);
      await factory.simulateDelivery(order.id); // 重复发�?

      // MUST：幂等，只处理一�?
      expect(deliveryCount).toBe(1);
    });
  });

  // 端到端完整流程测�?
  describe('Full E2E Flow', () => {
    it('should complete order �?dispatch �?pickup �?delivery flow', async () => {
      // Step 1: 用户下单
      const user = await factory.createUser({ role: 'consumer' });
      const token = await factory.login(user);
      const order = await factory.createOrder({
        items: [{ productId: 1, qty: 2 }],
        address: '123 Main St'
      }, token);
      expect(order.status).toBe('PENDING');

      // Step 2: 系统派单（异步）
      await factory.simulateDispatch(order.id);
      const dispatched = await factory.pollForStatus(order.id, 'DISPATCHED', { timeout: 10000 });
      expect(dispatched).toBe('DISPATCHED');

      // Step 3: 骑手接单
      const rider = await factory.createUser({ role: 'rider' });
      const riderToken = await factory.login(rider);
      await factory.riderAccept(order.id, riderToken);
      const accepted = await factory.pollForStatus(order.id, 'PICKING_UP', { timeout: 5000 });
      expect(accepted).toBe('PICKING_UP');

      // Step 4: 骑手取货
      await factory.riderPickup(order.id, riderToken);
      const pickedUp = await factory.pollForStatus(order.id, 'IN_TRANSIT', { timeout: 5000 });
      expect(pickedUp).toBe('IN_TRANSIT');

      // Step 5: 送达
      await factory.riderDeliver(order.id, riderToken);
      const delivered = await factory.pollForStatus(order.id, 'DELIVERED', { timeout: 5000 });
      expect(delivered).toBe('DELIVERED');

      // Step 6: 验证最终状�?
      const finalOrder = await factory.getOrder(order.id);
      expect(finalOrder.status).toBe('DELIVERED');
      expect(finalOrder.riderId).toBe(rider.id);
      expect(finalOrder.deliveredAt).toBeInstanceOf(Date);
    });
  });
});
```

### 异步测试辅助函数

```typescript
// tests/helpers/async-helpers.ts

export async function pollForCondition<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  options: { interval?: number; timeout?: number } = {}
): Promise<T> {
  const { interval = 500, timeout = 10000 } = options;
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const result = await fn();
    if (predicate(result)) return result;
    await new Promise(r => setTimeout(r, interval));
  }
  
  throw new Error(`Polling timeout after ${timeout}ms`);
}

export async function waitForMessage(
  ws: WebSocket,
  predicate: (msg: any) => boolean,
  timeout: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), timeout);
    const handler = (msg: any) => {
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.offMessage(handler);
        resolve(msg);
      }
    };
    ws.onMessage(handler);
  });
}
```

### 异步流程测试覆盖率要�?

| 测试类型 | 最低数�?| 说明 |
|---------|---------|------|
| 轮询模式 | 每个异步状�?| 状态变更轮�?+ 超时测试 |
| WebSocket模式 | 每个实时推�?| 消息接收 + 重连 + 断线 |
| 事件驱动 | 每个事件类型 | 顺序 + 幂等 + 丢失恢复 |
| 完整E2E | 每个主流�?| 从下单到完成的完整链�?|
| 错误恢复 | 每个故障�?| 超时、断线、重复、死�?|

## Test Report Template

```markdown
# 集成测试报告

**执行时间**: [timestamp]
**执行结果**: [PASS/FAIL]

## 测试结果汇�?

| 测试类型 | 总数 | 通过 | 失败 | 通过�?|
|---------|------|------|------|--------|
| 单元测试 | [N] | [N] | [0] | 100% |
| 模块集成测试 | [N] | [N] | [N] | [X%] |
| 场景测试 | [N] | [N] | [N] | [X%] |

## 失败的测�?

### [Test Name]
**类型**: [单元/集成/场景]
**模块**: [module]
**错误**:
```
[error output]
```
**原因分析**: [原因]
**修复方案**: [方案]
```

---

# Stage 4: Bug Fix Loop

## Bug Classification

| Severity | Definition | Action |
|----------|-------------|--------|
| BLOCKER | Core flow broken | Fix immediately |
| HIGH | Feature impaired | Fix same day |
| MEDIUM | Minor issue | Fix within week |
| LOW | Cosmetic | Fix in next sprint |

## Fix Workflow

```markdown
## Bug #[N] 修复

**标题**: [bug title]
**严重级别**: [BLOCKER/HIGH/MEDIUM/LOW]
**发现阶段**: [集成测试/E2E测试/手动验证]

### 根因分析
[analysis]

### 修复方案
[code changes]

### 回归测试
[new test or verification steps]

### 验证结果
[ ] 修复已验�?
[ ] 回归测试通过
```

---

# Stage4 四步合并流程

> Stage4 Coordinator 主导的模块合并流�?

```
Step 1: 模块分组
  └── 按原子表组（atomic_group）分组，同组模块一起合�?
  �?
Step 2: 契约校验
  └── 验证 api-contract.yaml �?实际实现的一致�?
  └── 运行 npm run mock:verify
  �?
Step 3: Merge + Migrate
  └── 合并各模块代码到主分�?
  └── 执行 Drizzle Migration（Stage4 首次迁移�?
  └── Stage3 开发期间用 db:push，Stage4 merge 后用 migrate
  �?
Step 4: 集成测试
  └── 运行全量测试套件
  └── Happy Path 通过�?100% + Exception Path �?0%
  └── 检�?race-condition-warnings.md
```

## 切换策略

按模块逐个切换 Mock �?Real�?

```typescript
// src/api/config.ts �?切换示例
moduleBaseURL: {
  auth: 'http://localhost:3000/api',     // �?已切换到真实后端
  user: 'http://localhost:3000/api',     // �?已切�?
  product: 'http://localhost:3001/api',  // �?仍使�?Mock
  trace: 'http://localhost:3001/api',    // �?仍使�?Mock
}
```

切换节奏：每个模块后�?DONE + CR 通过后，前端对应页面即可切换�?

## 回滚协议

```
切换后发�?Bug
  �?
标记该模块为 BLOCKED
  �?
回退 baseURL �?Mock 服务�?
  �?
Debug Agent 接收修复任务
  �?
修复验证通过 �?再次切换�?Real
```

---

# Acceptance Criteria Verification

## PRD验收标准核对

| PRD标准 | 对应测试 | 执行结果 |
|---------|----------|----------|
| 用户可登�?| auth.test.ts | �?PASS |
| 可创建产�?| product.test.ts | �?PASS |
| 溯源码正确生�?| trace.test.ts | �?FAIL |

## Final Acceptance Check

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E scenarios pass
- [ ] All PRD acceptance criteria verified
- [ ] No known bugs with HIGH or BLOCKER severity
- [ ] Performance acceptable

---

# Integration Checklist

## Pre-Integration
- [ ] Backend fully implemented
- [ ] Frontend fully implemented
- [ ] Mock tests written and pass
- [ ] Schema locked

## During Integration
- [ ] API URL swapped
- [ ] Auth flow verified
- [ ] CRUD operations verified
- [ ] Error handling verified
- [ ] No console errors

## Post-Integration
- [ ] All tests pass
- [ ] All acceptance criteria met
- [ ] Performance acceptable
- [ ] Documentation updated

---

# Constraints

**MUST DO:**
- Run full test suite before declaring success
- Fix all BLOCKER and HIGH issues
- Verify all PRD acceptance criteria
- Document all test failures

**MUST NOT DO:**
- Skip integration tests
- Ignore failing tests
- Change contracts without review
- Skip regression testing

---

# Gotchas

- **CORS** �?Backend must allow frontend origin
- **Auth token format** �?Ensure Bearer token matches backend expectation
- **Response timing** �?Real API may be slower than mock, handle loading states
- **Null handling** �?Real backend may return null where mock returns empty
- **Date formats** �?Backend may use different date format than mock
- **四步合并** �?Stage4 Coordinator 主导：模块分�?�?契约校验 �?Merge �?migrate �?集成测试
- **通过率阈�?* �?Happy Path 100%（不通过不能 DONE）；Exception Path �?0%（允许已知问题记录）
- **逐模块切�?* �?按模块逐个切换 Mock→Real，不要一次性全切。在 `api.config.ts` 中按模块映射 baseURL
- **回滚协议** �?切换后发现问�?�?标记该模�?BLOCKED �?回退�?Mock �?Debug Agent 修复 �?再次切换