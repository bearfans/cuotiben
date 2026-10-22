<template>
  <div>
    <PageHeader title="错题详情" :subtitle="question ? formatDate(question.createdAt, 'YYYY年MM月DD日录入') : ''">
      <template #right>
        <button v-if="question" type="button" class="icon-btn" @click="router.push(`/questions/${question.id}/edit`)">
          <van-icon name="edit" size="18" />
        </button>
      </template>
    </PageHeader>

    <div v-if="loading" class="page">
      <div class="skeleton-card" style="height: 260px" />
      <div class="skeleton-card" />
    </div>

    <div v-else-if="question" class="page detail-page">
      <div class="card question-main">
        <div class="meta-row">
          <SubjectPill :subject-id="question.subjectId" :subject="question.subject" />
          <span class="type">{{ questionTypeLabel(question.questionType) }}</span>
          <MasteryBadge :value="question.mastery" />
          <span class="difficulty">
            难度
            <van-rate
              :model-value="question.difficulty"
              readonly
              :size="11"
              color="#f59e0b"
              void-color="#e2e8f0"
            />
          </span>
        </div>

        <div class="stem">
          <RichText :text="question.stem" />
        </div>

        <div v-if="question.options?.length" class="options">
          <div v-for="option in question.options" :key="option.label" class="option">
            <span class="option-label">{{ option.label }}</span>
            <RichText :text="option.content" />
          </div>
        </div>

        <div v-if="question.images.length" class="images">
          <van-image
            v-for="image in question.images"
            :key="image.id"
            :src="image.url"
            :alt="image.kind === 'SOURCE' ? '原题图片' : '题目配图'"
            fit="cover"
            radius="10"
            @click="previewImages(question.images, image.url)"
          />
        </div>
      </div>

      <div class="card mastery-card">
        <div class="mastery-head">
          <div class="mastery-copy">
            <strong>掌握程度</strong>
            <span>点击下方标签更新这道错题</span>
          </div>
          <MasteryBadge :value="question.mastery" />
        </div>
        <MasteryPicker
          :model-value="question.mastery"
          :disabled="savingMastery"
          @select="updateMastery"
        />
      </div>

      <div class="card answer-card">
        <div class="answer-row correct">
          <span class="answer-label"><van-icon name="passed" /> 正确答案</span>
          <RichText :text="question.correctAnswer || '暂无答案'" />
        </div>
        <div v-if="question.studentAnswer" class="answer-row wrong">
          <span class="answer-label"><van-icon name="cross" /> 孩子原答案</span>
          <RichText :text="question.studentAnswer" />
        </div>
        <div v-if="question.analysis" class="answer-row">
          <span class="answer-label"><van-icon name="notes-o" /> 解析</span>
          <RichText :text="question.analysis" />
        </div>
        <div v-if="question.errorReason" class="answer-row reason">
          <span class="answer-label"><van-icon name="warning-o" /> 错因</span>
          <RichText :text="question.errorReason" />
        </div>
      </div>

      <div v-if="question.knowledgePoints.length" class="card kp-card">
        <div class="block-title">知识点</div>
        <div class="kp-tags">
          <span v-for="point in question.knowledgePoints" :key="point.id" class="kp-tag">
            {{ point.name }}
          </span>
        </div>
      </div>

      <div v-if="question.note" class="card note-card">
        <div class="block-title">备注</div>
        <RichText :text="question.note" />
      </div>

      <div class="detail-actions">
        <van-button block round type="primary" icon="description-o" @click="addToPaper">
          加入组卷
        </van-button>
        <div class="secondary-actions">
          <van-button round plain icon="edit" @click="router.push(`/questions/${question.id}/edit`)">
            编辑
          </van-button>
          <van-button round plain type="danger" icon="delete-o" @click="removeQuestion">
            删除
          </van-button>
        </div>
      </div>
    </div>

    <div v-else class="page">
      <EmptyState icon="search" title="错题不存在" description="它可能已被删除">
        <van-button round type="primary" @click="router.replace('/questions')">返回错题本</van-button>
      </EmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showImagePreview, showToast } from 'vant';
