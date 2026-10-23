<template>
  <div class="questions-view">
    <div class="page questions-page">
      <section class="questions-hero">
        <div class="hero-copy">
          <span class="hero-label">错题本</span>
          <h1>错题整理</h1>
          <p>共 {{ total }} 道错题 · 按学科和掌握程度筛选复习</p>
          <van-button round size="small" class="hero-action" @click="router.push('/upload')">
            <van-icon name="plus" />
            录入错题
          </van-button>
        </div>
        <div class="hero-art">
          <span class="hero-note">
            <i />
            <i />
            <i />
            <span class="hero-wrong"><van-icon name="cross" size="17" /></span>
          </span>
        </div>
      </section>

      <van-search
        v-model="keyword"
        shape="round"
        placeholder="搜索题干、答案或解析"
        background="transparent"
        @search="reload"
        @clear="reload"
      />

      <div class="chip-row subject-chips">
        <button
          type="button"
          class="chip"
          :class="{ active: !subjectId }"
          @click="selectSubject('')"
        >
          全部
        </button>
        <button
          v-for="subject in studentStore.subjects"
          :key="subject.id"
          type="button"
          class="chip"
          :class="{ active: subjectId === subject.id }"
          @click="selectSubject(subject.id)"
        >
          {{ subject.name }}
        </button>
      </div>

      <div class="toolbar-row">
        <button type="button" class="filter-btn" :class="{ active: filterCount > 0 }" @click="showFilter = true">
          <van-icon name="filter-o" />
          筛选
          <span v-if="filterCount" class="filter-count">{{ filterCount }}</span>
        </button>

        <div class="toolbar-right">
          <button
            v-if="!manageMode || !selectedIds.size"
            type="button"
            class="manage-btn"
            @click="toggleManage"
          >
            {{ manageMode ? '退出管理' : '批量管理' }}
          </button>
          <template v-else>
            <span class="selected-count">已选 {{ selectedIds.size }}</span>
            <PageActions :actions="manageActions" @select="onManageAction" />
          </template>
        </div>
      </div>

      <div v-if="knowledgePointName" class="active-filter">
        <span>知识点：{{ knowledgePointName }}</span>
        <button type="button" @click="clearKnowledgeFilter"><van-icon name="cross" /></button>
      </div>

      <div ref="scrollWrap" class="questions-scroll-wrap">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          :finished-text="items.length ? '没有更多错题了' : ''"
          :immediate-check="false"
          @load="loadMore"
        >
          <QuestionCard
            v-for="question in items"
            :key="question.id"
            :question="question"
            :selectable="manageMode"
            :selected="selectedIds.has(question.id)"
            @open="router.push(`/questions/${question.id}`)"
            @toggle="toggleSelect"
          />
        </van-list>

        <div v-if="!loading && !items.length" class="card empty-card">
          <EmptyState
            icon="search"
            title="没有找到错题"
            :description="hasFilters ? '试试调整筛选条件，或搜索其他关键词' : '拍照识别或手动录入第一道错题吧'"
          >
            <div class="empty-actions">
              <van-button round type="primary" size="small" @click="router.push('/upload')">
                去录题
              </van-button>
              <van-button v-if="hasFilters" round plain size="small" @click="resetFilters">
                清除筛选
              </van-button>
            </div>
          </EmptyState>
        </div>
      </div>
    </div>

    <van-popup v-model:show="showFilter" position="bottom" round>
      <div class="filter-sheet">
        <div class="filter-head">
          <h3>筛选错题</h3>
          <button type="button" @click="showFilter = false"><van-icon name="cross" /></button>
        </div>

        <div class="filter-group">
          <label>掌握程度</label>
          <div class="filter-chips">
            <button
              type="button"
              :class="{ active: masteryFilter === '' }"
              @click="masteryFilter = ''"
            >
              全部
            </button>
            <button
              v-for="(label, index) in MASTERY_LABELS"
              :key="label"
              type="button"
              :class="{ active: masteryFilter === index }"
              @click="masteryFilter = index"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <div class="filter-group">
          <label>题型</label>
          <div class="filter-chips">
            <button
              type="button"
              :class="{ active: !questionType }"
              @click="questionType = ''"
            >
              全部
            </button>
            <button
              v-for="type in QUESTION_TYPES"
              :key="type.value"
              type="button"
              :class="{ active: questionType === type.value }"
              @click="questionType = type.value"
            >
              {{ type.label }}
            </button>
          </div>
        </div>

        <div class="filter-group">
          <label>排序</label>
          <div class="filter-chips">
            <button
              v-for="option in sortOptions"
              :key="option.value"
              type="button"
              :class="{ active: sortValue === option.value }"
              @click="sortValue = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="filter-actions">
          <van-button block round plain @click="resetFilters">重置</van-button>
          <van-button block round type="primary" @click="applyFilters">查看结果</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import {
  MASTERY_LABELS,
  QUESTION_TYPES,
  type WrongQuestion,
} from '@myos/shared';
import { knowledgeApi, questionsApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useStudentStore } from '@/stores/student';
import { usePaperSelectionStore } from '@/stores/paperSelection';
import QuestionCard from '@/components/QuestionCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import PageActions from '@/components/PageActions.vue';

