<template>
  <div class="question-form">
    <div class="form-card card">
      <van-field
        v-model="draft.stem"
        type="textarea"
        rows="3"
        autosize
        label="题目"
        label-align="top"
        placeholder="输入或粘贴题目内容，支持 $LaTeX$ 公式"
        maxlength="30000"
      />
    </div>

    <div class="form-card card">
      <van-field
        label="学科"
        :model-value="subjectName"
        readonly
        is-link
        placeholder="选择学科"
        @click="showSubject = true"
      />
      <van-field
        label="题型"
        :model-value="questionTypeLabel(draft.questionType)"
        readonly
        is-link
        @click="showType = true"
      />
      <van-field
        label="年级"
        :model-value="gradeLabel(draft.grade)"
        readonly
        is-link
        @click="showGrade = true"
      />
      <van-field
        label="学期"
        :model-value="semesterLabel(draft.semester)"
        readonly
        is-link
        @click="showSemester = true"
      />
    </div>

    <div v-if="isChoice" class="form-card card">
      <div class="block-head">
        <span>选项</span>
        <button type="button" class="mini-link" @click="addOption">+ 添加选项</button>
      </div>
      <div v-for="(option, index) in draft.options" :key="index" class="option-row">
        <input v-model="option.label" class="option-label" maxlength="4" aria-label="选项编号" />
        <van-field
          v-model="option.content"
          class="option-field"
          placeholder="选项内容"
          :border="false"
        />
        <button
          v-if="draft.options.length > 2"
          type="button"
          class="option-remove"
          aria-label="删除选项"
          @click="removeOption(index)"
        >
          <van-icon name="cross" />
        </button>
      </div>
    </div>

    <div class="form-card card">
      <van-field
        v-model="draft.correctAnswer"
        label="正确答案"
        label-align="top"
        type="textarea"
        rows="1"
        autosize
        placeholder="选择题可填 A / AB，解答题填写完整答案"
      />
      <van-field
        v-model="draft.studentAnswer"
        label="孩子原答案"
        label-align="top"
        type="textarea"
        rows="1"
        autosize
        placeholder="选填，记录当时的错误答案"
      />
      <van-field
        v-model="draft.errorReason"
        label="错因"
        label-align="top"
        type="textarea"
        rows="1"
        autosize
        placeholder="选填，例如：单位换算错误、审题不清"
      />
      <van-field
        v-model="draft.analysis"
        label="解析"
        label-align="top"
        type="textarea"
        rows="2"
        autosize
        placeholder="选填，支持 LaTeX 公式"
      />
    </div>

    <div class="form-card card">
      <div class="block-head">
        <span>知识点</span>
        <span class="muted tiny">最多 8 个</span>
      </div>
      <div v-if="draft.knowledgePoints.length" class="tag-wrap">
        <van-tag
          v-for="point in draft.knowledgePoints"
          :key="point"
          closeable
          size="medium"
          type="primary"
          plain
          @close="removeKnowledgePoint(point)"
        >
          {{ point }}
        </van-tag>
      </div>
      <div class="kp-input">
        <van-field
          v-model="knowledgeInput"
          placeholder="输入知识点后点击添加"
          :border="false"
          maxlength="40"
          @keyup.enter="addKnowledgePoint"
        />
        <van-button size="small" round type="primary" plain @click="addKnowledgePoint">
          添加
        </van-button>
      </div>
    </div>

    <div class="form-card card">
      <div class="rate-row">
        <span class="rate-label">难度</span>
        <van-stepper v-model="draft.difficulty" :min="1" :max="5" integer />
      </div>
      <div class="mastery-block">
        <span class="rate-label">掌握程度</span>
        <div class="mastery-options">
          <button
            v-for="(label, index) in MASTERY_LABELS"
            :key="label"
            type="button"
            class="mastery-chip"
            :class="{ active: draft.mastery === index }"
            :style="
              draft.mastery === index
                ? { background: `${MASTERY_COLORS[index]}18`, color: MASTERY_COLORS[index] }
                : {}
            "
            @click="draft.mastery = index"
          >
            {{ label }}
          </button>
        </div>
      </div>
      <van-field
        v-model="draft.note"
        label="备注"
        label-align="top"
        type="textarea"
        rows="1"
        autosize
        placeholder="选填，记录错题背景等"
      />
    </div>

    <van-popup v-model:show="showSubject" position="bottom" round>
      <van-picker
        :columns="subjectColumns"
        title="选择学科"
        @confirm="onSubjectConfirm"
        @cancel="showSubject = false"
      />
    </van-popup>
    <van-popup v-model:show="showType" position="bottom" round>
      <van-picker
        :columns="typeColumns"
        title="选择题型"
        @confirm="onTypeConfirm"
        @cancel="showType = false"
      />
    </van-popup>
    <van-popup v-model:show="showGrade" position="bottom" round>
      <van-picker
        :columns="gradeColumns"
        title="选择年级"
        @confirm="onGradeConfirm"
        @cancel="showGrade = false"
      />
    </van-popup>
    <van-popup v-model:show="showSemester" position="bottom" round>
      <van-picker
        :columns="semesterColumns"
        title="选择学期"
        @confirm="onSemesterConfirm"
        @cancel="showSemester = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PickerConfirmEventParams, PickerOption } from 'vant';
