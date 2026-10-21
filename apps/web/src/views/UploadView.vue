<template>
  <div>
    <PageHeader title="拍照录题" subtitle="AI 自动识别题目、答案和知识点" />

    <div class="page upload-page">
      <div v-if="!studentStore.currentStudent" class="card panel">
        <EmptyState
          emoji="🧒"
          title="先添加孩子档案"
          description="识别结果需要按年级和学科归档"
        >
          <van-button round type="primary" @click="router.push('/profile')">去添加</van-button>
        </EmptyState>
      </div>

      <template v-else>
        <div class="student-bar card">
          <span class="student-label">当前孩子</span>
          <StudentSwitcher />
        </div>

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
            >
              <div class="upload-trigger">
                <span class="upload-icon"><van-icon name="photograph" size="27" /></span>
                <strong>拍照 / 从相册选择</strong>
                <small>一页一张，最多 9 张</small>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, type UploaderFileListItem } from 'vant';
import { aiApi, uploadsApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useStudentStore } from '@/stores/student';
import PageHeader from '@/components/PageHeader.vue';
import StudentSwitcher from '@/components/StudentSwitcher.vue';
import EmptyState from '@/components/EmptyState.vue';

const router = useRouter();
const studentStore = useStudentStore();

const fileList = ref<UploaderFileListItem[]>([]);
const uploadIds = ref<string[]>([]);
const uploadIdByUrl = new Map<string, string>();
const uploading = ref(0);
const starting = ref(false);
const subjectHint = ref('');
const quota = ref<{ used: number; limit: number; remaining: number } | null>(null);

onMounted(async () => {
  try {
    const { data } = await aiApi.quota();
    quota.value = data;
  } catch {
    // Quota display is optional.
  }
});

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
</script>

<style scoped>
.upload-page {
  padding-top: 4px;
}

.panel {
  padding: 24px 16px;
}

.student-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
}

.student-label {
  color: var(--muted);
  font-size: 11.5px;
}

.small {
  font-size: 11.5px;
}

.upload-card {
  padding: 16px;
}

.upload-card :deep(.van-uploader__upload) {
  width: 96px;
  height: 96px;
  margin: 0;
  border: 1.5px dashed #c7d2fe;
  border-radius: 14px;
  background: #f8faff;
}

.upload-card :deep(.van-uploader__preview) {
  margin: 0 8px 8px 0;
}

.upload-card :deep(.van-uploader__preview-image) {
  width: 96px;
  height: 96px;
  border-radius: 12px;
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: 100%;
  color: var(--text-2);
}

.upload-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 2px;
  border-radius: 12px;
  background: var(--brand-soft);
  color: var(--brand);
}

.upload-trigger strong {
  font-size: 11.5px;
}

.upload-trigger small {
  color: var(--muted);
  font-size: 9.5px;
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
