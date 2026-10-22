<template>
  <div>
    <PageHeader
      :title="paper?.title ?? '试卷详情'"
      :subtitle="paper ? `${paper.questionCount} 道题 · ${formatDate(paper.createdAt, 'YYYY年MM月DD日')}` : ''"
    >
      <template #right>
        <button v-if="paper" type="button" class="icon-btn" @click="openRename">
          <van-icon name="edit" size="17" />
        </button>
      </template>
    </PageHeader>

    <div v-if="loading" class="page">
      <div class="skeleton-card" style="height: 150px" />
      <div class="skeleton-card" style="height: 300px" />
    </div>

    <div v-else-if="paper" class="page paper-detail">
      <div class="paper-hero card">
        <div class="hero-head">
          <div class="hero-icon"><van-icon name="description-o" size="26" /></div>
          <div class="hero-copy">
            <h2>{{ paper.title }}</h2>
            <p>
              <span v-if="paper.subjectId">{{ subjectName(paper.subjectId) }}</span>
              <span>{{ gradeLabel(paper.grade) }}</span>
              <span>{{ paper.questionCount }} 道题</span>
            </p>
          </div>
        </div>

        <div class="paper-settings">
          <span v-if="paper.settings.includeAnswers">含答案解析</span>
          <span v-if="paper.settings.includeKnowledgePoints">含知识点</span>
          <span v-if="paper.settings.includeStudentAnswer">含原作答</span>
          <span v-if="paper.settings.showScore">含得分栏</span>
        </div>

        <div class="hero-actions">
          <van-button round type="primary" icon="newspaper-o" @click="printPaper">打印 / 预览</van-button>
          <van-button round plain icon="down" :loading="downloading" @click="downloadPdf">
            下载 PDF
          </van-button>
        </div>
        <p class="hero-tip">
          <van-icon name="info-o" />
          PDF 由服务器排版生成，首次下载可能需要几秒
        </p>
      </div>

      <div class="mastery-batch card">
        <div class="mastery-batch-icon">
          <van-icon name="edit" size="18" />
        </div>
        <div class="mastery-batch-copy">
          <strong>统一掌握程度</strong>
          <span>一次调整本试卷全部 {{ paper.questionCount }} 道题</span>
        </div>
        <van-button
          size="small"
          round
          plain
          type="primary"
          :disabled="!paper.items?.length"
          @click="openBulkMastery"
        >
          设置
        </van-button>
      </div>

      <div class="content-head">
        <h2 class="section-title">试卷内容</h2>
        <label class="answer-toggle">
          <span>显示答案</span>
          <van-switch v-model="showAnswers" size="20" />
        </label>
      </div>

      <div v-if="paper.items?.length" class="paper-content">
        <section v-for="group in groups" :key="group.section" class="section-block">
          <h3 class="section-name">{{ group.label }}</h3>
          <article
            v-for="item in group.items"
            :key="item.id"
            class="paper-question card"
            role="button"
            tabindex="0"
            @click="openQuestion(item.snapshot.questionId)"
            @keyup.enter="openQuestion(item.snapshot.questionId)"
          >
            <div class="q-head">
              <span class="q-number">{{ item.number }}.</span>
              <span class="q-type">{{ questionTypeLabel(item.snapshot.questionType) }}</span>
              <van-icon name="arrow" class="q-open" />
            </div>
            <div class="q-stem">
              <RichText :text="item.snapshot.stem" />
            </div>
            <div v-if="item.snapshot.options?.length" class="q-options">
              <div v-for="option in item.snapshot.options" :key="option.label" class="q-option">
                <span>{{ option.label }}.</span>
                <RichText :text="option.content" />
              </div>
            </div>
            <div v-if="item.snapshot.images?.length" class="q-images">
              <van-image
                v-for="image in item.snapshot.images"
                :key="image.id"
                :src="image.url"
                fit="cover"
                radius="8"
                @click.stop="previewImage(item.snapshot.images, image.url ?? '')"
              />
            </div>

            <div v-if="showAnswers && paper.settings.includeAnswers" class="q-answer">
              <div class="answer-block">
                <span class="answer-label">答案</span>
                <RichText :text="item.snapshot.correctAnswer || '略'" />
              </div>
              <div
                v-if="paper.settings.includeStudentAnswer && item.snapshot.studentAnswer"
                class="answer-block student"
              >
                <span class="answer-label">原作答</span>
                <RichText :text="item.snapshot.studentAnswer" />
              </div>
              <div v-if="item.snapshot.analysis" class="answer-block">
                <span class="answer-label">解析</span>
                <RichText :text="item.snapshot.analysis" />
              </div>
              <div
                v-if="paper.settings.includeKnowledgePoints && item.snapshot.knowledgePoints?.length"
                class="q-kps"
              >
                {{ item.snapshot.knowledgePoints.join(' · ') }}
              </div>
            </div>
          </article>
        </section>
      </div>

      <div v-else class="card panel">
        <EmptyState icon="description-o" title="试卷暂无题目" description="试卷数据可能已损坏，请重新生成" />
      </div>

      <div class="detail-foot">
        <van-button block round plain type="danger" icon="delete-o" @click="removePaper">
          删除这份试卷
        </van-button>
      </div>
    </div>

    <div v-else class="page">
      <EmptyState icon="search" title="试卷不存在" description="它可能已被删除">
        <van-button round type="primary" @click="router.replace('/papers')">返回试卷列表</van-button>
      </EmptyState>
    </div>

    <van-popup v-model:show="showRename" position="bottom" round>
      <div class="rename-sheet">
        <h3>修改试卷标题</h3>
        <van-field v-model="renameTitle" maxlength="80" placeholder="输入试卷标题" />
        <van-button block round type="primary" :loading="renaming" @click="renamePaper">
          保存
        </van-button>
      </div>
    </van-popup>

    <van-popup v-model:show="showMastery" position="bottom" round>
      <div class="mastery-sheet">
        <h3>统一掌握程度</h3>
        <p>将这份试卷中的 {{ paper?.questionCount ?? 0 }} 道题统一设为：</p>
        <MasteryPicker
          :model-value="bulkMastery ?? -1"
          :disabled="updatingMastery"
          @select="selectBulkMastery"
        />
        <van-button
          block
          round
          type="primary"
          :disabled="bulkMastery === null"
          :loading="updatingMastery"
          @click="applyBulkMastery"
        >
          应用到全部题目
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  showConfirmDialog,
  showImagePreview,
  showLoadingToast,
  showToast,
} from 'vant';
import {
  PAPER_SECTIONS,
  gradeLabel,
  questionTypeLabel,
  subjectName,
  type Paper,
  type PaperItem,
} from '@myos/shared';
import { papersApi } from '@/api';
import { errorMessage } from '@/api/client';
import PageHeader from '@/components/PageHeader.vue';
import RichText from '@/components/RichText.vue';
import MasteryPicker from '@/components/MasteryPicker.vue';
import EmptyState from '@/components/EmptyState.vue';
import { formatDate } from '@/utils/format';

