---
name: kf-mvp-frontend-dev
description: >-
  Load when user asks to develop frontend, create React components, or build pages
  with mock API. Triggers: 前端开发, react, 页面开发, frontend, 组件开发,
  前端, create page, build UI. NOT for: backend development, database design,
  or API contract design.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage3
recommended_model: qwen-3.7-Max
graph:
  dependencies:
    - target: kf-mvp-mock-service
      type: sequential
    - target: kf-mvp-arch-expert
      type: semantic
    - target: kf-mvp-playwright-infra
      type: semantic
    - target: all-in-mvp
      type: semantic
---

# MVP Frontend Developer �?前端开发技�?

> **Core Belief**: Frontend should never wait for backend. Build against mock, swap for real API when ready. Component by component, page by page.

**Division of Labor**: This Skill focuses on **React component development** with mock API integration. It outputs pages, components, and hooks. Follows Tool Wrapper pattern for API integration.

**Default Tech Stack** (enforced unless user explicitly overrides):
- Framework: React 19 (Hooks)
- Build: Vite 5.x
- State: Zustand 4.x
- Routing: React Router 6.x
- HTTP: Axios 1.x
- UI Framework: 6选1 (Ant Design / shadcn/ui / Arco Design / Vant / Tailwind CSS)

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **Mock-first** �?Build against mock server, swap API later
2. **Component-based** �?Reusable components, clean architecture
3. **Hooks** — React 19 Hooks throughout
4. **TypeScript** �?Full type safety
5. **UI Framework locked** �?Once selected in Phase 0, never mix frameworks

---

# Tech Stack

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | React | 19 | Hooks |
| Build | Vite | 5.x | |
| Language | TypeScript | 5.0+ | |
| State | Zustand | 4.x | |
| Routing | React Router | 6.x | |
| HTTP | Axios | 1.6+ | |
| UI | {{UI_FRAMEWORK}} | varies | Selected in Phase 0, locked |

**UI Framework Selection** (from `references/mvp-tech-stack-default.md`):
- Enterprise/B2B admin: Ant Design (default) / shadcn/ui
- Modern branded web: Tailwind CSS / shadcn/ui
- H5 mobile: Vant

**MUST NOT mix UI frameworks** within the same project.

---

# Project Structure

```
src/
├── components/
�?  ├── common/           # Shared components
�?  �?  ├── .tsx
�?  �?  ├── Input.tsx
�?  �?  ├── Modal.tsx
�?  �?  └── Table.tsx
�?  └── [module]/
�?      ├── [Module]List.tsx
�?      ├── [Module]Form.tsx
�?      └── [Module]Card.tsx
├── hooks/
�?  ├── useApi.ts         # API wrapper
�?  ├── useAuth.ts        # Auth state
�?  └── use[Feature].ts   # Feature hooks
├── stores/
�?  ├── auth.ts           # Auth store
�?  └── [module].ts       # Module stores
├── pages/
�?  ├── [module]/
�?  �?  ├── index.tsx     # List page
�?  �?  ├── [id].tsx      # Detail page
�?  �?  └── new.tsx       # Create page
�?  └── layout/
�?      ├── Default.tsx
�?      └── Auth.tsx
├── api/
�?  └── [module].ts       # API clients
├── types/
�?  └── index.ts          # Shared types
└── router/
    └── index.tsx     # Routes
```

---

# Stage 0: Project Initialization（跳过此步 = 复盘问题E）

**MUST 先检查 Coordinator 是否已初始化好前端项目目录。** 如果尚未初始化：

```bash
# 步骤 1: 扫描脚手架（P0 强制性）
ls starters/liquid-glass-frontend/

# 步骤 2: 如果脚手架存在 → 直接复制（推荐）
cp -r starters/liquid-glass-frontend/ frontend/
cd frontend && bun install

# 步骤 3: 仅在脚手架确实不存在时 → 手动创建
bun create vite@latest frontend -- --template react-ts
cd frontend
bun install tailwindcss @tailwindcss/vite tw-animate-css
# 然后手动复制 .qoder/skills/references/liquid-glass/theme-tokens.css 等
```