const route = useRoute();
const router = useRouter();
const studentStore = useStudentStore();
const paperSelection = usePaperSelectionStore();

const items = ref<WrongQuestion[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const finished = ref(false);
const scrollWrap = ref<HTMLElement | null>(null);
const keyword = ref('');
const subjectId = ref('');
const questionType = ref('');
const masteryFilter = ref<number | ''>('');
const sortValue = ref('createdAt_desc');
const showFilter = ref(false);
const manageMode = ref(false);
const selectedIds = ref(new Set<string>());
const knowledgePointId = ref('');
const knowledgePointName = ref('');

const sortOptions = [
  { label: '最近录入', value: 'createdAt_desc' },
  { label: '掌握度从低到高', value: 'mastery_asc' },
  { label: '难度从高到低', value: 'difficulty_desc' },
];

const hasFilters = computed(
  () =>
    Boolean(subjectId.value) ||
    Boolean(questionType.value) ||
    masteryFilter.value !== '' ||
    Boolean(keyword.value.trim()) ||
    Boolean(knowledgePointId.value),
);

const filterCount = computed(
  () =>
    (questionType.value ? 1 : 0) +
    (masteryFilter.value !== '' ? 1 : 0) +
    (sortValue.value !== 'createdAt_desc' ? 1 : 0),
);

const allPageSelected = computed(
  () => items.value.length > 0 && items.value.every((item) => selectedIds.value.has(item.id)),
);

const manageActions = computed(() => [
  {
    label: allPageSelected.value ? '取消全选' : '全选本页',
    value: 'toggle-all',
  },
  {
    label: `去组卷 (${selectedIds.value.size})`,
    value: 'paper',
  },
  { label: '归档', value: 'archive' },
  { label: '删除', value: 'delete', danger: true },
  { label: '退出管理', value: 'exit' },
]);

function onManageAction(value: string): void {
  if (value === 'exit') toggleManage();
  else if (value === 'toggle-all') toggleSelectAll();
  else if (value === 'paper') void addToPaper();
  else if (value === 'archive') void archiveSelected();
  else if (value === 'delete') void deleteSelected();
}

function buildQuery(pageNumber: number) {
  const [sortBy, sortOrder] = sortValue.value.split('_') as [string, 'asc' | 'desc'];
  return {
    studentId: studentStore.currentStudentId,
    subjectId: subjectId.value || undefined,
    questionType: questionType.value || undefined,
    masteryMax: masteryFilter.value === '' ? undefined : Number(masteryFilter.value),
    masteryMin: masteryFilter.value === '' ? undefined : Number(masteryFilter.value),
    knowledgePointId: knowledgePointId.value || undefined,
    keyword: keyword.value.trim() || undefined,
    page: pageNumber,
    pageSize,
    sortBy,
    sortOrder,
  };
}

async function load(reset = false): Promise<void> {
  if (loading.value && !reset) return;
  if (reset) {
    page.value = 1;
    finished.value = false;
    items.value = [];
    scrollWrap.value?.scrollTo({ top: 0 });
  }
  if (!studentStore.currentStudentId) {
    items.value = [];
    total.value = 0;
    finished.value = true;
    return;
  }
  loading.value = true;
  try {
    const { data } = await questionsApi.list(buildQuery(page.value));
    if (page.value === 1) items.value = data.items;
    else items.value = [...items.value, ...data.items];
    total.value = data.total;
    finished.value = items.value.length >= data.total;
    if (!finished.value) page.value += 1;
  } catch (error) {
    showToast(errorMessage(error));
    finished.value = true;
  } finally {
    loading.value = false;
  }
}

function reload(): void {
  void load(true);
}

function loadMore(): void {
  if (!finished.value && !loading.value) void load(false);
}

function selectSubject(id: string): void {
  subjectId.value = id;
  reload();
}

function applyFilters(): void {
  showFilter.value = false;
  reload();
}

function resetFilters(): void {
  subjectId.value = '';
  questionType.value = '';
  masteryFilter.value = '';
  sortValue.value = 'createdAt_desc';
  keyword.value = '';
  knowledgePointId.value = '';
  knowledgePointName.value = '';
  showFilter.value = false;
  reload();
}

async function clearKnowledgeFilter(): Promise<void> {
  knowledgePointId.value = '';
  knowledgePointName.value = '';
  reload();
}

function toggleManage(): void {
  manageMode.value = !manageMode.value;
  if (!manageMode.value) selectedIds.value = new Set();
}

function toggleSelect(id: string): void {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function toggleSelectAll(): void {
  const next = new Set(selectedIds.value);
  if (allPageSelected.value) {
    items.value.forEach((item) => next.delete(item.id));
  } else {
    items.value.forEach((item) => next.add(item.id));
  }
  selectedIds.value = next;
}

async function addToPaper(): Promise<void> {
  if (!selectedIds.value.size) return;
  const merged = Array.from(new Set([...paperSelection.ids, ...selectedIds.value])).slice(0, 50);
  paperSelection.set(merged);
  showToast(`已加入 ${selectedIds.value.size} 道题`);
  await router.push('/papers/new');
}

async function archiveSelected(): Promise<void> {
  if (!selectedIds.value.size) return;
  try {
    await showConfirmDialog({
      title: '归档错题',
      message: `归档后这些错题将不再出现在默认列表中，可随时恢复。`,
      confirmButtonText: '归档',
    });
    const ids = Array.from(selectedIds.value);
    await questionsApi.batchAction(ids, 'archive');
    showToast(`已归档 ${ids.length} 道`);
    selectedIds.value = new Set();
    manageMode.value = false;
    reload();
  } catch (error) {
    if (error !== 'cancel') showToast(errorMessage(error));
  }
}

async function deleteSelected(): Promise<void> {
  if (!selectedIds.value.size) return;
  try {
    await showConfirmDialog({
      title: '删除错题',
      message: '删除后将无法恢复，确认删除选中的错题吗？',
      confirmButtonText: '删除',
      confirmButtonColor: 'var(--danger)',
    });
    const ids = Array.from(selectedIds.value);
    await questionsApi.batchAction(ids, 'delete');
    showToast(`已删除 ${ids.length} 道`);
    selectedIds.value = new Set();
    manageMode.value = false;
    reload();
  } catch (error) {
    if (error !== 'cancel') showToast(errorMessage(error));
  }
}

async function resolveKnowledgeName(id: string): Promise<void> {
  try {
    const { data } = await knowledgeApi.list({ limit: 100 });
    knowledgePointName.value = data.find((point) => point.id === id)?.name ?? '知识点筛选';
  } catch {
    knowledgePointName.value = '知识点筛选';
  }
}

onMounted(() => {
  const queryKnowledge = route.query.knowledgePointId;
  if (typeof queryKnowledge === 'string') {
    knowledgePointId.value = queryKnowledge;
    void resolveKnowledgeName(queryKnowledge);
  }
  reload();
});

watch(
  () => studentStore.currentStudentId,
  () => {
    selectedIds.value = new Set();
    manageMode.value = false;
    subjectId.value = '';
    knowledgePointId.value = '';
    knowledgePointName.value = '';
    reload();
  },
);
</script>

<style scoped>
.questions-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 76px - var(--safe-bottom));
  height: calc(100dvh - 76px - var(--safe-bottom));
  overflow: hidden;
}

