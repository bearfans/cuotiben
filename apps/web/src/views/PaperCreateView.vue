<template>
  <div class="paper-create">
    <PageHeader title="生成试卷" subtitle="从错题中挑选题目，生成可打印练习卷" />

    <div v-if="!studentStore.currentStudent" class="page">
      <div class="card panel">
        <EmptyState icon="friends-o" title="请先添加孩子档案" description="试卷需要归属到具体孩子">
          <van-button round type="primary" @click="router.push('/profile')">去添加</van-button>
        </EmptyState>
      </div>
    </div>

    <template v-else>
      <div class="page create-body">
        <div v-if="paperSelection.count && usingPreselection" class="preselection card">
          <van-icon name="passed" color="#16a34a" />
          <span>已从错题本带入 <b>{{ paperSelection.count }}</b> 道题</span>
          <button type="button" @click="loadAllCandidates">加载更多错题</button>
        </div>

        <div class="filter-card card">
          <van-search
            v-model="keyword"
            shape="round"
            placeholder="搜索题干关键词"
            background="transparent"
            @search="applyFilters"
            @clear="applyFilters"
          />
          <div class="chip-row">
            <button
              type="button"
              class="chip"
              :class="{ active: !subjectId }"
              @click="setSubject('')"
            >
              全部学科
            </button>
            <button
              v-for="subject in studentStore.subjects"
              :key="subject.id"
              type="button"
              class="chip"
              :class="{ active: subjectId === subject.id }"
              @click="setSubject(subject.id)"
            >
              {{ subject.name }}
            </button>
          </div>
          <div class="filter-bottom">
            <div class="mastery-chips">
              <button
                type="button"
                :class="{ active: masteryMax === '' }"
                @click="setMastery('')"
              >
                全部
              </button>
              <button
                type="button"
                :class="{ active: masteryMax === 2 }"
                @click="setMastery(2)"
              >
                薄弱题
              </button>
              <button
                type="button"
                :class="{ active: masteryMax === 0 }"
                @click="setMastery(0)"
              >
                未掌握
              </button>
            </div>
            <button type="button" class="random-btn" @click="randomSelect">
              <van-icon name="shuffle" /> 随机 20 道
            </button>
          </div>
        </div>

        <div class="list-head">
          <div>
            <h2 class="section-title">可选错题</h2>
            <p class="list-sub">{{ candidates.length }} 道符合条件 · 点击题目选择</p>
          </div>
          <button type="button" class="select-all" @click="toggleSelectAll">
            <van-icon
              :name="allSelected ? 'passed' : 'circle'"
              :color="allSelected ? '#16a34a' : '#cbd5e1'"
              size="19"
            />
            {{ allSelected ? '取消全选' : '全选' }}
          </button>
        </div>

        <div v-if="loading" class="tab-loading">
          <div class="skeleton-card" />
          <div class="skeleton-card" />
          <div class="skeleton-card" />
        </div>

        <template v-else>
          <article
            v-for="candidate in candidates"
            :key="candidate.id"
            class="candidate card"
            :class="{ selected: selectedIds.has(candidate.id) }"
            @click="toggleCandidate(candidate.id)"
          >
            <div class="candidate-check">
              <van-icon
                :name="selectedIds.has(candidate.id) ? 'passed' : 'circle'"
                :color="selectedIds.has(candidate.id) ? '#16a34a' : '#cbd5e1'"
                size="21"
              />
            </div>
            <div class="candidate-main">
              <div class="candidate-meta">
                <SubjectPill :subject-id="candidate.subjectId" />
                <span>{{ questionTypeLabel(candidate.questionType) }}</span>
                <MasteryBadge :value="candidate.mastery" />
              </div>
              <div class="candidate-stem">
                <RichText :text="candidate.stem" />
              </div>
              <div v-if="candidate.knowledgePoints.length" class="candidate-kps">
                {{ candidate.knowledgePoints.map((point) => point.name).join(' · ') }}
              </div>
            </div>
          </article>

          <div v-if="!candidates.length" class="card panel">
            <EmptyState
              icon="records-o"
              title="没有符合条件的错题"
              description="调整筛选条件，或先去错题本录入更多题目"
            >
              <van-button round plain size="small" @click="resetFilters">清除筛选</van-button>
            </EmptyState>
          </div>
        </template>

        <div class="safe-bottom" />
      </div>

      <div class="create-footer">
        <div class="footer-info">
          <span>已选</span>
          <strong>{{ selectedIds.size }}</strong>
          <span>道题</span>
        </div>
        <van-button
          round
          type="primary"
          size="large"
          :disabled="!selectedIds.size"
          @click="showSettings = true"
        >
          下一步 · 试卷设置
        </van-button>
      </div>
    </template>

    <van-popup v-model:show="showSettings" position="bottom" round>
      <div class="settings-sheet">
        <div class="settings-head">
          <h3>试卷设置</h3>
          <button type="button" @click="showSettings = false"><van-icon name="cross" /></button>
        </div>

        <van-field
          v-model="title"
          label="试卷标题"
          placeholder="留空自动生成"
          maxlength="80"
        />

        <div class="setting-list">
          <label class="setting-row">
            <span>
              <strong>包含参考答案</strong>
              <small>答案与解析单独成页</small>
            </span>
            <van-switch v-model="settings.includeAnswers" size="22" />
          </label>
          <label class="setting-row">
            <span>
              <strong>显示知识点</strong>
              <small>在答案页标注考查知识点</small>
            </span>
            <van-switch v-model="settings.includeKnowledgePoints" size="22" />
          </label>
          <label class="setting-row">
            <span>
              <strong>附上孩子原答案</strong>
              <small>对比原作答，回顾错误思路</small>
            </span>
            <van-switch v-model="settings.includeStudentAnswer" size="22" />
          </label>
          <label class="setting-row">
            <span>
              <strong>显示得分栏</strong>
              <small>在卷首预留得分填写位置</small>
            </span>
            <van-switch v-model="settings.showScore" size="22" />
          </label>
        </div>

        <div class="settings-summary">
          共 {{ selectedIds.size }} 道题 · A4 打印排版
        </div>

        <van-button
          block
          round
          type="primary"
          size="large"
          :loading="creating"
          loading-text="正在生成..."
          @click="createPaper"
        >
          生成试卷
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showLoadingToast, showToast } from 'vant';
import {
  questionTypeLabel,
  type PaperCandidate,
  type PaperSettings,
} from '@myos/shared';
import { papersApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useStudentStore } from '@/stores/student';
import { usePaperSelectionStore } from '@/stores/paperSelection';
import PageHeader from '@/components/PageHeader.vue';
import SubjectPill from '@/components/SubjectPill.vue';
import MasteryBadge from '@/components/MasteryBadge.vue';
import RichText from '@/components/RichText.vue';
import EmptyState from '@/components/EmptyState.vue';