> **红线**：发现 `starters/liquid-glass-frontend/` 存在却仍然 `bun create vite` → P0 错误，上一轮实际发生了。脚手架含完整路由/布局/KpiCard/主题/设计体系，从零创建会丢失所有预设。

**验证初始化完成**：
- [ ] `bun run dev` 可正常启动
- [ ] 访问 `http://localhost:5173` 可看到首页（含 blob 动画背景）
- [ ] `@/` 路径别名生效
- [ ] CSS 变量 `--lg-background` 等可用

---

# Stage 1: API Client Setup

```typescript
// src/api/[module].ts
import axios from 'axios';
import type { ModuleListResponse, ModuleItem, CreateModuleDto, UpdateModuleDto } from '@/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response envelope handler
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error?.message || error.message;
    return Promise.reject(new Error(message));
  }
);

export const [module]Api = {
  list(params?: ListParams) {
    return api.get<{ success: boolean; data: ModuleListResponse }>('/[module]', { params });
  },

  getById(id: number) {
    return api.get<{ success: boolean; data: ModuleItem }>(`/[module]/${id}`);
  },

  create(data: CreateModuleDto) {
    return api.post<{ success: boolean; data: ModuleItem }>('/[module]', data);
  },

  update(id: number, data: UpdateModuleDto) {
    return api.put<{ success: boolean; data: ModuleItem }>(`/[module]/${id}`, data);
  },

  delete(id: number) {
    return api.delete<{ success: boolean }>(`/[module]/${id}`);
  },
};
```

---

# Stage 2: Composable Development

```typescript
// src/hooks/use[Module].ts
import { useState, useMemo } from 'react';
import type { ModuleItem, CreateModuleDto, UpdateModuleDto, ListParams } from '@/types';
import { [module]Api } from '@/api/[module]';

export function use[Module]() {
  const items = ref<ModuleItem[]>([]);
  const currentItem = ref<ModuleItem | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const total = computed(() => items.value.length);

  async function fetchList(params?: ListParams) {
    loading.value = true;
    error.value = null;
    try {
      const response = await [module]Api.list(params);
      items.value = response.data.list;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchById(id: number) {
    loading.value = true;
    error.value = null;
    try {
      const response = await [module]Api.getById(id);
      currentItem.value = response.data;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function create(data: CreateModuleDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await [module]Api.create(data);
      return response.data;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function update(id: number, data: UpdateModuleDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await [module]Api.update(id, data);
      currentItem.value = response.data;
      return response.data;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function remove(id: number) {
    loading.value = true;
    error.value = null;
    try {
      await [module]Api.delete(id);
      items.value = items.value.filter(i => i.id !== id);
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    items,
    currentItem,
    loading,
    error,
    total,
    fetchList,
    fetchById,
    create,
    update,
    remove,
  };
}
```

---

# Stage 3: Component Development

## List Page Template

```vue
<!-- src/pages/[module]/index.tsx -->
<script setup lang="ts">
import { useState, useEffect } from 'react';
import { use[Module] } from '@/hooks/use[Module]';
import { useNavigate } from 'react-router';

const router = useNavigate();
const { items, loading, error, fetchList, remove } = use[Module]();
const pagination = ref({ page: 1, limit: 10 });

onMounted(() => {
  fetchList(pagination.value);
});

async function handleDelete(id: number) {
  if (confirm('确定删除吗？')) {
    await remove(id);
  }
}

function handleEdit(id: number) {
  router.push(`/[module]/${id}`);
}

function handleCreate() {
  router.push(`/[module]/new`);
}
</script>

<template>
  <div class="[module]-page">
    <header class="page-header">
      <h1>[模块名称]</h1>
      <button @click="handleCreate" class="btn-primary">
        新建
      </button>
    </header>

    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>名称</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>{{ item.id }}</td>
          <td>{{ item.name }}</td>
          <td>
            <button @click="handleEdit(item.id)">编辑</button>
            <button @click="handleDelete(item.id)" class="btn-danger">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="loading" class="loading">加载�?..</div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.alert-error {
  color: red;
  padding: 1rem;
  background: #fee;
}
</style>
```

## Form Component Template

