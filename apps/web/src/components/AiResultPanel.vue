<template>
  <div class="ai-result">
    <div v-if="loading" class="processing card">
        <div class="scan-orb">
          <van-icon name="scan" size="32" />
        </div>
        <h2>AI 正在识别题目</h2>
        <p>正在提取题干、答案和知识点，通常需要几秒到半分钟</p>
        <van-loading size="22" color="var(--brand)" />
      </div>

      <template v-else-if="job">
        <div v-if="job.status === 'FAILED'" class="card failed-card">
          <EmptyState
            icon="warning-o"
            title="识别失败"
            :description="job.error || '图片可能不够清晰，请重新上传'"
          >
            <div class="failed-actions">
              <van-button round type="primary" @click="emit('reset')">重新上传</van-button>
            </div>
          </EmptyState>
        </div>

        <template v-else-if="items.length">
          <div class="list-head">
            <h2 class="section-title">识别结果</h2>
            <button type="button" class="retry-link" @click="emit('reset')">重新上传</button>
          </div>

          <article
            v-for="(item, index) in items"
            :key="item.key"
            class="result-card card"
            :class="{ excluded: !item.include }"
          >
            <div class="result-head">
              <button type="button" class="check-btn" @click="item.include = !item.include">
                <van-icon
                  :name="item.include ? 'passed' : 'circle'"
                  :color="item.include ? 'var(--brand)' : 'var(--muted)'"
                  size="22"
                />
              </button>
              <span class="result-index">{{ index + 1 }}</span>
              <SubjectPill :subject-id="item.draft.subjectId" />
              <span class="type-label">{{ questionTypeLabel(item.draft.questionType) }}</span>
              <span
                class="confidence"
                :class="{ low: item.confidence < 0.7 }"
              >
                {{ Math.round(item.confidence * 100) }}%
              </span>
              <button type="button" class="edit-btn" @click="openEditor(index)">
                <van-icon name="edit" /> 修正
              </button>
            </div>

            <div class="result-stem" :class="{ dim: !item.include }">
              <RichText :text="item.draft.stem" />
            </div>

            <div v-if="item.draft.options.length" class="result-options">
              <div v-for="option in item.draft.options" :key="option.label" class="result-option">
                <b>{{ option.label }}.</b>
                <RichText :text="option.content" />
              </div>
            </div>

            <div class="result-foot">
              <span v-if="item.draft.correctAnswer" class="answer">
                答案：{{ item.draft.correctAnswer }}
              </span>
              <span v-if="item.draft.knowledgePoints.length" class="kp">
                {{ item.draft.knowledgePoints.join(' · ') }}
              </span>
            </div>
          </article>
        </template>

        <div v-else class="card empty-result">
          <EmptyState
            icon="search"
            title="未识别到错题"
            description="正确题目和无法识别的题目不会返回；可以换一张更清晰的图片重试"
          >
            <van-button round type="primary" @click="emit('reset')">重新上传</van-button>
          </EmptyState>
        </div>
      </template>

      <div v-if="items.length && job && job.status !== 'FAILED'" class="confirm-save-bar">
        <van-button
          block
          round
          type="primary"
          :loading="saving"
          :disabled="!selectedCount"
          @click="save"
        >
          {{ selectedCount ? `保存 ${selectedCount} 道错题` : '保存到错题本' }}
        </van-button>
      </div>

    <van-popup
      v-model:show="showEditor"
      position="bottom"
      round
      :style="{ height: '90%' }"
      class="editor-popup"
    >
      <div class="editor-head">
        <button type="button" class="editor-cancel" @click="showEditor = false">取消</button>
        <strong>修正题目信息</strong>
        <button type="button" class="editor-save" @click="applyEditor">完成</button>
      </div>
      <div class="editor-scroll">
        <QuestionForm
          v-if="editDraft"
          :draft="editDraft"
          :subjects="studentStore.subjects"
        />
        <div class="safe-bottom" />
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showLoadingToast, showToast } from 'vant';
import {
  SUBJECT_MAP,
  questionTypeLabel,
  type AiJob,
  type AiQuestionResult,
  type Semester,
} from '@myos/shared';
import { aiApi, questionsApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useStudentStore } from '@/stores/student';
import EmptyState from '@/components/EmptyState.vue';
import RichText from '@/components/RichText.vue';
import SubjectPill from '@/components/SubjectPill.vue';
import QuestionForm from '@/components/QuestionForm.vue';
import { draftToPayload, isValidDraft, type QuestionDraft } from '@/types/question';

