<template>
  <div>
    <PageHeader title="知识点" subtitle="发现薄弱环节，集中突破" :back="false" />

    <div class="page knowledge-page">
      <van-tabs
        v-model:active="activeTab"
        background="transparent"
        color="#4f46e5"
        title-active-color="#4f46e5"
        title-inactive-color="#94a3b8"
        line-width="24"
        @change="onTabChange"
      >
        <van-tab title="薄弱知识点">
          <div class="chip-row subject-chips">
            <button
              type="button"
              class="chip"
              :class="{ active: !subjectId }"
              @click="setSubject('')"
            >
              全部
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

          <div v-if="loadingStats" class="tab-loading">
            <div class="skeleton-card" />
            <div class="skeleton-card" />
          </div>

          <template v-else>
            <div v-if="stats.length" class="stats-list">
              <article v-for="(point, index) in stats" :key="point.knowledgePointId" class="point-card card">
                <div class="rank" :class="{ top: index < 3 }">{{ index + 1 }}</div>
                <div class="point-main">
                  <div class="point-head">
                    <div class="point-title">
                      <SubjectPill :subject-id="point.subjectId" />
                      <strong>{{ point.name }}</strong>
                    </div>
                    <span class="weak-score" :title="`薄弱指数 ${point.weakScore.toFixed(1)}`">
                      {{ point.avgMastery.toFixed(1) }}
                      <small>掌握度</small>
                    </span>
                  </div>
                  <div class="point-bar">
                    <span :style="{ width: `${Math.max(5, (point.avgMastery / 5) * 100)}%` }" />
                  </div>
                  <div class="point-meta">
                    <span>{{ point.count }} 道错题</span>
                    <span v-if="point.overdueCount" class="overdue">{{ point.overdueCount }} 道待复习</span>
                    <span v-if="point.lastWrongAt">最近 {{ formatDate(point.lastWrongAt, 'MM-DD') }}</span>
                  </div>
                </div>
                <button type="button" class="point-action" @click="openQuestions(point)">
                  看错题
                  <van-icon name="arrow" />
                </button>
              </article>
            </div>
            <div v-else class="card empty-card">
              <EmptyState
                emoji="🌿"
                title="暂无薄弱知识点"
                :description="subjectId ? '该学科还没有错题数据' : '录入错题并标注知识点后，这里会自动分析薄弱环节'"
              />
            </div>
          </template>
        </van-tab>

        <van-tab title="知识点库">
          <div class="library-tools">
            <van-search
              v-model="keyword"
              shape="round"
              placeholder="搜索知识点"
              background="transparent"
              @search="loadLibrary"
              @clear="loadLibrary"
            />
            <button type="button" class="add-btn" @click="openAdd">
              <van-icon name="plus" />
            </button>
          </div>

          <div class="chip-row subject-chips">
            <button
              type="button"
              class="chip"
              :class="{ active: !librarySubjectId }"
              @click="setLibrarySubject('')"
            >
              全部
            </button>
            <button
              v-for="subject in studentStore.subjects"
              :key="subject.id"
              type="button"
              class="chip"
              :class="{ active: librarySubjectId === subject.id }"
              @click="setLibrarySubject(subject.id)"
            >
              {{ subject.name }}
            </button>
          </div>

          <div v-if="loadingLibrary" class="tab-loading">
            <div class="skeleton-card" />
            <div class="skeleton-card" />
          </div>
          <template v-else>
            <div v-if="library.length" class="library-list">
              <button
                v-for="point in library"
                :key="point.id"
                type="button"
                class="library-row card"
                @click="openActions(point)"
              >
                <span class="library-dot" :style="{ background: subjectColor(point.subjectId) }" />
                <span class="library-main">
                  <strong>{{ point.name }}</strong>
                  <small>
                    {{ subjectName(point.subjectId) }}
                    <template v-if="point.aliases.length"> · 别名 {{ point.aliases.length }} 个</template>
                  </small>
                </span>
                <span class="usage">{{ point.usageCount }} 题</span>
                <van-icon name="ellipsis" color="#cbd5e1" />
              </button>
            </div>
            <div v-else class="card empty-card">
              <EmptyState
                emoji="🏷️"
                title="还没有知识点"
                description="识别错题时 AI 会自动生成，也可以手动添加"
              >
                <van-button round type="primary" size="small" @click="openAdd">添加知识点</van-button>
              </EmptyState>
            </div>
            <p class="library-tip">同一学科下重名知识点会自动合并，也可以手动合并相似标签。</p>
          </template>
        </van-tab>
      </van-tabs>
    </div>

    <van-action-sheet
      v-model:show="showActions"
      :actions="actions"
      cancel-text="取消"
      close-on-click-action
      @select="onActionSelect"
    />

    <van-popup v-model:show="showRename" position="bottom" round>
      <div class="sheet">
        <h3>重命名知识点</h3>
        <van-field v-model="renameValue" placeholder="输入新的知识点名称" maxlength="40" />
        <van-button block round type="primary" :loading="saving" @click="renamePoint">保存</van-button>
      </div>
    </van-popup>

    <van-popup v-model:show="showMerge" position="bottom" round>
      <div class="sheet">
        <h3>合并知识点</h3>
        <p class="sheet-desc">
          将「{{ selectedPoint?.name }}」合并到另一个知识点，关联错题会一并转移。
        </p>
        <div class="merge-list">
          <button
            v-for="point in mergeTargets"
            :key="point.id"
            type="button"
            class="merge-row"
            :class="{ active: mergeTargetId === point.id }"
            @click="mergeTargetId = point.id"
          >
            <span>{{ point.name }}</span>
            <span class="muted small">{{ point.usageCount }} 题</span>
            <van-icon
              :name="mergeTargetId === point.id ? 'success' : 'circle'"
              :color="mergeTargetId === point.id ? '#4f46e5' : '#cbd5e1'"
            />
          </button>
          <p v-if="!mergeTargets.length" class="muted empty-merge">该学科下没有其他可合并的知识点</p>
        </div>
        <van-button
          block
          round
          type="primary"
          :disabled="!mergeTargetId"
          :loading="saving"
          @click="mergePoint"
        >
          确认合并
        </van-button>
      </div>
    </van-popup>

    <van-popup v-model:show="showAdd" position="bottom" round>
      <div class="sheet">
        <h3>添加知识点</h3>
        <van-field v-model="newName" label="名称" placeholder="例如：一元二次方程" maxlength="40" />
        <div class="subject-select">
          <span>学科</span>
          <div class="subject-options">
            <button
              v-for="subject in studentStore.subjects"
              :key="subject.id"
              type="button"
              :class="{ active: newSubjectId === subject.id }"
              @click="newSubjectId = subject.id"
            >
              {{ subject.name }}
            </button>
          </div>
        </div>
        <van-button block round type="primary" :loading="saving" @click="addPoint">添加</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import {
  SUBJECT_MAP,
  subjectColor,
  subjectName,
  type KnowledgePoint,
  type KnowledgeStat,
} from '@myos/shared';
import { knowledgeApi, statsApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useStudentStore } from '@/stores/student';
import PageHeader from '@/components/PageHeader.vue';
import SubjectPill from '@/components/SubjectPill.vue';
import EmptyState from '@/components/EmptyState.vue';
import { formatDate } from '@/utils/format';

