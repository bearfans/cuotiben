<template>
  <div class="empty-wrap">
    <span class="empty-emoji">{{ emoji }}</span>
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
    emoji?: string;
  }>(),
  { emoji: '🌱' },
);
</script>

<style scoped>
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
