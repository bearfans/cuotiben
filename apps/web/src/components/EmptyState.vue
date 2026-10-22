<template>
  <div class="empty-wrap">
    <span class="empty-icon" aria-hidden="true">
      <van-icon :name="icon" size="24" />
    </span>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="empty-desc">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    icon?: string;
  }>(),
  { icon: 'notes-o' },
);
</script>

<style scoped>
.empty-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 11px;
  border-radius: 15px;
  background: var(--brand-soft);
  color: var(--brand);
}

.empty-title {
  margin: 0;
  color: var(--text-2);
  font-size: 15px;
  font-weight: 600;
}

.empty-desc {
  margin: 6px auto 0;
  max-width: 280px;
  font-size: 12.5px;
  line-height: 1.6;
}
</style>
