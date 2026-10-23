<template>
  <span
    class="user-avatar"
    :class="[`user-avatar--${size}`, { 'user-avatar--add': add }]"
    aria-hidden="true"
  >
    <van-icon v-if="add" name="plus" />
    <van-icon v-else-if="!name" name="user-o" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    name?: string | null;
    size?: 'sm' | 'md' | 'lg';
    add?: boolean;
  }>(),
  { name: '', size: 'md', add: false },
);

const initial = computed(() => (props.name ?? '').trim().slice(0, 1) || '');
</script>

<style scoped>
.user-avatar {
  display: grid;
  place-items: center;
  width: var(--avatar-size);
  height: var(--avatar-size);
  flex: 0 0 auto;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  font-size: var(--avatar-font-size);
  font-weight: 600;
  line-height: 1;
  user-select: none;
}

.user-avatar--sm {
  --avatar-size: 34px;
  --avatar-font-size: 14px;
}

.user-avatar--md {
  --avatar-size: 42px;
  --avatar-font-size: 16px;
}

.user-avatar--lg {
  --avatar-size: 52px;
  --avatar-font-size: 20px;
}

.user-avatar--add {
  border-style: dashed;
  background: #f8fafc;
  color: #94a3b8;
}
</style>