.questions-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding-top: calc(10px + var(--safe-top));
  padding-bottom: 0;
}

.questions-page > :not(.questions-scroll-wrap) {
  flex: 0 0 auto;
}

.questions-scroll-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}

.questions-hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  overflow: hidden;
  margin-bottom: 12px;
  padding: 20px 18px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 92% 12%, rgba(255, 255, 255, 0.22), transparent 38%),
    linear-gradient(135deg, var(--accent-strong), var(--accent) 55%, var(--accent-light));
  color: #fff;
  box-shadow: 0 12px 28px rgba(var(--accent-rgb), 0.22);
}

.hero-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.hero-label {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 9.5px;
  letter-spacing: 0.6px;
}

.hero-copy h1 {
  margin: 7px 0 4px;
  font-size: 19px;
  font-weight: 700;
}

.hero-copy p {
  max-width: 220px;
  margin: 0;
  color: rgba(255, 255, 255, 0.74);
  font-size: 10.5px;
  line-height: 1.55;
}

.hero-art {
  position: relative;
  width: 84px;
  height: 104px;
  flex: 0 0 auto;
}

.hero-note {
  position: absolute;
  top: 10px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 64px;
  height: 88px;
  padding: 14px 10px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
  transform: rotate(-4deg);
}

.hero-note i {
  display: block;
  height: 5px;
  border-radius: 999px;
  background: var(--accent-soft);
}