const route = useRoute();
const router = useRouter();

const paper = ref<Paper | null>(null);
const loading = ref(true);
const showAnswers = ref(false);
const downloading = ref(false);
const showRename = ref(false);
const renameTitle = ref('');
const renaming = ref(false);
const showMastery = ref(false);
const bulkMastery = ref<number | null>(null);
const updatingMastery = ref(false);

interface GroupItem extends PaperItem {
  number: number;
}

const numerals = ['一', '二', '三', '四', '五'];

const groups = computed(() => {
  const result: { section: string; label: string; items: GroupItem[] }[] = [];
  const map = new Map<string, GroupItem[]>();
  let number = 1;
  for (const item of paper.value?.items ?? []) {
    const list = map.get(item.section) ?? [];
    list.push({ ...item, number });
    number += 1;
    map.set(item.section, list);
  }
  let index = 0;
  for (const [section, items] of map.entries()) {
    const name = PAPER_SECTIONS[section]?.split('、').slice(1).join('、') ?? '题目';
    result.push({ section, label: `${numerals[index] ?? index + 1}、${name}`, items });
    index += 1;
  }
  return result;
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const { data } = await papersApi.get(String(route.params.id));
    paper.value = data;
  } catch (error) {
    showToast(errorMessage(error));
    paper.value = null;
  } finally {
    loading.value = false;
  }
}