const router = useRouter();
const studentStore = useStudentStore();

const activeTab = ref(0);
const subjectId = ref('');
const librarySubjectId = ref('');
const stats = ref<KnowledgeStat[]>([]);
const library = ref<KnowledgePoint[]>([]);
const loadingStats = ref(true);
const loadingLibrary = ref(false);
const keyword = ref('');
const showActions = ref(false);
const selectedPoint = ref<KnowledgePoint | null>(null);
const showRename = ref(false);
const renameValue = ref('');
const showMerge = ref(false);
const mergeTargetId = ref('');
const showAdd = ref(false);
const newName = ref('');
const newSubjectId = ref('');
const saving = ref(false);
const libraryLoaded = ref(false);

const actions = computed(() => [
  { name: '重命名', value: 'rename' },
  { name: '合并到其他知识点', value: 'merge' },
  { name: '删除', value: 'delete', color: '#e11d48' },
]);

const mergeTargets = computed(() =>
  library.value.filter(
    (point) =>
      point.id !== selectedPoint.value?.id && point.subjectId === selectedPoint.value?.subjectId,
  ),
);

async function loadStats(): Promise<void> {
  if (!studentStore.currentStudentId) {
    stats.value = [];
    loadingStats.value = false;
    return;
  }
  loadingStats.value = true;
  try {
    const { data } = await statsApi.knowledge({
      studentId: studentStore.currentStudentId,
      subjectId: subjectId.value || undefined,
      limit: 30,
    });
    stats.value = data;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    loadingStats.value = false;
  }
}

async function loadLibrary(): Promise<void> {
  loadingLibrary.value = true;
  try {
    const { data } = await knowledgeApi.list({
      subjectId: librarySubjectId.value || undefined,
      q: keyword.value.trim() || undefined,
      limit: 100,
    });
    library.value = data;
    libraryLoaded.value = true;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    loadingLibrary.value = false;
  }
}

function setSubject(id: string): void {
  subjectId.value = id;
  void loadStats();
}

function setLibrarySubject(id: string): void {
  librarySubjectId.value = id;
  void loadLibrary();
}

function onTabChange(index: number): void {
  if (index === 1 && !libraryLoaded.value) void loadLibrary();
}

function openQuestions(point: KnowledgeStat): void {
  void router.push({ path: '/questions', query: { knowledgePointId: point.knowledgePointId } });
}

function openActions(point: KnowledgePoint): void {
  selectedPoint.value = point;
  showActions.value = true;
}

function onActionSelect(action: { value?: string }): void {
  if (!selectedPoint.value) return;
  if (action.value === 'rename') {
    renameValue.value = selectedPoint.value.name;
    showRename.value = true;
  } else if (action.value === 'merge') {
    mergeTargetId.value = '';
    showMerge.value = true;
  } else if (action.value === 'delete') {
    void deletePoint();
  }
}