import {
  MASTERY_COLORS,
  MASTERY_LABELS,
  QUESTION_TYPES,
  SEMESTERS,
  gradeLabel,
  questionTypeLabel,
  semesterLabel,
  type QuestionType,
  type Subject,
} from '@myos/shared';
import type { QuestionDraft } from '@/types/question';
import { GRADE_OPTIONS } from '@/types/question';

const props = defineProps<{
  draft: QuestionDraft;
  subjects: Subject[];
}>();

const showSubject = ref(false);
const showType = ref(false);
const showGrade = ref(false);
const showSemester = ref(false);
const knowledgeInput = ref('');

const isChoice = computed(
  () =>
    props.draft.questionType === 'SINGLE_CHOICE' ||
    props.draft.questionType === 'MULTIPLE_CHOICE',
);

const subjectName = computed(
  () => props.subjects.find((subject) => subject.id === props.draft.subjectId)?.name ?? '请选择',
);

const subjectColumns = computed<PickerOption[]>(() =>
  props.subjects.map((subject) => ({ text: subject.name, value: subject.id })),
);

const typeColumns: PickerOption[] = QUESTION_TYPES.map((type) => ({
  text: type.label,
  value: type.value,
}));

const gradeColumns: PickerOption[] = GRADE_OPTIONS.map((grade) => ({
  text: grade.text,
  value: grade.value,
}));

const semesterColumns: PickerOption[] = SEMESTERS.map((semester) => ({
  text: semester.label,
  value: semester.value,
}));

function onSubjectConfirm(event: PickerConfirmEventParams): void {
  props.draft.subjectId = String(event.selectedValues[0] ?? '');
  showSubject.value = false;
}

function onTypeConfirm(event: PickerConfirmEventParams): void {
  props.draft.questionType = String(event.selectedValues[0] ?? 'OTHER') as QuestionType;
  showType.value = false;
}

function onGradeConfirm(event: PickerConfirmEventParams): void {
  props.draft.grade = Number(event.selectedValues[0] ?? 1);
  showGrade.value = false;
}

function onSemesterConfirm(event: PickerConfirmEventParams): void {
  props.draft.semester = String(event.selectedValues[0] ?? 'FIRST') as QuestionDraft['semester'];
  showSemester.value = false;
}

function addOption(): void {
  if (props.draft.options.length >= 8) return;
  props.draft.options.push({
    label: String.fromCharCode(65 + props.draft.options.length),
    content: '',
  });
}

function removeOption(index: number): void {
  props.draft.options.splice(index, 1);
  props.draft.options.forEach((option, optionIndex) => {
    option.label = String.fromCharCode(65 + optionIndex);
  });
}

function addKnowledgePoint(): void {
  const value = knowledgeInput.value.trim();
  if (!value || props.draft.knowledgePoints.includes(value)) {
    knowledgeInput.value = '';
    return;
  }
  if (props.draft.knowledgePoints.length >= 8) return;
  props.draft.knowledgePoints.push(value);
  knowledgeInput.value = '';
}

function removeKnowledgePoint(value: string): void {
  props.draft.knowledgePoints = props.draft.knowledgePoints.filter((point) => point !== value);
}
</script>

<style scoped>
.question-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-card {
  overflow: hidden;
  padding: 4px 0;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 4px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
}

.tiny {
  font-size: 11px;
  font-weight: 400;
}

.mini-link {
  border: 0;
  background: transparent;
  color: var(--brand);
  font-size: 12px;
  font-weight: 600;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 16px;
}

.option-label {
  width: 28px;
  height: 30px;
  flex: 0 0 auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.option-field {
  flex: 1;
  padding: 4px 0;
}

.option-remove {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 50%;
  background: var(--surface-soft);
  color: var(--muted);
}

.tag-wrap {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px 16px 10px;
}

.kp-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 10px;
}

.kp-input :deep(.van-field) {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
}

.rate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.rate-label {
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
}

.mastery-block {
  padding: 4px 16px 12px;
}

.mastery-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.mastery-chip {
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 11.5px;
}

.mastery-chip.active {
  border-color: currentColor;
  font-weight: 700;
}
</style>