```vue
<!-- src/pages/[module]/Form.tsx -->
<script setup lang="ts">
import { useState, useEffect } from 'react';
import type { CreateModuleDto, UpdateModuleDto } from '@/types';

const props = defineProps<{
  id?: number;
}>();

const emit = defineEmits<{
  (e: 'submit', data: CreateModuleDto | UpdateModuleDto): void;
  (e: 'cancel'): void;
}>();

const form = ref<CreateModuleDto>({
  name: '',
  // ... other fields
});

const loading = ref(false);

async function handleSubmit() {
  loading.value = true;
  try {
    emit('submit', form.value);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="[module]-form">
    <div class="form-group">
      <label for="name">名称</label>
      <input
        id="name"
        v-model="form.name"
        type="text"
        required
      />
    </div>

    <div class="form-actions">
      <button type="submit" :disabled="loading">
        {{ loading ? '提交�?..' : '提交' }}
      </button>
      <button type="button" @click="emit('cancel')">
        取消
      </button>
    </div>
  </form>
</template>
```

---

# Stage 4: Router Setup

```typescript
// src/router/index.ts
import { createBrowserRouter,  } from 'react-router';
import type { RouteObject } from 'react-router';

const routes: RouteObject[] = [
  {
    path: '/[module]',
    component: () => import('@/pages/layout/Default.tsx'),
    children: [
      {
        path: '',
        name: '[module]-list',
        component: () => import('@/pages/[module]/index.tsx'),
      },
      {
        path: ':id',
        name: '[module]-detail',
        component: () => import('@/pages/[module]/[id].tsx'),
      },
      {
        path: 'new',
        name: '[module]-create',
        component: () => import('@/pages/[module]/new.tsx'),
      },
    ],
  },
];

export const router = createBrowserRouter({
  history: (),
  routes,
});
```

---

# Stage 5: Component Interaction Testing (MUST �?迭代8核心修复)

**问题**：电商系统的前端组件有大量交互逻辑（购物车、表单验证、弹窗确认），之前组件交互bug只在人工测试时发现（如：表单提交后未清空、弹窗未关闭、状态未同步）�?

**解决方案**：MUST 编写 **Vue组件交互测试**，覆盖组件渲染、用户交互、状态同步、生命周期�?

## Vue组件测试模板