async function printPaper(): Promise<void> {
  if (!paper.value) return;
  try {
    const { data } = await papersApi.printToken(paper.value.id);
    window.open(data.url, '_blank', 'noopener');
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function downloadPdf(): Promise<void> {
  if (!paper.value) return;
  downloading.value = true;
  const toast = showLoadingToast({
    message: '正在生成 PDF...',
    forbidClick: true,
    duration: 0,
  });
  try {
    const { data } = await papersApi.printToken(paper.value.id);
    const response = await fetch(data.pdfUrl, { credentials: 'same-origin' });
    if (!response.ok) {
      let message = 'PDF 生成失败';
      try {
        const payload = (await response.json()) as { message?: string };
        if (payload.message) message = payload.message;
      } catch {
        // Keep default message.
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${paper.value.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    paper.value.hasPdf = true;
    toast.close();
    showToast({ type: 'success', icon: 'passed', message: 'PDF 已下载' });
  } catch (error) {
    toast.close();
    showToast(errorMessage(error));
  } finally {
    downloading.value = false;
  }
}

function previewImage(images: { id: string; url?: string }[], current: string): void {
  showImagePreview({
    images: images.map((image) => image.url ?? ''),
    startPosition: Math.max(0, images.findIndex((image) => image.url === current)),
  });
}

function openRename(): void {
  if (!paper.value) return;
  renameTitle.value = paper.value.title;
  showRename.value = true;
}

async function renamePaper(): Promise<void> {
  if (!paper.value || !renameTitle.value.trim()) return;
  renaming.value = true;
  try {
    const { data } = await papersApi.update(paper.value.id, {
      title: renameTitle.value.trim(),
    });
    paper.value = data;
    showRename.value = false;
    showToast('标题已更新');
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    renaming.value = false;
  }
}

function openQuestion(questionId: string): void {
  void router.push(`/questions/${questionId}`);
}

function openBulkMastery(): void {
  bulkMastery.value = null;
  showMastery.value = true;
}

function selectBulkMastery(value: number): void {
  bulkMastery.value = value;
}

async function applyBulkMastery(): Promise<void> {
  if (!paper.value || bulkMastery.value === null) return;
  updatingMastery.value = true;
  try {
    const { data } = await papersApi.updateMastery(paper.value.id, bulkMastery.value);
    showMastery.value = false;
    showToast({
      type: 'success',
      icon: 'passed',
      message: data.updated ? `已更新 ${data.updated} 道题` : '没有可更新的题目',
    });
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    updatingMastery.value = false;
  }
}

async function removePaper(): Promise<void> {
  if (!paper.value) return;
  try {
    await showConfirmDialog({
      title: '删除试卷',
      message: '删除后将无法恢复，确认删除这份试卷吗？',
      confirmButtonText: '删除',
      confirmButtonColor: '#e11d48',
    });
    await papersApi.remove(paper.value.id);
    showToast('已删除');
    await router.replace('/papers');
  } catch (error) {
    if (error !== 'cancel') showToast(errorMessage(error));
  }
}

onMounted(load);
</script>

<style scoped>
.paper-detail {
  padding-top: 4px;
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

.paper-hero {
  padding: 18px;
}

.hero-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  border-radius: 15px;
  background: var(--brand-soft);
  color: var(--brand);
}

.hero-copy {
  min-width: 0;
}

.hero-copy h2 {
  margin: 0;
  overflow: hidden;
  font-size: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-copy p {
  display: flex;
  gap: 8px;
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.paper-settings {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.paper-settings span {
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 9px;
}

.hero-actions {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 8px;
  margin-top: 14px;
}

.hero-actions :deep(.van-button) {
  font-size: 12px;
}

.hero-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 9px 0 0;
  color: var(--muted);
  font-size: 9.5px;
}

.mastery-batch {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
}

.mastery-batch-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 11px;
  background: var(--brand-soft);
  color: var(--brand);
}

.mastery-batch-copy {
  flex: 1;
  min-width: 0;
}

.mastery-batch-copy strong {
  display: block;
  color: var(--text);
  font-size: 12.5px;
}

.mastery-batch-copy span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.mastery-batch :deep(.van-button) {
  flex: 0 0 auto;
  font-size: 11px;
}

.content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20px 2px 10px;
}

.answer-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-2);
  font-size: 10.5px;
}

.section-block {
  margin-bottom: 16px;
}

.section-name {
  margin: 0 2px 8px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 700;
}

.paper-question {
  padding: 14px;
  margin-bottom: 8px;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.paper-question:active {
  transform: scale(0.995);
}

.paper-question:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

.q-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.q-number {
  color: var(--brand);
  font-size: 13px;
  font-weight: 800;
}

.q-type {
  color: var(--muted);
  font-size: 10px;
}

.q-open {
  margin-left: auto;
  color: #cbd5e1;
  font-size: 14px;
}

.q-stem {
  font-size: 13.5px;
  line-height: 1.7;
}

.q-options {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
  color: var(--text-2);
  font-size: 12.5px;
}

.q-option {
  display: flex;
  gap: 5px;
}

.q-option > span {
  color: var(--brand);
  font-weight: 600;
}

.q-images {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.q-images :deep(.van-image) {
  width: 76px;
  height: 76px;
  overflow: hidden;
  border-radius: 8px;
}

.q-answer {
  margin-top: 10px;
  padding: 10px;
  border-radius: 10px;
  background: var(--surface-soft);
}

.answer-block {
  display: flex;
  gap: 6px;
  margin-bottom: 5px;
  font-size: 12px;
  line-height: 1.6;
}

.answer-block:last-child {
  margin-bottom: 0;
}

.answer-label {
  flex: 0 0 auto;
  color: var(--brand-dark);
  font-size: 10px;
  font-weight: 700;
}

.answer-block.student .answer-label {
  color: var(--rose);
}

.q-kps {
  margin-top: 6px;
  color: var(--muted);
  font-size: 9.5px;
}

.panel {
  padding: 22px 16px;
}

.detail-foot {
  margin-top: 16px;
}

.rename-sheet {
  padding: 18px 18px calc(18px + var(--safe-bottom));
}

.rename-sheet h3 {
  margin: 0 0 14px;
  font-size: 18px;
}

.rename-sheet :deep(.van-field) {
  margin-bottom: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
}

.mastery-sheet {
  padding: 18px 18px calc(18px + var(--safe-bottom));
}

.mastery-sheet h3 {
  margin: 0;
  font-size: 18px;
}

.mastery-sheet p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.mastery-sheet :deep(.mastery-options) {
  margin: 16px 0 20px;
}
</style>
