---
name: kf-mvp-frontend-dev
description: >-
  Load when user asks to develop frontend, create Vue components, or build pages
  with mock API. Triggers: 前端开发, vue, 页面开发, frontend, 组件开发,
  前端, create page, build UI. NOT for: backend development, database design,
  or API contract design.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage3
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-mock-service
      type: sequential
    - target: kf-mvp-arch-expert
      type: semantic
    - target: all-in-mvp
      type: semantic
---

# MVP Frontend Developer — 前端开发技能

> **Core Belief**: Frontend should never wait for backend. Build against mock, swap for real API when ready. Component by component, page by page.

**Division of Labor**: This Skill focuses on **Vue 3 component development** with mock API integration. It outputs pages, components, and composables. Follows Tool Wrapper pattern for API integration.

**Default Tech Stack** (enforced unless user explicitly overrides):
- Framework: Vue 3.4+ (Composition API)
- Build: Vite 5.x
- State: Pinia 2.x
- Routing: Vue Router 4.x
- HTTP: Axios 1.x
- UI Framework: 6选1 (Ant Design Vue / Element Plus / Arco Design / Vant / shadcn-vue / Tailwind CSS)

Load `references/mvp-tech-stack-default.md` for full specification.

---

# Core Philosophy

1. **Mock-first** — Build against mock server, swap API later
2. **Component-based** — Reusable components, clean architecture
3. **Composition API** — Vue 3 Composition API throughout
4. **TypeScript** — Full type safety
5. **UI Framework locked** — Once selected in Phase 0, never mix frameworks

---

# Tech Stack

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | Vue 3 | 3.4+ | Composition API only |
| Build | Vite | 5.x | |
| Language | TypeScript | 5.0+ | |
| State | Pinia | 2.1+ | Vue official |
| Routing | Vue Router | 4.0+ | |
| HTTP | Axios | 1.6+ | |
| UI | {{UI_FRAMEWORK}} | varies | Selected in Phase 0, locked |

**UI Framework Selection** (from `references/mvp-tech-stack-default.md`):
- Enterprise/B2B admin: Ant Design Vue (default) / Element Plus / Arco Design
- Modern branded web: Tailwind CSS / shadcn-vue
- H5 mobile: Vant

**MUST NOT mix UI frameworks** within the same project.

---

# Project Structure

```
src/
├── components/
│   ├── common/           # Shared components
│   │   ├── Button.vue
│   │   ├── Input.vue
│   │   ├── Modal.vue
│   │   └── Table.vue
│   └── [module]/
│       ├── [Module]List.vue
│       ├── [Module]Form.vue
│       └── [Module]Card.vue
├── composables/
│   ├── useApi.ts         # API wrapper
│   ├── useAuth.ts        # Auth state
│   └── use[Feature].ts   # Feature composables
├── stores/
│   ├── auth.ts           # Auth store
│   └── [module].ts       # Module stores
├── pages/
│   ├── [module]/
│   │   ├── index.vue     # List page
│   │   ├── [id].vue      # Detail page
│   │   └── new.vue       # Create page
│   └── layout/
│       ├── Default.vue
│       └── Auth.vue
├── api/
│   └── [module].ts       # API clients
├── types/
│   └── index.ts          # Shared types
└── router/
    └── index.ts          # Routes
```

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
// src/composables/use[Module].ts
import { ref, computed } from 'vue';
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
<!-- src/pages/[module]/index.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { use[Module] } from '@/composables/use[Module]';
import { useRouter } from 'vue-router';

const router = useRouter();
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

    <div v-if="loading" class="loading">加载中...</div>
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
<!-- src/pages/[module]/Form.vue -->
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
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
        {{ loading ? '提交中...' : '提交' }}
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
import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/[module]',
    component: () => import('@/pages/layout/Default.vue'),
    children: [
      {
        path: '',
        name: '[module]-list',
        component: () => import('@/pages/[module]/index.vue'),
      },
      {
        path: ':id',
        name: '[module]-detail',
        component: () => import('@/pages/[module]/[id].vue'),
      },
      {
        path: 'new',
        name: '[module]-create',
        component: () => import('@/pages/[module]/new.vue'),
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
```

---

# Quality Checklist

- [ ] All API calls use composable
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Form validation implemented
- [ ] TypeScript types used throughout
- [ ] Responsive design applied

---

# Constraints

**MUST DO:**
- Use mock API URL in development
- Handle loading and error states
- Use Composition API (not Options API)
- Type all props and emits

**MUST NOT DO:**
- Use any type without reason
- Hardcode API URLs (use env vars)
- Skip loading states
- Use var instead of const/let

---

# Gotchas

- **Mock URL** — Set VITE_API_BASE_URL in .env for mock vs real API
- **Auth token** — Store in localStorage, attach in interceptor
- **Response envelope** — Always check `response.data.success` first
- **Error handling** — API errors throw, handle with try/catch
- **Type safety** — Define DTO types before using in components
- **UI Framework lock-in** — Once Phase 0 selects a UI framework (e.g., Ant Design Vue), ALL components MUST use that framework. Never mix Element Plus buttons with Ant Design tables
- **Default stack** — If no UI framework specified, use Ant Design Vue for B2B/admin, Tailwind CSS for branded web
- **MVP exemptions** — No SSR, no PWA, no complex state hydration. Keep it simple.
- **Axios baseURL** — Always use env var `VITE_API_BASE_URL`, default to `/api`