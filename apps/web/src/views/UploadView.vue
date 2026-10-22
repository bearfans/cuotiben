<template>
  <div>
    <PageHeader title="录入错题" subtitle="AI 识别或手动录入，选择适合孩子的方式" />

    <div class="page upload-page">
      <div v-if="!studentStore.currentStudent" class="card panel">
        <EmptyState
          icon="friends-o"
          title="先添加孩子档案"
          description="录入结果需要按年级和学科归档"
        >
          <van-button round type="primary" @click="router.push('/profile')">去添加</van-button>
        </EmptyState>
      </div>

      <template v-else>
        <div class="mode-grid">
          <button
            type="button"
            class="mode-card"
            :class="{ active: mode === 'ai' }"
            :aria-pressed="mode === 'ai'"
            @click="setMode('ai')"
          >
            <span class="mode-icon"><van-icon name="photo-o" size="21" /></span>
            <span class="mode-copy">
              <strong>AI 识别</strong>
              <small>拍照自动录入</small>
            </span>
          </button>
          <button
            type="button"
            class="mode-card"
            :class="{ active: mode === 'manual' }"
            :aria-pressed="mode === 'manual'"
            @click="setMode('manual')"
          >
            <span class="mode-icon"><van-icon name="edit" size="20" /></span>
            <span class="mode-copy">
              <strong>手动录入</strong>
              <small>自己填写题目</small>
            </span>
          </button>
        </div>

        <StudentSwitcher variant="card" class="student-block" @add="goProfile" />

        <template v-if="mode === 'ai'">
          <div class="section">
            <div class="section-head">
              <h2 class="section-title">选择学科</h2>
              <span class="muted small">不确定就交给 AI</span>
            </div>
            <div class="chip-row">
              <button
                type="button"
                class="chip"
                :class="{ active: !subjectHint }"
                @click="subjectHint = ''"
              >
                自动识别
              </button>
              <button
                v-for="subject in studentStore.subjects"
                :key="subject.id"
                type="button"
                class="chip"
                :class="{ active: subjectHint === subject.id }"
                @click="subjectHint = subject.id"
              >
                {{ subject.name }}
              </button>
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <h2 class="section-title">上传题目图片</h2>
              <span class="muted small">{{ fileList.length }}/9 张</span>
            </div>
            <div class="card upload-card">
              <van-uploader
                v-model="fileList"
                :max-count="9"
                multiple
                accept="image/*"
                :after-read="afterRead"
                :before-delete="beforeDelete"
                :preview-full-image="true"
                :class="{ centered: !fileList.length }"
              >
                <div class="upload-trigger">
                  <span class="upload-icon"><van-icon name="photo-o" size="34" /></span>
                </div>
              </van-uploader>
              <div class="upload-tip">
                <van-icon name="info-o" />
                <span>保持光线充足、画面平整，题干与手写作答都要拍清楚</span>
              </div>
            </div>
          </div>

          <div v-if="quota" class="quota-line">
            <van-icon name="shield-o" />
            今日 AI 识别剩余 {{ quota.remaining }} 次
          </div>

          <div class="sticky-actions upload-actions">
            <van-button
              block
              round
              type="primary"
              size="large"
              :loading="starting"
              :disabled="!uploadIds.length || uploading > 0"
              loading-text="正在提交识别..."
              @click="startRecognition"
            >
              开始 AI 识别（{{ uploadIds.length }} 张）
            </van-button>
          </div>
        </template>

        <template v-else>
          <div class="manual-tip">
            <van-icon name="bulb-o" />
            <span>数学、物理符号可点击「插入符号」生成，题目会直接显示公式的最终效果。</span>
          </div>

          <div v-if="manualDraft" class="manual-form">
            <QuestionForm :draft="manualDraft" :subjects="studentStore.subjects" />
          </div>
          <div v-else class="card manual-loading">
            <van-loading size="22">正在加载表单...</van-loading>
          </div>

          <div class="sticky-actions upload-actions">
            <van-button
              block
              round
              type="primary"
              size="large"
              :loading="savingManual"
              loading-text="保存中..."
              :disabled="!manualDraft"
              @click="saveManual"
            >
              保存到错题本
            </van-button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, type UploaderFileListItem } from 'vant';
