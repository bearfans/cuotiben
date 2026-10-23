<template>
  <div ref="rootRef" class="page-actions">
    <button
      type="button"
      class="page-actions-trigger"
      aria-label="更多操作"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <van-icon name="ellipsis" size="20" />
    </button>
    <transition name="page-actions">
      <ul v-if="open" class="page-actions-menu" role="menu">
        <li v-for="action in actions" :key="action.value">
          <button
            type="button"
            role="menuitem"
            class="page-actions-item"
            :class="{ danger: action.danger }"
            :disabled="action.disabled"
            @click="onSelect(action)"
          >
            <van-icon v-if="action.icon" :name="action.icon" size="16" />
            <span>{{ action.label }}</span>
            <van-loading v-if="action.loading" size="14" />
          </button>
        </li>
        <li v-if="!actions.length" class="page-actions-empty">暂无操作</li>
      </ul>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

interface PageAction {
  label: string;
  value: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

defineProps<{ actions: PageAction[] }>();
const emit = defineEmits<{ (e: 'select', value: string): void }>();
const rootRef = ref<HTMLElement | null>(null);
const open = ref(false);

function toggle(): void {
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

function onSelect(action: PageAction): void {
  if (action.disabled) return;
  close();
  emit('select', action.value);
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('scroll', close, true);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('scroll', close, true);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.page-actions {
  position: relative;
  flex: 0 0 auto;
}

.page-actions-trigger {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--glass-border-soft);
  border-radius: 50%;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  color: var(--text);
  box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.page-actions-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 40;
  min-width: 168px;
  max-width: 220px;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 14px;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow: 0 12px 32px -8px rgba(15, 23, 42, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.page-actions-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
}

.page-actions-item:disabled {
  color: var(--muted);
  cursor: not-allowed;
}

.page-actions-item:not(:disabled):active {
  background: var(--surface-soft);
}

.page-actions-item.danger {
  color: var(--danger);
}

.page-actions-empty {
  padding: 10px;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.page-actions-enter-active,
.page-actions-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.page-actions-enter-from,
.page-actions-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
