<template>
  <div class="outline-search">
    <input
      type="text"
      placeholder="🔍 搜索章节..."
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string }>();
defineEmits<{ (e: 'update:modelValue', value: string): void }>();
</script>

<style scoped>
.outline-search {
  margin-bottom: 8px;
}

.outline-search input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
  border: 1px solid var(--input);
  border-radius: var(--radius);
  background: var(--background);
  color: var(--foreground);
  outline: none;
  font-family: var(--font-sans);
}

.outline-search input::placeholder {
  color: var(--muted-foreground);
}

.outline-search input:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 2px var(--ring);
}
</style>