```typescript
// src/components/cart/CartItem.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@testing-library/react';
import CartItem from './CartItem.tsx';
import { createZustand, setActiveZustand } from 'zustand';
import { useCartStore } from '@/stores/cart';

describe('CartItem Component �?E-commerce Frontend', () => {
  beforeEach(() => {
    setActiveZustand(createZustand());
  });

  // 渲染测试
  describe('Rendering', () => {
    it('should display item name, price, and quantity', () => {
      const wrapper = mount(CartItem, {
        props: { item: { id: 1, name: 'iPhone', price: 999, quantity: 2 } }
      });
      
      expect(wrapper.text()).toContain('iPhone');
      expect(wrapper.text()).toContain('$999');
      expect(wrapper.find('[data-testid="quantity"]').text()).toBe('2');
    });

    it('should show out-of-stock badge when stock is 0', () => {
      const wrapper = mount(CartItem, {
        props: { item: { id: 1, name: 'iPhone', price: 999, quantity: 1, stock: 0 } }
      });
      
      expect(wrapper.find('[data-testid="out-of-stock"]').exists()).toBe(true);
    });

    it('should render empty state when no items', () => {
      const wrapper = mount(CartItem, {
        props: { item: null }
      });
      
      expect(wrapper.find('[data-testid="empty-cart"]').exists()).toBe(true);
    });
  });

  // 用户交互测试
  describe('User Interactions', () => {
    it('should increment quantity when + button clicked', async () => {
      const wrapper = mount(CartItem, {
        props: { item: { id: 1, name: 'iPhone', price: 999, quantity: 1, stock: 5 } }
      });
      
      await wrapper.find('[data-testid="btn-increase"]').trigger('click');
      await flushPromises();
      
      expect(wrapper.emitted('update:quantity')).toBeTruthy();
      expect(wrapper.emitted('update:quantity')[0]).toEqual([2]);
    });

    it('should NOT increment beyond stock limit', async () => {
      const wrapper = mount(CartItem, {
        props: { item: { id: 1, name: 'iPhone', price: 999, quantity: 5, stock: 5 } }
      });
      
      await wrapper.find('[data-testid="btn-increase"]').trigger('click');
      await flushPromises();
      
      // MUST: 不触发update事件
      expect(wrapper.emitted('update:quantity')).toBeFalsy();
      // MUST: 显示提示
      expect(wrapper.find('[data-testid="stock-warning"]').exists()).toBe(true);
    });

    it('should remove item when delete clicked and confirmed', async () => {
      const wrapper = mount(CartItem, {
        props: { item: { id: 1, name: 'iPhone', price: 999, quantity: 1 } }
      });
      
      // 模拟confirm返回true
      window.confirm = vi.fn(() => true);
      
      await wrapper.find('[data-testid="btn-delete"]').trigger('click');
      await flushPromises();
      
      expect(wrapper.emitted('remove')).toBeTruthy();
      expect(wrapper.emitted('remove')[0]).toEqual([1]);
    });

    it('should NOT remove item when delete cancelled', async () => {
      const wrapper = mount(CartItem, {
        props: { item: { id: 1, name: 'iPhone', price: 999, quantity: 1 } }
      });
      
      window.confirm = vi.fn(() => false);
      
      await wrapper.find('[data-testid="btn-delete"]').trigger('click');
      await flushPromises();
      
      expect(wrapper.emitted('remove')).toBeFalsy();
    });
  });

  // 状态同步测�?
  describe('State Synchronization', () => {
    it('should sync with Zustand store', async () => {
      const zustand = createZustand();
      setActiveZustand(zustand);
      const cartStore = useCartStore();
      cartStore.addItem({ id: 1, name: 'iPhone', price: 999 });
      
      const wrapper = mount(CartItem, {
        global: { plugins: [zustand] },
        props: { item: cartStore.items[0] }
      });
      
      await wrapper.find('[data-testid="btn-increase"]').trigger('click');
      await flushPromises();
      
      // MUST: store状态同步更�?
      expect(cartStore.items[0].quantity).toBe(2);
    });

    it('should recalculate total when quantity changes', async () => {
      const wrapper = mount(CartItem, {
        props: { item: { id: 1, name: 'iPhone', price: 100, quantity: 2 } }
      });
      
      expect(wrapper.find('[data-testid="item-total"]').text()).toBe('$200');
      
      await wrapper.find('[data-testid="btn-increase"]').trigger('click');
      await flushPromises();
      
      expect(wrapper.find('[data-testid="item-total"]').text()).toBe('$300');
    });
  });

  // 表单验证测试
  describe('Form Validation', () => {
    it('should validate coupon code format', async () => {
      const wrapper = mount(CouponInput, {
        props: { modelValue: '' }
      });
      
      const input = wrapper.find('input');
      await input.setValue('INVALID@CODE');
      await input.trigger('blur');
      
      expect(wrapper.find('[data-testid="error-msg"]').text()).toContain('Invalid format');
      expect(wrapper.emitted('update:modelValue')).toBeFalsy();
    });

    it('should apply valid coupon and update total', async () => {
      const wrapper = mount(CouponInput, {
        props: { modelValue: '', total: 100 }
      });
      
      const input = wrapper.find('input');
      await input.setValue('SAVE20');
      await wrapper.find('[data-testid="btn-apply"]').trigger('click');
      await flushPromises();
      
      expect(wrapper.emitted('apply')).toBeTruthy();
      expect(wrapper.emitted('apply')[0]).toEqual([{ code: 'SAVE20', discount: 20 }]);
    });
  });

  // 生命周期测试
  describe('Lifecycle', () => {
    it('should fetch data on mount', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ data: { stock: 10 } });
      
      const wrapper = mount(ProductDetail, {
        props: { productId: 1 },
        global: {
          provide: { fetchStock: mockFetch }
        }
      });
      
      await flushPromises();
      
      expect(mockFetch).toHaveBeenCalledWith(1);
      expect(wrapper.find('[data-testid="stock"]').text()).toBe('10');
    });

    it('should cleanup on unmount', async () => {
      const clearTimer = vi.fn();
      
      const wrapper = mount(CountdownTimer, {
        props: { endTime: Date.now() + 60000 }
      });
      
      wrapper.unmount();
      
      // MUST: 清除定时器，防止内存泄漏
      expect(clearTimer).toHaveBeenCalled();
    });
  });
});
```