import type { Semester } from '@myos/shared';
import { aiApi, questionsApi, uploadsApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useStudentStore } from '@/stores/student';
import PageHeader from '@/components/PageHeader.vue';
import StudentSwitcher from '@/components/StudentSwitcher.vue';
import EmptyState from '@/components/EmptyState.vue';
import QuestionForm from '@/components/QuestionForm.vue';
import {
  defaultSubjectId,
  draftToPayload,
  emptyDraft,
  isValidDraft,
  type QuestionDraft,
} from '@/types/question';

type EntryMode = 'ai' | 'manual';

const route = useRoute();
const router = useRouter();
const studentStore = useStudentStore();

const mode = ref<EntryMode>(route.query.mode === 'manual' ? 'manual' : 'ai');
const fileList = ref<UploaderFileListItem[]>([]);
const uploadIds = ref<string[]>([]);
const uploadIdByUrl = new Map<string, string>();
const uploading = ref(0);
const starting = ref(false);
const subjectHint = ref('');
const quota = ref<{ used: number; limit: number; remaining: number } | null>(null);
const manualDraft = ref<QuestionDraft | null>(null);
const manualLoading = ref(false);
const savingManual = ref(false);

onMounted(async () => {
  try {
    const { data } = await aiApi.quota();
    quota.value = data;
  } catch {
    // Quota display is optional.
  }
});

watch(
  mode,
  async (value) => {
    if (value === 'manual') await initManualDraft();
  },
  { immediate: true },
);

watch(
  () => studentStore.currentStudentId,
  () => {
    const student = studentStore.currentStudent;
    if (!manualDraft.value || !student) return;
    manualDraft.value.grade = student.grade ?? 1;
    manualDraft.value.semester = (student.semester ?? 'FIRST') as Semester;
  },
);

function setMode(next: EntryMode): void {
  if (mode.value === next) return;
  mode.value = next;
  syncModeQuery(next);
}

function goProfile(): void {
  void router.push('/profile');
}

function syncModeQuery(value: EntryMode): void {
  const url = new URL(window.location.href);
  if (value === 'manual') url.searchParams.set('mode', 'manual');
  else url.searchParams.delete('mode');
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
}

async function initManualDraft(): Promise<void> {
  if (manualDraft.value || manualLoading.value || !studentStore.currentStudent) return;
  manualLoading.value = true;
  try {
    await studentStore.loadSubjects();
  } catch (error) {
    showToast(errorMessage(error));
  }
  try {
    const student = studentStore.currentStudent;
    if (!student) return;
    manualDraft.value = emptyDraft(
      defaultSubjectId(studentStore.subjects),
      student.grade ?? 1,
      (student.semester ?? 'FIRST') as Semester,
    );
  } finally {
    manualLoading.value = false;
  }
}

async function afterRead(
  item: UploaderFileListItem | UploaderFileListItem[],
): Promise<void> {
  const items = Array.isArray(item) ? item : [item];
  for (const entry of items) {
    if (!entry.file) continue;
    uploading.value += 1;
    entry.status = 'uploading';
    entry.message = '上传中';
    try {
      const { data } = await uploadsApi.upload([entry.file]);
      const uploaded = data[0];
      uploadIds.value.push(uploaded.id);
      uploadIdByUrl.set(uploaded.url, uploaded.id);
      entry.url = uploaded.url;
      entry.status = 'done';
      entry.message = '';
    } catch (error) {
      entry.status = 'failed';
      entry.message = '上传失败';
      showToast(errorMessage(error));
    } finally {
      uploading.value -= 1;
    }
  }
}

