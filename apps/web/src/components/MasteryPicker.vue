<template>
  <div class="mastery-options">
    <button
      v-for="(label, index) in MASTERY_LABELS"
      :key="label"
      type="button"
      class="mastery-chip"
      :class="{ active: modelValue === index }"
      :style="
        modelValue === index
          ? { background: `${MASTERY_COLORS[index]}18`, color: MASTERY_COLORS[index] }
          : {}
      "
      :disabled="disabled"
      :aria-pressed="modelValue === index"
      @click="$emit('select', index)"
    >
      {{ label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { MASTERY_COLORS, MASTERY_LABELS } from '@myos/shared';

withDefaults(
  defineProps<{
    modelValue: number;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

defineEmits<{
  select: [value: number];
}>();
</script>

<style scoped>
.mastery-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.mastery-chip {
  padding: 7px 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 11.5px;
  line-height: 1;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.mastery-chip.active {
  border-color: currentColor;
  font-weight: 700;
}

.mastery-chip:disabled {
  cursor: default;
  opacity: 0.55;
}
</style>