## 前端组件测试覆盖率要�?

| 测试类型 | 最低数�?| 说明 |
|---------|---------|------|
| 渲染测试 | 每个组件 | props变化、空状态、加载状�?|
| 交互测试 | 每个可交互元�?| 点击、输入、选择、提�?|
| 状态同�?| 每个store关联 | Zustand状态变更同�?|
| 表单验证 | 每个表单 | 必填、格式、长度、异步校�?|
| 生命周期 | 每个有副作用的组�?| mount、update、unmount |

## 测试工具配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', // MUST: 模拟DOM环境
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
});
```

# Quality Checklist

- [ ] All API calls use hook
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Form validation implemented
- [ ] TypeScript types used throughout
- [ ] Responsive design applied
- [ ] Component tests written (render + interaction + state + lifecycle)

---

# Constraints

**MUST DO:**
- Use mock API URL in development
- Handle loading and error states
- Use Composition API (not Options API)
- Type all props and emits
- Write computed style assertions (防线1) for every page/component that renders visible UI
- Generate visual regression baselines (防线2) for key pages and states
- Run full visual verification suite before marking DONE
- Mark VISUAL_PENDING when layout/CSS is modified (do NOT self-mark DONE)
- **D-09 前端一致性**：如果使用了 starters/ 脚手架，开发完成后必须用产物覆盖/替换脚手架源码，或删除 starters/。确保 `diff -r starters/<name>/src/ src/` 无差异。用户浏览器访问的前端 MUST == E2E 测试的前端

**MUST NOT DO:**
- Use any type without reason
- Hardcode API URLs (use env vars)
- Skip loading states
- Use var instead of const/let
- Self-mark DONE after CSS/layout changes without human visual review
- Skip visual test execution (防线1+2+3) and claim "looks fine"

---

## Gotchas

- **Mock URL** �?Set VITE_API_BASE_URL in .env for mock vs real API
- **Auth token** �?Store in localStorage, attach in interceptor
- **Response envelope** �?Always check `response.data.success` first
- **Error handling** �?API errors throw, handle with try/catch
- **Type safety** �?Define DTO types before using in components
- **UI Framework lock-in** �?Once Phase 0 selects a UI framework (e.g., Ant Design), ALL components MUST use that framework. Never mix Element Plus buttons with Ant Design tables
- **Default stack** �?If no UI framework specified, use Ant Design for B2B/admin, Tailwind CSS for branded web
- **MVP exemptions** �?No SSR, no PWA, no complex state hydration. Keep it simple.
- **Axios baseURL** �?Always use env var `VITE_API_BASE_URL`, default to `/api`
- **Mock env setup** �?Development: `VITE_API_BASE_URL=http://localhost:3001/api`；Production: `/api`
- **Visual verification is MANDATORY** �?`toBeVisible()` is NOT enough. Every page MUST have computed style assertions. Key pages MUST have visual regression screenshots. Agent cannot claim "done" based solely on DOM text assertions.
- **VISUAL_PENDING �?DONE** �?Modifying CSS or layout �?mark VISUAL_PENDING, not DONE. Only human eyes can confirm visual correctness. Autonomously claiming visual correctness is a P0 error.
- **Computed styles are deterministic** �?`toHaveCSS('color', 'rgb(...)')` is reliable and doesn't need AI vision. Use it aggressively.
- **Screenshot retries** �?Visual regression failures due to font/OS differences can be retried once. Second failure �?VISUAL_PENDING.
- **🇨🇳 中文编码规范（复盘问题B）** �?placeholder/label 等 HTML 属性值禁止使用 U+201C/U+201D（“”），一律用 ASCII 双引号 `"` 包裹。Write 每个 .tsx 后执行 `grep -rnP '[\x{fffd}]' <file>` 自检，发现 � 损坏字符必须立即修复。参考 `.qoder/skills/references/encoding-guard.md`。

---

# 前端三层测试（FT1-FT3�?

> 白皮�?v2.5 定义的前端三层测试体系，覆盖组件渲染、交互行为、页面流程�?

