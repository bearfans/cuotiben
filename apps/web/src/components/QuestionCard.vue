<template>
  <article
    class="question-card card"
    :class="{ selected, selectable }"
    @click="onClick"
  >
    <div v-if="selectable" class="check" @click.stop="emit('toggle', question.id)">
      <van-icon
        :name="selected ? 'checked' : 'circle'"
        :color="selected ? '#16a34a' : '#cbd5e1'"
        size="21"
      />
    </div>
    <div class="card-main">
      <div class="meta">
        <SubjectPill :subject-id="question.subjectId" :subject="question.subject" />
        <span class="type">{{ questionTypeLabel(question.questionType) }}</span>
        <MasteryBadge :value="question.mastery" />
        <span v-if="question.images?.length" class="image-flag">
          <van-icon name="photo-o" /> {{ question.images.length }}
        </span>
      </div>

      <div class="stem">
        <RichText :text="question.stem" />
      </div>

      <div v-if="question.knowledgePoints?.length" class="kp-row">
        <span v-for="point in question.knowledgePoints.slice(0, 3)" :key="point.id" class="kp">
          {{ point.name }}
        </span>
      </div>

      <div class="foot">
        <span>{{ formatDate(question.createdAt, 'MM-DD') }} 录入</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { questionTypeLabel, type WrongQuestion } from '@myos/shared';
import RichText from './RichText.vue';
import SubjectPill from './SubjectPill.vue';
import MasteryBadge from './MasteryBadge.vue';
import { formatDate } from '@/utils/format';

const props = withDefaults(
  defineProps<{
    question: WrongQuestion;
    selectable?: boolean;
    selected?: boolean;
  }>(),
  { selectable: false, selected: false },
);

const emit = defineEmits<{
  open: [question: WrongQuestion];
  toggle: [id: string];
}>();

const selected = computed(() => props.selected);

function onClick(): void {
  if (props.selectable) {
    emit('toggle', props.question.id);
  } else {
    emit('open', props.question);
  }
}
</script>

<style scoped>
.question-card {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 14px;
  margin-bottom: 10px;
  overflow: hidden;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.question-card:active {
  transform: scale(0.995);
}

.question-card.selected {
  box-shadow:
    0 0 0 1.5px var(--brand),
    var(--shadow-soft);
}

.check {
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}

.card-main {
  flex: 1;
  min-width: 0;
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.type {
  color: var(--muted);
  font-size: 11.5px;
}

.image-flag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--muted);
  font-size: 11.5px;
}

.stem {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text);
  font-size: 14.5px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.stem :deep(.katex-display) {
  display: inline-block;
  margin: 0;
}

.kp-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 9px;
}

.kp {
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 10.5px;
}

.foot {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 10px;
  color: var(--muted);
  font-size: 10.5px;
}
</style>