async function renamePoint(): Promise<void> {
  if (!selectedPoint.value || !renameValue.value.trim()) return;
  saving.value = true;
  try {
    await knowledgeApi.update(selectedPoint.value.id, { name: renameValue.value.trim() });
    showRename.value = false;
    showToast('已重命名');
    await Promise.all([loadLibrary(), loadStats()]);
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function mergePoint(): Promise<void> {
  if (!selectedPoint.value || !mergeTargetId.value) return;
  saving.value = true;
  try {
    await knowledgeApi.merge(selectedPoint.value.id, mergeTargetId.value);
    showMerge.value = false;
    showToast('已合并');
    await Promise.all([loadLibrary(), loadStats()]);
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function deletePoint(): Promise<void> {
  if (!selectedPoint.value) return;
  try {
    await showConfirmDialog({
      title: '删除知识点',
      message: `确认删除「${selectedPoint.value.name}」吗？已关联错题的知识点不能删除。`,
      confirmButtonText: '删除',
      confirmButtonColor: '#e11d48',
    });
    await knowledgeApi.remove(selectedPoint.value.id);
    showToast('已删除');
    await Promise.all([loadLibrary(), loadStats()]);
  } catch (error) {
    if (error !== 'cancel') showToast(errorMessage(error));
  }
}

function openAdd(): void {
  newName.value = '';
  newSubjectId.value = librarySubjectId.value || studentStore.subjects[0]?.id || 'math';
  showAdd.value = true;
}

async function addPoint(): Promise<void> {
  if (!newName.value.trim()) {
    showToast('请输入知识点名称');
    return;
  }
  if (!SUBJECT_MAP[newSubjectId.value]) {
    showToast('请选择学科');
    return;
  }
  saving.value = true;
  try {
    await knowledgeApi.create({ subjectId: newSubjectId.value, name: newName.value.trim() });
    showAdd.value = false;
    showToast('已添加');
    await loadLibrary();
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

watch(
  () => studentStore.currentStudentId,
  () => {
    libraryLoaded.value = false;
    subjectId.value = '';
    librarySubjectId.value = '';
    void loadStats();
    if (activeTab.value === 1) void loadLibrary();
  },
);

onMounted(() => {
  void loadStats();
});
</script>

<style scoped>
.knowledge-page {
  padding-top: 0;
}

.knowledge-page :deep(.van-tabs__nav) {
  background: transparent;
}

.knowledge-page :deep(.van-tab) {
  font-size: 13px;
}

.subject-chips {
  margin-top: 12px;
  margin-bottom: 12px;
}

.tab-loading {
  padding-top: 4px;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.point-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 12px;
}

.rank {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
}

.rank.top {
  background: var(--amber-soft);
  color: #b45309;
}

.point-main {
  flex: 1;
  min-width: 0;
}

.point-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.point-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.point-title strong {
  overflow: hidden;
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weak-score {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: #d97706;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.1;
}

.weak-score small {
  color: var(--muted);
  font-size: 8px;
  font-weight: 400;
}

.point-bar {
  height: 5px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-soft);
}

.point-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f59e0b, #f97316);
}

.point-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 5px;
  color: var(--muted);
  font-size: 9.5px;
}

.point-meta .overdue {
  color: var(--rose);
}

.point-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  flex: 0 0 auto;
  padding: 4px 2px;
  border: 0;
  background: transparent;
  color: var(--brand);
  font-size: 9.5px;
  font-weight: 600;
}

.empty-card {
  padding: 20px 16px;
}

.library-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.library-tools :deep(.van-search) {
  flex: 1;
  padding: 0;
}

.library-tools :deep(.van-search__content) {
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.add-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 50%;
  background: var(--brand);
  color: #fff;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

.library-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.library-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  text-align: left;
}

.library-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.library-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  line-height: 1.35;
}

.library-main strong {
  overflow: hidden;
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-main small {
  color: var(--muted);
  font-size: 10px;
}

.usage {
  color: var(--muted);
  font-size: 10.5px;
}

.library-tip {
  margin: 14px 4px 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
  text-align: center;
}

.sheet {
  padding: 18px 18px calc(18px + var(--safe-bottom));
}

.sheet h3 {
  margin: 0 0 14px;
  font-size: 18px;
}

.sheet :deep(.van-field) {
  margin-bottom: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
}

.sheet-desc {
  margin: -6px 0 12px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}

.merge-list {
  max-height: 240px;
  overflow-y: auto;
  margin-bottom: 14px;
}

.merge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 11px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  margin-bottom: 6px;
  text-align: left;
}

.merge-row.active {
  border-color: rgba(79, 70, 229, 0.4);
  background: var(--brand-soft);
}

.merge-row > span:first-child {
  flex: 1;
  font-size: 13px;
}

.small {
  font-size: 10px;
}

.empty-merge {
  padding: 16px;
  font-size: 11px;
  text-align: center;
}

.subject-select {
  margin-bottom: 16px;
}

.subject-select > span {
  display: block;
  margin-bottom: 8px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}

.subject-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.subject-options button {
  padding: 6px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 11.5px;
}

.subject-options button.active {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}
</style>