| 层级 | 测试类型 | 工具 | 覆盖目标 |
|------|---------|------|---------|
| **FT1** | 组件单元测试 | Vitest + @testing-library/react | 组件渲染、props、事件、slot、hook |
| **FT2** | 页面交互测试 | Vitest + @testing-library/react + Mock API | 表单验证、状态管理、路由跳转、API 调用 |
| **FT3** | 端到端流程测�?| Playwright | 完整用户旅程、跨页面流程、真实浏览器渲染 |

**测试文件位置**�?
```
src/__tests__/
├── components/      # FT1: 组件单元测试
├── pages/           # FT2: 页面交互测试
└── e2e/             # FT3: Playwright 端到端测�?
```

---

# Mock 连接与验证规�?

## 环境变量配置

```env
# .env.development
VITE_API_BASE_URL=http://localhost:3001/api

# .env.production
VITE_API_BASE_URL=/api
```

## API 配置切换（api.config.ts�?

```typescript
// src/api/config.ts
export const apiConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  // 按模块映�?baseURL，支持逐模块切�?Mock �?Real
  moduleBaseURL: {
    auth: import.meta.env.VITE_API_AUTH_URL || import.meta.env.VITE_API_BASE_URL || '/api',
    user: import.meta.env.VITE_API_USER_URL || import.meta.env.VITE_API_BASE_URL || '/api',
    // Stage4 联调时逐个模块切换�?
    // user: 'http://localhost:3000/api',  // 切换到真实后�?
  }
};
```

## Mock 持续验证

开发期间每�?`bun run dev` 时自动验�?Mock 契约�?
```json
{
  "scripts": {
    "mock:sync": "node scripts/verify-mock-contract.ts",
    "dev": "bun run mock:sync && vite"
  }
}
```

> Mock drift 超过 24h �?前端标记 BLOCKED �?等待 Mock 同步

---

# 视觉自验证协议（Visual Self-Verification Protocol�?

> **核心问题**：LLM 无视觉能力，不能"�?到渲染结果。Playwright �?`toBeVisible()` 只检查元素存在于 DOM，不检�?CSS 布局是否正确、颜色是否匹配、元素是否被遮挡。Agent 声称"改好�?但实际页面错乱，根源在此�?

> **解决方案**：三道自动化防线，不依赖 AI 视觉，全部确定性可验证�?

---

> **Playwright 基础设施**：`playwright.config.ts` 配置、截图基线管理、浏览器实例池、storageState 复用统一由 `kf-mvp-playwright-infra` 管理。Playwright API 核心约定（locator 优先级、等待策略、网络拦截）见该技能 Section 8。

## 防线 1：Computed Style 断言（MUST �?每个页面组件�?

Playwright 可读取浏览器实际渲染�?computed styles。这些是**确定性数�?*，LLM 可直接验证：

