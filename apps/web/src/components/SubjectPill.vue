<template>
  <span
    class="subject-pill"
    :style="{
      color: subject?.color ?? '#64748b',
      background: `${subject?.color ?? '#64748b'}14`,
    }"
  >
    {{ subject?.shortName ?? '综' }}
    <span class="name">{{ subject?.name ?? '综合' }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { SUBJECT_MAP, type Subject } from '@myos/shared';

const props = defineProps<{ subjectId?: string | null; subject?: Subject | null }>();

const subject = computed(() => props.subject ?? (props.subjectId ? SUBJECT_MAP[props.subjectId] : undefined));
</script>

<style scoped>
.subject-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
}

.name {
  font-weight: 600;
}
</style>