const router = useRouter();
const studentStore = useStudentStore();
const paperSelection = usePaperSelectionStore();

const candidates = ref<PaperCandidate[]>([]);
const selectedIds = ref(new Set<string>());
const loading = ref(true);
const usingPreselection = ref(false);
const keyword = ref('');
const subjectId = ref('');
const masteryMax = ref<number | ''>('');
const showSettings = ref(false);
const title = ref('');
const creating = ref(false);
const settings = reactive<PaperSettings>({
  includeAnswers: true,
  includeKnowledgePoints: true,
  includeStudentAnswer: false,
  showScore: true,
});

const allSelected = computed(
  () => candidates.value.length > 0 && candidates.value.every((item) => selectedIds.value.has(item.id)),
);

async function loadCandidates(): Promise<void> {
  if (!studentStore.currentStudentId) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const preselected = usingPreselection.value && paperSelection.count > 0;
    const { data } = await papersApi.candidates({
      studentId: studentStore.currentStudentId,
      ...(preselected
        ? { questionIds: paperSelection.ids }
        : {
            subjectId: subjectId.value || undefined,
            masteryMax: masteryMax.value === '' ? undefined : Number(masteryMax.value),
            keyword: keyword.value.trim() || undefined,
            count: 50,
          }),
    });
    candidates.value = data.items;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function applyFilters(): void {
  usingPreselection.value = false;
  void loadCandidates();
}

function setSubject(id: string): void {
  subjectId.value = id;
  applyFilters();
}

function setMastery(value: number | ''): void {
  masteryMax.value = value;
  applyFilters();
}

function resetFilters(): void {
  keyword.value = '';
  subjectId.value = '';
  masteryMax.value = '';
  applyFilters();
}

function loadAllCandidates(): void {
  usingPreselection.value = false;
  void loadCandidates();
}

function toggleCandidate(id: string): void {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function toggleSelectAll(): void {
  const next = new Set(selectedIds.value);
  if (allSelected.value) {
    candidates.value.forEach((item) => next.delete(item.id));
  } else {
    candidates.value.forEach((item) => next.add(item.id));
  }
  selectedIds.value = next;
}

function randomSelect(): void {
  if (!candidates.value.length) return;
  const pool = [...candidates.value];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = Math.min(20, pool.length);
  selectedIds.value = new Set(pool.slice(0, count).map((item) => item.id));
  showToast(`已随机选择 ${count} 道题`);
}

async function createPaper(): Promise<void> {
  if (!studentStore.currentStudentId || !selectedIds.value.size) return;
  creating.value = true;
  const toast = showLoadingToast({ message: '正在生成试卷...', forbidClick: true, duration: 0 });
  try {
    const { data } = await papersApi.create({
      studentId: studentStore.currentStudentId,
      title: title.value.trim() || undefined,
      questionIds: Array.from(selectedIds.value),
      settings: { ...settings },
    });
    paperSelection.clear();
    toast.close();
    showToast({ type: 'success', icon: 'passed', message: '试卷已生成' });
    await router.replace(`/papers/${data.id}`);
  } catch (error) {
    toast.close();
    showToast(errorMessage(error));
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  if (paperSelection.count > 0) {
    usingPreselection.value = true;
    selectedIds.value = new Set(paperSelection.ids.slice(0, 50));
  }
  void loadCandidates();
});

watch(
  () => studentStore.currentStudentId,
  () => {
    subjectId.value = '';
    selectedIds.value = new Set();
    usingPreselection.value = false;
    void loadCandidates();
  },
);
</script>

<style scoped>
.create-body {
  padding-top: 4px;
}

.panel {
  padding: 24px 16px;
}

.preselection {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding: 10px 13px;
  color: var(--text-2);
  font-size: 11.5px;
}

.preselection span {
  flex: 1;
}

.preselection b {
  color: var(--brand);
}

.preselection button {
  border: 0;
  background: transparent;
  color: var(--brand);
  font-size: 10.5px;
  font-weight: 600;
}

.filter-card {
  padding: 10px 12px 12px;
}

.filter-card :deep(.van-search) {
  padding: 0 0 8px;
}

.filter-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}

.mastery-chips {
  display: flex;
  gap: 5px;
}

.mastery-chips button {
  padding: 4px 9px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 10px;
}

.mastery-chips button.active {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}

.random-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 9px;
  border: 0;
  border-radius: 999px;
  background: var(--amber-soft);
  color: #b45309;
  font-size: 10px;
  font-weight: 600;
}