.hero-note i:first-child {
  width: 70%;
  height: 7px;
  background: var(--accent-light);
}

.hero-note i:nth-child(3) {
  width: 84%;
}

.hero-wrong {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: red;
  line-height: 1;
}

.hero-action {
  height: 34px;
  margin-top: 12px;
  padding: 0 16px;
  border: 0;
  background: #fff;
  color: var(--brand-dark);
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.hero-action :deep(.van-icon) {
  margin-right: 3px;
}

.hero-action:active {
  transform: scale(0.97);
  box-shadow: 0 5px 12px rgba(15, 23, 42, 0.14);
}

.questions-page :deep(.van-search) {
  padding: 4px 0 8px;
}

.questions-page :deep(.van-search__content) {
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.subject-chips {
  margin-bottom: 10px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.manage-btn {
  padding: 6px 2px;
  border: 0;
  background: transparent;
  color: var(--brand);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.selected-count {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12px;
}

.filter-btn.active {
  border-color: rgba(var(--accent-rgb), 0.35);
  color: var(--brand);
}

.filter-count {
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--brand);
  color: #fff;
  font-size: 9px;
}

.active-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 11.5px;
}

.active-filter button {
  border: 0;
  background: transparent;
  color: var(--brand);
}

.empty-card {
  margin-top: 16px;
  padding: 22px 16px;
}

.empty-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 14px;
}

.filter-sheet {
  padding: 4px 18px calc(20px + var(--safe-bottom));
}

.filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0 8px;
}

.filter-head h3 {
  margin: 0;
  font-size: 18px;
}

.filter-head button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-soft);
  color: var(--text-2);
}

.filter-group {
  margin-top: 16px;
}

.filter-group > label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}

.filter-chips {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.filter-chips button {
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 11.5px;
}

.filter-chips button.active {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}

.filter-actions {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
  margin-top: 24px;
}
</style>
