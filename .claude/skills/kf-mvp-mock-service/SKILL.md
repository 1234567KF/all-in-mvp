---
name: kf-mvp-mock-service
description: >-
  Load when user asks to create mock API, setup mock server, or generate mock
  data for frontend development. Triggers: mock, 模拟服务, 接口模拟, mock server,
  模拟数据, mock数据, 生成mock. NOT for: production API stubs, contract testing,
  or backend service mocking.
metadata:
  pattern: generator
  domain: mvp-stage2
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-arch-expert
      type: sequential
    - target: all-in-mvp
      type: semantic
---

# MVP Mock Service — Mock服务生成技能

> **Core Belief**: Frontend should never wait for backend. Mock first, develop in parallel, swap when real API is ready.

**Division of Labor**: This Skill focuses on **mock service generation** based on api-contract.yaml. It outputs a standalone mock server with realistic responses. Follows Generator pattern with strict templates.

**Default Tech Stack Context**:
- Mock server runs alongside Hono backend (same framework, same response format)
- OR: Standalone mock using Hono for consistency
- Response format MUST match real API: `{ success, data/error }`
- Seed data in `backend/src/seed.ts` for shared use

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **Mock is based on contract** — api-contract.yaml is the only source of truth
2. **Realistic responses** — Mock data should look real (seed data, variations)
3. **Same framework as backend** — Use Hono for mock server (not Express) to ensure behavior consistency
4. **Failure simulation** — Can simulate error cases for frontend error handling
5. **Shared seed data** — Mock and real backend use same seed data source

---

# Output Artifacts

> **模块组织原则**：Mock 文件按业务模块组织，与 biz-expert 的 `<module>.md` 定义一一对应。每个模块一个 route 文件 + 一个 data 文件。

```
mocks/
├── server.ts              # Mock server entry
├── routes/
│   ├── auth.ts           # Auth mock routes（对应 auth 模块）
│   ├── users.ts          # Users mock routes（对应 user 模块）
│   ├── products.ts       # Products mock routes（对应 product 模块）
│   └── ...（每个 <module>.md 对应一个 route 文件）
├── data/
│   ├── users.json       # Seed data（与 routes/users.ts 对应）
│   ├── products.json     # Seed data（与 routes/products.ts 对应）
│   └── ...
└── utils/
    └── delay.ts          # Simulate network latency
```

> **模块对应规则**：biz-expert 定义的每个 `<module>.md` 中的接口清单 → `mocks/routes/<module>.ts`，数据表 → `mocks/data/<module>.json`。新增模块时同步新增对应 mock 文件。

---

# Stage 1: Read API Contract

**Confirm inputs**:
- [ ] api-contract.yaml is available
- [ ] `<module>.md` files are available

**Extract**:
- All routes and methods
- Request/Response DTOs
- Error codes

---

# Stage 2: Server Setup

## Express Mock Server Template

```typescript
// mocks/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { productRoutes } from './routes/products';

const app = express();

app.use(cors());
app.use(express.json());

// Simulate network latency (100-500ms)
app.use((req, res, next) => {
  const delay = Math.floor(Math.random() * 400) + 100;
  setTimeout(next, delay);
});

// Auth middleware simulation
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token === 'mock-token') {
    req.headers['x-user-id'] = '1';
    req.headers['x-user-role'] = 'admin';
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Mock server error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Mock server error'
    }
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Mock server running on http://localhost:${PORT}`);
});
```

---

# Stage 3: Route Implementation

## Auth Mock Routes

```typescript
// mocks/routes/auth.ts
import { Router } from 'express';

export const authRoutes = Router();

authRoutes.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Valid mock credentials
  if (email === 'admin@example.com' && password === 'password') {
    return res.json({
      success: true,
      data: {
        token: 'mock-token',
        user: {
          id: 1,
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin'
        }
      }
    });
  }

  // Invalid credentials
  return res.status(401).json({
    success: false,
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password'
    }
  });
});

authRoutes.post('/register', (req, res) => {
  const { email, password, name } = req.body;

  // Check for duplicate
  if (email === 'existing@example.com') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'EMAIL_EXISTS',
        message: 'Email already registered'
      }
    });
  }

  // Success
  return res.status(201).json({
    success: true,
    data: {
      token: 'mock-token-new',
      user: {
        id: Math.floor(Math.random() * 10000),
        email,
        name,
        role: 'user'
      }
    }
  });
});
```

## CRUD Mock Routes Template

```typescript
// mocks/routes/{module}.ts
import { Router } from 'express';
import seedData from '../data/{module}.json';