```typescript
// tests/visual/<page>.visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard Page �?Visual Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  // ====== 关键元素样式断言 ======

  test('primary button should have correct colors', async ({ page }) => {
    const btn = page.locator('.btn-primary').first();
    await expect(btn).toHaveCSS('background-color', 'rgb(59, 130, 246)');
    await expect(btn).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(btn).toHaveCSS('border-radius', '6px');
    await expect(btn).toHaveCSS('font-size', '14px');
  });

  test('page header should have correct layout', async ({ page }) => {
    const header = page.locator('.page-header');
    await expect(header).toHaveCSS('display', 'flex');
    await expect(header).toHaveCSS('justify-content', 'space-between');
    await expect(header).toHaveCSS('align-items', 'center');

    // 最小高�?
    const box = await header.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(60);
  });

  // ====== 布局完整性断言 ======

  test('no overlapping elements at standard resolutions', async ({ page }) => {
    // 桌面�?1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    const overlaps1920 = await checkOverlaps(page);
    expect(overlaps1920).toHaveLength(0);

    // 笔记�?1366x768
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(500);
    const overlaps1366 = await checkOverlaps(page);
    expect(overlaps1366).toHaveLength(0);
  });

  test('scrollbar only when content overflows', async ({ page }) => {
    // 主内容区
    const main = page.locator('main');
    const hasScroll = await main.evaluate(el => el.scrollHeight > el.clientHeight);

    if (hasScroll) {
      await expect(main).toHaveCSS('overflow-y', /auto|scroll/);
    }
  });

  // ====== 空状�?错误状态断言 ======

  test('empty state should be centered', async ({ page }) => {
    // 访问无数据页�?
    await page.goto('/dashboard?empty=true');

    const empty = page.locator('[data-testid="empty-state"]');
    await expect(empty).toBeVisible();
    await expect(empty).toHaveCSS('text-align', 'center');

    // 空状态图标不应为 0x0
    const icon = empty.locator('svg, img').first();
    if (await icon.count() > 0) {
      const box = await icon.boundingBox();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }
  });

  test('error banner should have red background', async ({ page }) => {
    await page.goto('/dashboard?error=true');

    const errorBanner = page.locator('[data-testid="error-banner"], .alert-error').first();
    if (await errorBanner.count() > 0) {
      const bg = await errorBanner.evaluate(el => getComputedStyle(el).backgroundColor);
      // 红色系背景（rgb �?R 分量明显大于 G �?B�?
      const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
        expect(r).toBeGreaterThan(g + 50);
        expect(r).toBeGreaterThan(b + 50);
      }
    }
  });

  // ====== z-index 层级断言 ======

  test('modal should be above overlay', async ({ page }) => {
    await page.locator('[data-testid="btn-open-modal"]').click();
    await page.waitForSelector('.modal');

    const overlayZ = await page.locator('.modal-overlay').evaluate(el => parseInt(getComputedStyle(el).zIndex) || 0);
    const modalZ = await page.locator('.modal').evaluate(el => parseInt(getComputedStyle(el).zIndex) || 0);

    expect(modalZ).toBeGreaterThan(overlayZ);
  });
});

// ====== 通用工具：重叠检�?======

async function checkOverlaps(page) {
  const overlaps = await page.evaluate(() => {
    const results: string[] = [];
    const selectors = ['.card', '.panel', '.sidebar', '.modal', '[data-testid]'];
    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const a = elements[i].getBoundingClientRect();
          const b = elements[j].getBoundingClientRect();
          if (a.width === 0 || b.width === 0) continue; // skip hidden
          if (!(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)) {
            results.push(`${sel}[${i}] �?${sel}[${j}]`);
          }
        }
      }
    }
    return results;
  });
  return overlaps;
}
```

**必须覆盖�?computed style 检查项**�?

| 检查类�?| 关键属�?| 适用场景 |
|---------|---------|---------|
| **颜色** | `background-color`, `color`, `border-color` | 按钮、标签、告警、状态指示器 |
| **尺寸** | `width`, `height`, `min-height`, `max-width` | 容器、卡片、图片、头�?|
| **间距** | `padding`, `margin`, `gap` | 列表、网格、表单组 |
| **排版** | `font-size`, `font-weight`, `line-height`, `text-align` | 标题、正文、标�?|
| **布局** | `display`, `flex-direction`, `justify-content`, `align-items` | 页面框架、工具栏、卡片组 |
| **定位** | `position`, `z-index`, `top/right/bottom/left` | 模态框、下拉菜单、固定导航栏 |
| **边框** | `border-radius`, `border-width`, `border-style` | 卡片、按钮、输入框 |

---

## 防线 2：视觉回归快照（自动像素对比�?

Playwright 内置 `toHaveScreenshot()` 进行像素级对比。首次运行生成基线，后续自动对比�?

```typescript
// tests/visual/<page>.screenshot.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression �?Dashboard', () => {
  // 关键页面/状态截�?

  test('dashboard main view', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-main.png', {
      fullPage: false,        // 仅视口，非全�?
      maxDiffPixels: 100,     // 允许 100 像素差异（字体渲染差异容差）
    });
  });

  test('dashboard empty state', async ({ page }) => {
    await page.goto('/dashboard?empty=true');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard-empty.png');
  });

  test('modal open state', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('[data-testid="btn-create"]').click();
    await page.waitForSelector('.modal');
    await expect(page).toHaveScreenshot('modal-create.png');
  });

  test('form validation errors', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('[data-testid="btn-create"]').click();
    await page.locator('[data-testid="btn-submit"]').click(); // 空表单提�?
    await page.waitForSelector('.error-message');
    await expect(page).toHaveScreenshot('form-validation.png');
  });
});
```