.list-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  margin: 18px 2px 10px;
}

.list-sub {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.select-all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-2);
  font-size: 11px;
}

.tab-loading {
  padding-top: 2px;
}

.candidate {
  display: flex;
  gap: 9px;
  padding: 12px 13px;
  margin-bottom: 8px;
  transition: box-shadow 0.15s ease;
}

.candidate.selected {
  box-shadow:
    0 0 0 1.5px var(--brand),
    var(--shadow-soft);
}

.candidate-check {
  display: flex;
  align-items: flex-start;
  padding-top: 1px;
}

.candidate-main {
  flex: 1;
  min-width: 0;
}

.candidate-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 5px;
  color: var(--muted);
  font-size: 10px;
}

.candidate-stem {
  display: -webkit-box;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.candidate-stem :deep(.katex-display) {
  display: inline-block;
  margin: 0;
}

.candidate-kps {
  margin-top: 5px;
  overflow: hidden;
  color: var(--muted);
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-footer {
  position: fixed;
  bottom: 0;
  left: 50%;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 600px;
  padding: 10px 16px calc(10px + var(--safe-bottom));
  border-top: 0;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow: 0 -10px 30px -8px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.85);
  transform: translateX(-50%);
}

.footer-info {
  display: flex;
  align-items: baseline;
  gap: 3px;
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 11px;
}

.footer-info strong {
  color: var(--brand);
  font-size: 23px;
  font-weight: 800;
  line-height: 1;
}

.create-footer :deep(.van-button) {
  flex: 1;
}

.create-body {
  padding-bottom: calc(82px + var(--safe-bottom));
}

.settings-sheet {
  padding: 18px 18px calc(18px + var(--safe-bottom));
}

.settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.settings-head h3 {
  margin: 0;
  font-size: 18px;
}

.settings-head button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-soft);
  color: var(--text-2);
}

.settings-sheet :deep(.van-field) {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
}

.setting-list {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 2px;
  border-bottom: 1px solid var(--line);
}

.setting-row:last-child {
  border-bottom: 0;
}

.setting-row > span {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.setting-row strong {
  font-size: 13px;
  font-weight: 600;
}

.setting-row small {
  color: var(--muted);
  font-size: 10px;
}

.settings-summary {
  margin-bottom: 12px;
  color: var(--muted);
  font-size: 10.5px;
  text-align: center;
}
</style>
