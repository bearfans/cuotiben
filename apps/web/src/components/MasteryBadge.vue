<template>
  <span class="mastery" :style="{ color: color, background: soft }">
    <span class="dot" :style="{ background: color }" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { MASTERY_COLORS, MASTERY_LABELS } from '@myos/shared';

const props = defineProps<{ value: number }>();

const label = computed(() => MASTERY_LABELS[props.value] ?? '未掌握');
const color = computed(() => MASTERY_COLORS[props.value] ?? '#ef4444');
const soft = computed(() => `${color.value}16`);
</script>

<style scoped>
.mastery {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
</style>
