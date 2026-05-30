---
name: kf-mvp-vue-components
description: >-
  Load when user asks for Vue component development, component patterns, or
  Vue 3 best practices. Triggers: Vueç»„ä»¶, vueå¼€å? component patterns,
  vue3, composition api, ç»„ä»¶æ¨¡å¼. Also load when building reusable UI
  components or Vue development patterns.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage3
recommended_model: qwen-3.7-Max
graph:
  dependencies:
    - target: kf-mvp-frontend-dev
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios + UI Framework (6é€?)

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Vue Components â€?Vueç»„ä»¶æŠ€èƒ?

> **Core Belief**: Components are the atoms of your UI. Well-designed components are reusable, composable, and self-contained. Build them once, use them everywhere.

**Division of Labor**: This Skill focuses on **Vue 3 component patterns** using Tool Wrapper pattern. Provides component templates, composition patterns, and best practices.

---

# Component Structure

## Single File Component

```vue
<script setup lang="ts">
// Imports
import { ref, computed, onMounted } from 'vue';
import type { PropType } from 'vue';

// Props
const props = defineProps<{
  title: string;
  items: Item[];
  loading?: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: 'select', item: Item): void;
  (e: 'create'): void;
}>();

// State
const searchQuery = ref('');

// Computed
const filteredItems = computed(() => 
  props.items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
);

// Methods
function handleSelect(item: Item) {
  emit('select', item);
}

// Lifecycle
onMounted(() => {
  console.log('Component mounted');
});
</script>

<template>
  <div class="item-list">
    <header>
      <h2>{{ title }}</h2>
      <button @click="emit('create')">Create</button>
    </header>
    
    <input v-model="searchQuery" placeholder="Search..." />
    
    <div v-if="loading" class="loading">Loading...</div>
    
    <ul v-else>
      <li v-for="item in filteredItems" :key="item.id">
        <slot :item="item" name="item">
          {{ item.name }}
        </slot>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.item-list {
  padding: 1rem;
}
</style>
```

---

# Common Components

## Button Component

```vue
<script setup lang="ts">
import type { PropType } from 'vue';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const props = defineProps<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
}>();
</script>

<template>
  <button 
    :class="['btn', `btn-${props.variant}`, `btn-${props.size}`]"
    :disabled="props.disabled || props.loading"
  >
    <span v-if="loading" class="spinner"></span>
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

## Input Component

```vue
<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  label?: string;
  type?: string;
  error?: string;
  required?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div class="form-group">
    <label v-if="label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>
    <input
      :type="type || 'text'"
      :value="modelValue"
      @input="handleInput"
      :class="{ error: !!error }"
    />
    <span v-if="error" class="error-message">{{ error }}</span>
  </div>
</template>

<style scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.error-message {
  color: red;
  font-size: 0.875rem;
}
</style>
```

## Modal Component

```vue
<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  open: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => document.addEventListener('keydown', handleEscape));
onUnmounted(() => document.removeEventListener('keydown', handleEscape));
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay" @click.self="emit('close')">
        <div class="modal-content">
          <header class="modal-header">
            <h3>{{ title }}</h3>
            <button @click="emit('close')">&times;</button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
```

---

# Composable Patterns

## useForm Composable

```typescript
// composables/useForm.ts
import { ref, reactive, computed } from 'vue';

export function useForm<T extends Record<string, any>>(initial: T) {
  const values = reactive<T>({ ...initial });
  const errors = ref<Partial<Record<keyof T, string>>>({});
  const loading = ref(false);
  const touched = ref(false);

  const isValid = computed(() => 
    Object.keys(errors.value).length === 0
  );

  function setError(field: keyof T, message: string) {
    errors.value[field] = message;
  }

  function clearError(field: keyof T) {
    delete errors.value[field];
  }

  function reset() {
    Object.assign(values, initial);
    errors.value = {};
    touched.value = false;
  }

  return {
    values,
    errors,
    loading,
    touched,
    isValid,
    setError,
    clearError,
    reset,
  };
}
```

## useModal Composable

```typescript
// composables/useModal.ts
import { ref } from 'vue';

export function useModal() {
  const isOpen = ref(false);
  const data = ref<any>(null);

  function open(item?: any) {
    data.value = item;
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
    data.value = null;
  }

  return { isOpen, data, open, close };
}
```

---

# Constraints

**MUST DO:**
- Use Composition API
- Type all props and emits
- Use scoped styles
- Handle loading/error states

**MUST NOT DO:**
- Use Options API (unless legacy)
- Use any type without reason
- Skip accessibility
- Mix concerns in one component

---

# Gotchas

- **Props vs emits** â€?Props flow down, emits flow up
- **Slots** â€?Use slots for flexibility
- **Teleport** â€?For modals and overlays
- **Suspense** â€?For async components
- **Keep-alive** â€?Cache component state