interface ConfirmItem {
  key: string;
  include: boolean;
  confidence: number;
  draft: QuestionDraft;
}

const props = defineProps<{ jobId: string }>();
const emit = defineEmits<{ (e: 'reset'): void }>();

const router = useRouter();
const studentStore = useStudentStore();

const job = ref<AiJob | null>(null);
const loading = ref(true);
const items = ref<ConfirmItem[]>([]);
const saving = ref(false);
const showEditor = ref(false);
const editIndex = ref(-1);
const editDraft = ref<QuestionDraft | null>(null);
const notifiedJobId = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

const selectedCount = computed(() => items.value.filter((item) => item.include).length);

function buildItems(nextJob: AiJob): ConfirmItem[] {
  const result: ConfirmItem[] = [];
  for (const image of nextJob.images) {
    if (!image.result?.questions?.length) continue;
    for (const [index, question] of image.result.questions.entries()) {
      if (question.isWrong === false) continue;
      const subject = resolveSubject(question, image.result.subject, nextJob);
      result.push({
        key: `${image.id}-${index}`,
        include: true,
        confidence: question.confidence ?? 0.8,
        draft: {
          subjectId: subject,
          grade: nextJob.grade,
          semester: nextJob.semester as Semester,
          questionType: question.questionType,
          stem: question.stem,
          options:
            (question.options ?? []).length > 0
              ? (question.options ?? []).map((option) => ({
                  label: option.label,
                  content: option.content,
                }))
              : question.questionType === 'SINGLE_CHOICE' ||
                  question.questionType === 'MULTIPLE_CHOICE'
                ? ['A', 'B', 'C', 'D'].map((label) => ({ label, content: '' }))
                : [],
          correctAnswer: question.correctAnswer ?? '',
          studentAnswer: question.studentAnswer ?? '',
          analysis: question.analysis ?? '',
          errorReason: question.errorReason ?? '',
          note: '',
          difficulty: question.difficulty ?? 4,
          mastery: 0,
          knowledgePoints: question.knowledgePoints ?? [],
        },
      });
    }
  }
  return result;
}

function resolveSubject(
  question: AiQuestionResult,
  resultSubject: string | undefined,
  nextJob: AiJob,
): string {
  const candidates = [resultSubject, nextJob.subjectHint];
  for (const candidate of candidates) {
    if (candidate && SUBJECT_MAP[candidate]) return candidate;
  }
  const byName = Object.values(SUBJECT_MAP).find(
    (subject) => subject.name === resultSubject || subject.shortName === resultSubject,
  );
  if (byName) return byName.id;
  return studentStore.subjects[0]?.id ?? 'other';
}

async function loadJob(initial = false): Promise<void> {
  if (initial) loading.value = true;
  try {
    const { data } = await aiApi.getJob(props.jobId);
    job.value = data;
    if (data.status === 'SUCCEEDED' || data.status === 'PARTIAL') {
      if (!items.value.length) {
        items.value = buildItems(data);
      }
      if (notifiedJobId.value !== data.id) {
        notifiedJobId.value = data.id;
        const wrongCount = items.value.length;
        const unreadableCount = data.images.reduce(
          (sum, image) => sum + (image.result?.unreadableCount ?? 0),
          0,
        );
        const parts = [
          wrongCount ? `识别完成，共 ${wrongCount} 道错题` : '识别完成，未识别到错题',
        ];
        if (unreadableCount > 0) {
          parts.push(`由于题目过于模糊${unreadableCount}道题无法识别`);
        }
        showToast(
          wrongCount
            ? { message: `${parts.join('。')}。`, icon: 'passed', duration: 3000 }
            : { message: `${parts.join('。')}。`, duration: 3000 },
        );
      }
      stopPolling();
      loading.value = false;
    } else if (data.status === 'FAILED') {
      stopPolling();
      loading.value = false;
    } else {
      loading.value = true;
      startPolling();
    }
  } catch (error) {
    stopPolling();
    loading.value = false;
    showToast(errorMessage(error));
  }
}

function startPolling(): void {
  if (timer) return;
  timer = setInterval(() => {
    void loadJob();
  }, 1600);
}