export const {module}Routes = Router();

let {module}s = [...seedData];

// GET list
{module}Routes.get('/', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const start = (Number(page) - 1) * Number(limit);
  const end = start + Number(limit);

  return res.json({
    success: true,
    data: {
      list: {module}s.slice(start, end),
      total: {module}s.length,
      page: Number(page),
      limit: Number(limit)
    }
  });
});

// GET by id
{module}Routes.get('/:id', (req, res) => {
  const { id } = req.params;
  const item = {module}s.find(i => i.id === parseInt(id));

  if (!item) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '{Module} not found' }
    });
  }

  return res.json({ success: true, data: item });
});

// POST create
{module}Routes.post('/', (req, res) => {
  const body = req.body;

  // Validation
  if (!body.name) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'name is required' }
    });
  }

  const newItem = {
    id: Math.floor(Math.random() * 10000),
    ...body,
    createdAt: new Date().toISOString()
  };

  {module}s.push(newItem);

  return res.status(201).json({ success: true, data: newItem });
});

// PUT update
{module}Routes.put('/:id', (req, res) => {
  const { id } = req.params;
  const index = {module}s.findIndex(i => i.id === parseInt(id));

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '{Module} not found' }
    });
  }

  {module}s[index] = { ...{module}s[index], ...req.body };

  return res.json({ success: true, data: {module}s[index] });
});

// DELETE (soft delete)
{module}Routes.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = {module}s.findIndex(i => i.id === parseInt(id));

  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '{Module} not found' }
    });
  }

  {module}s[index].deletedAt = new Date().toISOString();

  return res.json({ success: true, data: { deleted: true } });
});
```

---

# Stage 4: Seed Data Generation

```json
// mocks/data/users.json
[
  {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin",
    "organizationId": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "deletedAt": null
  },
  {
    "id": 2,
    "email": "user@example.com",
    "name": "Regular User",
    "role": "user",
    "organizationId": 1,
    "createdAt": "2024-01-02T00:00:00Z",
    "updatedAt": "2024-01-02T00:00:00Z",
    "deletedAt": null
  }
]
```

---

# Stage 5: Configuration

## Package.json Dependencies

```json
{
  "scripts": {
    "mock": "tsx mocks/server.ts",
    "mock:watch": "tsx watch mocks/server.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17"
  }
}
```

## Startup Instructions

```markdown
## Mock Server 启动

1. 安装依赖:
   npm install

2. 启动Mock服务器:
   npm run mock

3. 前端配置:
   修改前端 `.env` 文件:
   ```
   VITE_API_BASE_URL=http://localhost:3001/api
   ```

4. 使用Mock用户登录:
   - Email: admin@example.com
   - Password: password
```

---

# Mock Server Features

| Feature | Implementation | Usage |
|---------|---------------|-------|
| Network latency | Random 100-500ms delay | Test loading states |
| Error simulation | Configurable error responses | Test error handling |
| Auth simulation | Bearer token middleware | Test protected routes |
| Persistence | In-memory storage | Data survives restart |
| Seed data | JSON files | Realistic test data |

---

# Constraints

**MUST DO:**
- Match api-contract.yaml exactly
- Include realistic seed data
- Simulate network latency
- Handle all error cases
- Organize mock files per module (1 route file + 1 data file per <module>.md)
- Monitor change-request.md for contract changes and sync promptly

**MUST NOT DO:**
- Add non-contract endpoints
- Return inconsistent data formats
- Skip soft delete handling
- Hardcode production URLs
- Lag behind contract changes (drift > 24h is BLOCKED)

---

# Gotchas

- **Port conflict** — Default mock port 3001; change if conflicts
- **CORS required** — Mock server must enable CORS for browser access
- **Latency is intentional** — Don't remove delay; it helps frontend test loading states
- **Data is ephemeral** — Mock data resets on server restart; use for dev only
- **Token has no real validation** — Any "Bearer mock-token" works for protected routes
- **Contract drift** — Run `npm run mock:verify` before each Stage4 integration; drift > 24h triggers BLOCKED
- **Module alignment** — Each biz-expert `<module>.md` requires exactly 1 mock route file + 1 mock data file

---

# Mock-实现变更同步协议

> 契约锁定后如 API 仍需变更，Mock 必须同步更新以保证前端始终有可用的开发环境。

## 变更触发流程

```
开发 Agent 发现 api-contract.yaml 不合理
  ↓