import {
  questionTypeLabel,
  type QuestionImage,
  type WrongQuestion,
} from '@myos/shared';
import { questionsApi } from '@/api';
import { errorMessage } from '@/api/client';
import { usePaperSelectionStore } from '@/stores/paperSelection';
import PageHeader from '@/components/PageHeader.vue';
import RichText from '@/components/RichText.vue';
import SubjectPill from '@/components/SubjectPill.vue';
import MasteryBadge from '@/components/MasteryBadge.vue';
import MasteryPicker from '@/components/MasteryPicker.vue';
import EmptyState from '@/components/EmptyState.vue';
import { formatDate } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const paperSelection = usePaperSelectionStore();

const question = ref<WrongQuestion | null>(null);
const loading = ref(true);
const savingMastery = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const { data } = await questionsApi.get(String(route.params.id));
    question.value = data;
  } catch (error) {
    showToast(errorMessage(error));
    question.value = null;
  } finally {
    loading.value = false;
  }
}

function previewImages(images: QuestionImage[], current: string): void {
  showImagePreview({ images: images.map((image) => image.url), startPosition: Math.max(0, images.findIndex((image) => image.url === current)) });
}

async function addToPaper(): Promise<void> {
  if (!question.value) return;
  const merged = Array.from(new Set([...paperSelection.ids, question.value.id])).slice(0, 50);
  paperSelection.set(merged);
  showToast('已加入组卷');
  await router.push('/papers/new');
}

async function updateMastery(value: number): Promise<void> {
  if (!question.value || question.value.mastery === value || savingMastery.value) return;
  const previous = question.value.mastery;
  question.value.mastery = value;
  savingMastery.value = true;
  try {
    const { data } = await questionsApi.update(question.value.id, { mastery: value });
    question.value = data;
    showToast({ type: 'success', icon: 'passed', message: '掌握程度已更新' });
  } catch (error) {
    question.value.mastery = previous;
    showToast(errorMessage(error));
  } finally {
    savingMastery.value = false;
  }
}

async function removeQuestion(): Promise<void> {
  if (!question.value) return;
  try {
    await showConfirmDialog({
      title: '删除错题',
      message: '删除后将无法恢复，确认删除这道错题吗？',
      confirmButtonText: '删除',
      confirmButtonColor: '#e11d48',
    });
    await questionsApi.remove(question.value.id);
    showToast('已删除');
    await router.replace('/questions');
  } catch (error) {
    if (error !== 'cancel') showToast(errorMessage(error));
  }
}

onMounted(load);
</script>

<style scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-2);
  box-shadow: var(--shadow-soft);
}

.question-main {
  padding: 16px;
}

.mastery-card {
  padding: 14px 16px;
}

.mastery-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mastery-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mastery-copy strong {
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}

.mastery-copy span {
  color: var(--muted);
  font-size: 10.5px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.type {
  color: var(--muted);
  font-size: 11.5px;
}

.difficulty {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 11px;
}

.stem {
  font-size: 15px;
  line-height: 1.75;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-soft);
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13.5px;
  line-height: 1.6;
}

.option-label {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--surface);
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
}

.images {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.images :deep(.van-image) {
  width: 92px;
  height: 92px;
  overflow: hidden;
  border-radius: 10px;
}

.answer-card {
  padding: 4px 16px;
}

.answer-row {
  padding: 13px 0;
  border-bottom: 1px solid var(--line);
  font-size: 13.5px;
  line-height: 1.7;
}

.answer-row:last-child {
  border-bottom: 0;
}

.answer-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  color: var(--text-2);
  font-size: 11.5px;
  font-weight: 600;
}

.answer-row.correct .answer-label {
  color: var(--brand-dark);
}

.answer-row.wrong .answer-label {
  color: var(--rose);
}

.answer-row.reason .answer-label {
  color: #d97706;
}

.kp-card,
.note-card {
  padding: 15px 16px;
}

.block-title {
  margin-bottom: 9px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}

.kp-tags {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.kp-tag {
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 11.5px;
  font-weight: 500;
}

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.secondary-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.secondary-actions :deep(.van-button) {
  font-size: 12px;
}
</style>