function beforeDelete(item: UploaderFileListItem): boolean {
  if (item.url) {
    const uploadId = uploadIdByUrl.get(item.url);
    if (uploadId) {
      uploadIds.value = uploadIds.value.filter((id) => id !== uploadId);
      uploadIdByUrl.delete(item.url);
    }
  }
  return true;
}

async function startRecognition(): Promise<void> {
  if (!uploadIds.value.length) {
    showToast('请先上传题目图片');
    return;
  }
  starting.value = true;
  try {
    const { data } = await aiApi.createJob({
      studentId: studentStore.currentStudentId,
      uploadIds: uploadIds.value,
      subjectHint: subjectHint.value || undefined,
    });
    await router.push(`/upload/confirm/${data.id}`);
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    starting.value = false;
  }
}

async function saveManual(): Promise<void> {
  if (!manualDraft.value) return;
  if (!isValidDraft(manualDraft.value)) {
    showToast('请填写题目内容，并至少保留一个选项');
    return;
  }
  if (!studentStore.currentStudentId) {
    showToast('请先添加孩子档案');
    return;
  }
  savingManual.value = true;
  try {
    const { data } = await questionsApi.create({
      ...draftToPayload(manualDraft.value),
      studentId: studentStore.currentStudentId,
      source: 'MANUAL',
    });
    showToast({ type: 'success', icon: 'passed', message: '已保存到错题本' });
    await router.replace(`/questions/${data.id}`);
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    savingManual.value = false;
  }
}
</script>

<style scoped>
.upload-page {
  padding-top: 4px;
}

.panel {
  padding: 24px 16px;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 9px;
  margin-bottom: 12px;
}

.mode-card {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  color: var(--text-2);
  text-align: left;
  box-shadow: var(--shadow-soft);
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.mode-card.active {
  border-color: transparent;
  background: linear-gradient(135deg, var(--brand-dark), var(--brand));
  color: #fff;
  box-shadow: 0 8px 20px rgba(22, 163, 74, 0.24);
}

.mode-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 11px;
  background: var(--brand-soft);
  color: var(--brand);
}

.mode-card.active .mode-icon {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.mode-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.mode-copy strong {
  color: var(--text);
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.25;
}

.mode-card.active .mode-copy strong {
  color: #fff;
}

.mode-copy small {
  overflow: hidden;
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode-card.active .mode-copy small {
  color: rgba(255, 255, 255, 0.78);
}

.student-block {
  display: block;
}

.small {
  font-size: 11.5px;
}

.manual-tip {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--amber-soft);
  color: #92400e;
  font-size: 11px;
  line-height: 1.55;
}

.manual-tip code {
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.65);
  font-size: 10.5px;
}

.manual-form {
  margin-top: 12px;
}

.manual-loading {
  display: grid;
  place-items: center;
  min-height: 180px;
  margin-top: 14px;
}

.upload-card {
  padding: 16px;
}

/* 未选图片时，相机/上传按钮在卡片内居中显示 */
.upload-card :deep(.van-uploader.centered) {
  display: flex;
  justify-content: center;
  width: 100%;
}

.upload-card :deep(.van-uploader.centered .van-uploader__upload) {
  width: 132px;
  height: 132px;
  margin: 0;
}

.upload-card :deep(.van-uploader__upload) {
  width: 96px;
  height: 96px;
  margin: 0 8px 8px 0;
  border: 1.5px dashed #bbf7d0;
  border-radius: 14px;
  background: #f8faff;
}

.upload-card :deep(.van-uploader__preview) {
  margin: 0 8px 8px 0;
}

.upload-card :deep(.van-uploader__preview-image) {
  width: 96px;
  height: 96px;
  border-radius: 14px;
}

.upload-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-2);
}

.upload-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: var(--brand-soft);
  color: var(--brand);
}

.upload-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.quota-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 18px;
  color: var(--muted);
  font-size: 11px;
}

.upload-actions {
  bottom: calc(70px + var(--safe-bottom));
}
</style>
