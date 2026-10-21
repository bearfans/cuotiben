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
            <van-icon name="star-o" /> 难度 {{ question.difficulty }}
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

      <div class="card answer-card">
        <div class="answer-row correct">
          <span class="answer-label"><van-icon name="success" /> 正确答案</span>
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

      <div class="card review-info">
        <div class="review-item">
          <strong>{{ question.reviewCount }}</strong>
          <span>已复习次数</span>
        </div>
        <div class="review-item">
          <strong>{{ question.intervalDays }}<small>天</small></strong>
          <span>当前间隔</span>
        </div>
        <div class="review-item">
          <strong>{{ formatRelative(question.nextReviewAt) }}</strong>
          <span>下次复习</span>
        </div>
      </div>

      <div class="detail-actions">
        <van-button block round type="primary" icon="replay" @click="showRating = true">
          完成一次复习
        </van-button>
        <div class="secondary-actions">
          <van-button round plain icon="description-o" @click="addToPaper">加入组卷</van-button>
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
      <EmptyState emoji="🔍" title="错题不存在" description="它可能已被删除">
        <van-button round type="primary" @click="router.replace('/questions')">返回错题本</van-button>
      </EmptyState>
    </div>

    <van-popup v-model:show="showRating" position="bottom" round>
      <div class="rating-sheet">
        <h3>这次复习感觉如何？</h3>
        <p>根据掌握情况选择，系统会自动调整下次复习时间</p>
        <div class="rating-options">
          <button
            v-for="rating in REVIEW_RATINGS"
            :key="rating.value"
            type="button"
            class="rating-option"
            :style="{ '--rating-color': rating.color }"
            :disabled="ratingLoading"
            @click="completeReview(rating.value)"
          >
            <span class="rating-dot" />
            <span class="rating-main">
              <strong>{{ rating.label }}</strong>
              <small>{{ rating.description }}</small>
            </span>
            <van-icon name="arrow" color="#cbd5e1" />
          </button>
        </div>
        <van-button block round plain @click="showRating = false">稍后再说</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showImagePreview, showToast } from 'vant';
import {
  REVIEW_RATINGS,
  questionTypeLabel,
  type QuestionImage,
  type ReviewRating,
  type WrongQuestion,
} from '@myos/shared';
import { questionsApi, reviewApi } from '@/api';
import { errorMessage } from '@/api/client';
import { usePaperSelectionStore } from '@/stores/paperSelection';
import PageHeader from '@/components/PageHeader.vue';
import RichText from '@/components/RichText.vue';
import SubjectPill from '@/components/SubjectPill.vue';
import MasteryBadge from '@/components/MasteryBadge.vue';
import EmptyState from '@/components/EmptyState.vue';
import { formatDate, formatRelative } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const paperSelection = usePaperSelectionStore();

const question = ref<WrongQuestion | null>(null);
const loading = ref(true);
const showRating = ref(false);
const ratingLoading = ref(false);

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

async function completeReview(rating: ReviewRating): Promise<void> {
  if (!question.value) return;
  ratingLoading.value = true;
  try {
    const { data } = await reviewApi.complete(question.value.id, rating);
    question.value = data;
    showRating.value = false;
    showToast({ type: 'success', message: '复习完成，已安排下次复习' });
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    ratingLoading.value = false;
  }
}

async function addToPaper(): Promise<void> {
  if (!question.value) return;
  const merged = Array.from(new Set([...paperSelection.ids, question.value.id])).slice(0, 50);
  paperSelection.set(merged);
  showToast('已加入组卷');
  await router.push('/papers/new');
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
  gap: 2px;
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
  color: var(--teal);
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

.review-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 14px 0;
}

.review-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  border-right: 1px solid var(--line);
}

.review-item:last-child {
  border-right: 0;
}

.review-item strong {
  color: var(--text);
  font-size: 17px;
  font-weight: 800;
}

.review-item strong small {
  font-size: 10px;
  font-weight: 500;
}

.review-item span {
  color: var(--muted);
  font-size: 10.5px;
}

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.secondary-actions {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 8px;
}

.secondary-actions :deep(.van-button) {
  font-size: 12px;
}

.rating-sheet {
  padding: 20px 18px calc(18px + var(--safe-bottom));
}

.rating-sheet h3 {
  margin: 0;
  font-size: 19px;
  text-align: center;
}

.rating-sheet > p {
  margin: 6px 0 18px;
  color: var(--muted);
  font-size: 11.5px;
  text-align: center;
}

.rating-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.rating-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  text-align: left;
}

.rating-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--rating-color);
}

.rating-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  line-height: 1.35;
}

.rating-main strong {
  font-size: 14px;
}

.rating-main small {
  color: var(--muted);
  font-size: 10.5px;
}
</style>