**基线管理**�?

```bash
# 首次：生成基线截图（在本地有头浏览器运行�?
bunx playwright test --project=chromium-headed --update-snapshots

# CI：对比基线（无头浏览器）
bunx playwright test --project=chromium-headless

# 基线存储在版本控制中
tests/visual/
├── dashboard-main-snapshots/
�?  └── dashboard-main.png          # 黄金基线（提交到 Git�?
├── dashboard-empty-snapshots/
�?  └── dashboard-empty.png
└── ...
```

> ⚠️ **假阳性处�?*：不�?OS/字体可能导致像素差异。设�?`maxDiffPixels: 100` 容忍微小差异。超过阈值的差异标记�?VISUAL_REGRESSION �?Agent 必须修复�?

---

## 防线 3：DOM 结构快照（A11y Tree�?

比像素对比更稳定，不受字体渲染影响，能发现结构性布局问题�?

```typescript
import { test, expect } from '@playwright/test';

test('dashboard a11y structure', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // 获取完整可访问性树（只含可见元素的结构化描述）
  const snapshot = await page.accessibility.snapshot();

  // 验证关键区域存在
  const roles = extractRoles(snapshot);
  expect(roles).toContain('navigation');  // 导航�?
  expect(roles).toContain('main');        // 主内容区
  expect(roles).toContain('heading');     // 页面标题

  // 存储快照用于回归对比
  expect(snapshot).toMatchSnapshot('dashboard-a11y-tree.json');
});

function extractRoles(node: any, roles: string[] = []): string[] {
  if (node.role) roles.push(node.role);
  if (node.children) {
    for (const child of node.children) {
      extractRoles(child, roles);
    }
  }
  return roles;
}
```

---

## 开发完成即执行（Agent 强制流程�?

**每个前端页面/组件开发完成后，Agent 必须执行以下步骤才能标记 DONE�?*

```
1. 启动 dev server
   bunx --bun vite --port 5173 &

2. 运行 computed style 断言
   bunx playwright test tests/visual/<page>.visual.spec.ts
   �?全部 PASS 才继�?

3. 运行视觉回归快照
   bunx playwright test tests/visual/<page>.screenshot.spec.ts
   �?首次运行自动生成基线；后续运行对比基�?

4. 运行布局完整性检�?
   bunx playwright test tests/visual/<page>.visual.spec.ts -g "overlapping"
   �?无重叠元�?

5. 产出视觉验证报告 �?写入 Done 文件 visual_verification 字段
```

---

## VISUAL_PENDING 状�?

当修改涉及以下内容时，Agent **不能自行标记 DONE**，必须标�?`VISUAL_PENDING`�?

| 变更类型 | 状�?| 解除条件 |
|---------|------|---------|
| 修改 .css / scoped style | VISUAL_PENDING | 人类审核截图 �?改标 DONE |
| 新增/修改组件布局结构 | VISUAL_PENDING | 人类审核截图 �?改标 DONE |
| 新增/修改动画/过渡 | VISUAL_PENDING | 人类审核截图 �?改标 DONE |
| 纯逻辑修复（hook/api/store�?| 可自�?DONE | 所�?computed style 断言通过 |
| 纯文�?文案修改 | 可自�?DONE | 所�?computed style 断言通过 |

**VISUAL_PENDING 标记模板**（写入模块目录下�?`VISUAL_PENDING` 文件）：
```yaml
module: dashboard
agent: frontend-dev-1
status: VISUAL_PENDING
reason: "CSS layout changed, header + sidebar + main area restructured"
screenshots:
  before: "screenshots/dashboard-before.png"
  after: "screenshots/dashboard-after.png"
  diff: "screenshots/dashboard-diff.png"
computed_style_checks_passed: true
visual_regression_passed: false  # 布局变更，需要人类确�?
review_url: "http://localhost:5173/dashboard"
human_action: "请打开 review_url 查看视觉效果，确认无误后删除此文件并创建 DONE"
```