提交变更申请 → change-request.md
  ↓
Coordinator 暂缓该模块（BLOCKED = contract_change_pending）
  ↓
人类审查（小变更 < 3 接口可自动批准）
  ↓ 批准
更新 api-contract.yaml
  ↓
Mock Agent 同步更新 → 受影响前端 Agent 收到通知
  ↓
前端对应页面标记「需重新联调」
```

## change-request.md 模板

```markdown
# API Contract Change Request

**申请模块**: [module name]
**申请时间**: [ISO datetime]
**影响接口数**: [N]
**变更级别**: 微小 / 中等 / 重大

## 变更描述
[当前契约的问题 + 建议的修正]

## 影响的接口清单
| 方法 | 路径 | 变更类型 | 说明 |
|------|------|---------|------|
| POST | /api/xxx | 新增字段 | ... |

## 影响的前端页面
[Coordinator 自动分析输出]
```

## Coordinator 自动分析

收到 change-request 后，Coordinator 自动：
1. 读取变更接口列表
2. 扫描所有前端页面引用的 API（通过 `api.config.ts` 映射）
3. 输出受影响页面清单
4. 暂缓受影响模块的开发

## 同步后的 Mock 验证

变更同步完成后，必须重新运行 `npm run mock:verify`，确认 Mock 与更新后的契约一致。

---

# Mock-API Contract Consistency Verification

> Run periodically during Stage3/Stage4 to catch Mock drift before it causes frontend-backend mismatch.

## Verification Script

```typescript
// scripts/verify-mock-contract.ts
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

interface ContractEndpoint {
  method: string;
  path: string;
  response: {
    status: number;
    body: Record<string, string>;
  };
}

interface VerificationResult {
  endpoint: string;
  contract: ContractEndpoint;
  mockMatches: boolean;
  issues: string[];
}

async function verifyMockContract(
  contractPath: string,
  mockBaseUrl: string
): Promise<VerificationResult[]> {
  const contract = yaml.load(
    fs.readFileSync(contractPath, 'utf-8')
  ) as { endpoints: ContractEndpoint[] };
  
  const results: VerificationResult[] = [];
  
  for (const endpoint of contract.endpoints) {
    const mockUrl = `${mockBaseUrl}${endpoint.path}`;
    const issues: string[] = [];
    
    // 1. Send request to mock
    const response = await fetch(mockUrl, { method: endpoint.method });
    
    // 2. Check status code
    if (response.status !== endpoint.response.status) {
      issues.push(`Status mismatch: mock=${response.status} contract=${endpoint.response.status}`);
    }
    
    // 3. Check response body structure
    const body = await response.json();
    const contractFields = Object.keys(endpoint.response.body);
    const mockFields = Object.keys(body);
    
    const missingFields = contractFields.filter(f => !mockFields.includes(f));
    if (missingFields.length > 0) {
      issues.push(`Missing fields in mock: ${missingFields.join(', ')}`);
    }
    
    // 4. Check happy path returns 2xx, error path returns 4xx/5xx
    if (endpoint.path.includes('error')) {
      if (response.status < 400) {
        issues.push('Error path should return 4xx/5xx');
      }
    }
    
    results.push({
      endpoint: `${endpoint.method} ${endpoint.path}`,
      contract: endpoint,
      mockMatches: issues.length === 0,
      issues
    });
  }
  
  return results;
}

// Output: write mock-drift-issues.md if any mismatches found
const results = await verifyMockContract(
  'api-contract.yaml',
  'http://localhost:3001/api'
);

const driftIssues = results.filter(r => !r.mockMatches);
if (driftIssues.length > 0) {
  const report = driftIssues.map(r => 
    `- **${r.endpoint}**: ${r.issues.join('; ')}`
  ).join('\n');
  fs.writeFileSync('mock-drift-issues.md', 
    `# Mock Drift Issues\n\n${report}`
  );
  console.log(`⚠️  ${driftIssues.length} endpoints have Mock drift`);
} else {
  console.log('✅ All mock endpoints match contract');
}
```

**Execution**: Run before Stage4 frontend-backend integration. Automated via `npm run mock:verify`.