function stopPolling(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function openEditor(index: number): void {
  editIndex.value = index;
  editDraft.value = JSON.parse(JSON.stringify(items.value[index].draft)) as QuestionDraft;
  showEditor.value = true;
}

function applyEditor(): void {
  if (editIndex.value < 0 || !editDraft.value) return;
  if (!isValidDraft(editDraft.value)) {
    showToast('请填写题目内容和学科');
    return;
  }
  items.value[editIndex.value].draft = editDraft.value;
  showEditor.value = false;
}

async function save(): Promise<void> {
  const studentId = job.value?.studentId ?? studentStore.currentStudentId;
  if (!studentId) {
    showToast('请先添加孩子档案');
    return;
  }
  const invalidIndex = items.value.findIndex(
    (item) => item.include && !isValidDraft(item.draft),
  );
  if (invalidIndex >= 0) {
    openEditor(invalidIndex);
    showToast('请补全这道题的信息');
    return;
  }
  const selected = items.value.filter((item) => item.include);
  if (!selected.length) {
    showToast('请至少选择一道题目');
    return;
  }

  saving.value = true;
  const toast = showLoadingToast({ message: '正在保存...', forbidClick: true, duration: 0 });
  try {
    await questionsApi.batchCreate({
      studentId,
      sourceJobId: job.value?.id,
      questions: selected.map((item) =>
        draftToPayload(item.draft, {
          source: 'AI',
          sourceJobId: job.value?.id,
        }),
      ),
    });
    toast.close();
    showToast({ type: 'success', icon: 'passed', message: `已保存 ${selected.length} 道错题` });
    await router.replace('/questions');
  } catch (error) {
    toast.close();
    showToast(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadJob(true);
});

onBeforeUnmount(stopPolling);
</script>

<style scoped>
.ai-result {
  display: block;
}

.processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 24px;
  text-align: center;
}

.scan-orb {
  display: grid;
  place-items: center;
  width: 74px;
  height: 74px;
  margin-bottom: 18px;
  border-radius: 24px;
  background: linear-gradient(145deg, var(--brand-soft), var(--surface));
  color: var(--brand);
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.12);
  }
  50% {
    transform: scale(1.04);
    box-shadow: 0 0 0 14px rgba(var(--accent-rgb), 0);
  }
}

.processing h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.processing p {
  max-width: 260px;
  margin: 0 0 20px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.failed-card,
.empty-result {
  padding: 28px 16px;
}

.failed-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 16px;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 4px 2px 10px;
}

.retry-link {
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--brand);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.result-card {
  position: relative;
  padding: 13px 14px 12px;
  margin-bottom: 10px;
  transition: opacity 0.18s ease;
}

.result-card.excluded {
  opacity: 0.52;
}

.result-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.check-btn {
  display: flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
}

.result-index {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.type-label {
  color: var(--muted);
  font-size: 11px;
}

.confidence {
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 9.5px;
  font-weight: 700;
}

.confidence.low {
  background: var(--amber-soft);
  color: var(--warning-strong);
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  padding: 4px 8px;
  border: 0;
  border-radius: 7px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 10.5px;
  font-weight: 600;
}

.result-stem {
  color: var(--text);
  font-size: 13.5px;
  line-height: 1.65;
  word-break: break-word;
}

.result-stem.dim {
  color: var(--text-2);
}

.result-stem :deep(.katex-display) {
  display: inline-block;
  margin: 0;
}

.result-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 8px;
  color: var(--text-2);
  font-size: 12px;
}

.result-option {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.result-option b {
  color: var(--brand);
}

.result-foot {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 8px;
}

.answer {
  color: var(--brand-dark);
  font-size: 11.5px;
  font-weight: 600;
}

.kp {
  color: var(--muted);
  font-size: 10.5px;
}

.confirm-save-bar {
  position: sticky;
  bottom: calc(70px + var(--safe-bottom));
  z-index: 20;
  display: block;
  margin: 16px -16px 0;
  padding: 10px 16px;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow:
    0 -10px 30px -8px rgba(15, 23, 42, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.confirm-save-bar :deep(.van-button) {
  width: 100%;
}

.editor-popup {
  display: flex;
  flex-direction: column;
}

.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--line);
}

.editor-head strong {
  font-size: 15px;
}

.editor-cancel,
.editor-save {
  border: 0;
  background: transparent;
  font-size: 13px;
}

.editor-cancel {
  color: var(--muted);
}

.editor-save {
  color: var(--brand);
  font-weight: 700;
}

.editor-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 12px 0;
}
</style>
