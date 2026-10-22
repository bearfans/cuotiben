<template>
  <div>
    <PageHeader
      :title="isEdit ? '编辑错题' : '手动录入'"
      :subtitle="isEdit ? '修改后会自动保存到错题本' : '把错题完整记录下来，整理更高效'"
    />

    <div v-if="loading" class="page">
      <div class="skeleton-card" style="height: 180px" />
      <div class="skeleton-card" style="height: 220px" />
    </div>

    <div v-else-if="draft" class="page edit-page">
      <div v-if="!studentStore.currentStudent" class="card panel">
        <EmptyState emoji="🧒" title="请先添加孩子档案" description="错题需要归属到具体孩子">
          <van-button round type="primary" @click="router.push('/profile')">去添加</van-button>
        </EmptyState>
      </div>

      <template v-else>
        <div class="tip-card">
          <van-icon name="bulb-o" />
          <span>点击「插入符号」选择常用数学/物理符号；插入后点击符号即可修改变量，公式直接显示最终效果。</span>
        </div>

        <QuestionForm :draft="draft" :subjects="studentStore.subjects" />

        <div class="sticky-actions">
          <van-button block round plain @click="cancel">取消</van-button>
          <van-button
            block
            round
            type="primary"
            :loading="saving"
            loading-text="保存中..."
            @click="save"
          >
            {{ isEdit ? '保存修改' : '保存到错题本' }}
          </van-button>
        </div>
      </template>
    </div>

    <div v-else class="page">
      <EmptyState emoji="🔍" title="错题不存在" description="它可能已被删除">
        <van-button round type="primary" @click="router.replace('/questions')">返回错题本</van-button>
      </EmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import type { Semester } from '@myos/shared';
import { questionsApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useStudentStore } from '@/stores/student';
import PageHeader from '@/components/PageHeader.vue';
import QuestionForm from '@/components/QuestionForm.vue';
import EmptyState from '@/components/EmptyState.vue';
import {
  defaultSubjectId,
  draftFromQuestion,
  draftToPayload,
  emptyDraft,
  isValidDraft,
  type QuestionDraft,
} from '@/types/question';

const route = useRoute();
const router = useRouter();
const studentStore = useStudentStore();

const draft = ref<QuestionDraft | null>(null);
const loading = ref(true);
const saving = ref(false);

const isEdit = computed(() => Boolean(route.params.id));

async function init(): Promise<void> {
  loading.value = true;
  try {
    await studentStore.loadSubjects();
    if (isEdit.value) {
      const { data } = await questionsApi.get(String(route.params.id));
      draft.value = draftFromQuestion(data);
    } else {
      const student = studentStore.currentStudent;
      draft.value = emptyDraft(
        defaultSubjectId(studentStore.subjects),
        student?.grade ?? 1,
        (student?.semester ?? 'FIRST') as Semester,
      );
    }
  } catch (error) {
    showToast(errorMessage(error));
    draft.value = null;
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  if (!draft.value) return;
  if (!isValidDraft(draft.value)) {
    showToast('请填写题目内容，并至少保留一个选项');
    return;
  }
  if (!studentStore.currentStudentId) {
    showToast('请先添加孩子档案');
    return;
  }
  saving.value = true;
  try {
    if (isEdit.value) {
      const { data } = await questionsApi.update(
        String(route.params.id),
        draftToPayload(draft.value),
      );
      showToast({ type: 'success', message: '修改已保存' });
      await router.replace(`/questions/${data.id}`);
    } else {
      const { data } = await questionsApi.create({
        ...draftToPayload(draft.value),
        studentId: studentStore.currentStudentId,
        source: 'MANUAL',
      });
      showToast({ type: 'success', message: '已保存到错题本' });
      await router.replace(`/questions/${data.id}`);
    }
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

function cancel(): void {
  if (window.history.length > 1) router.back();
  else void router.replace('/questions');
}

onMounted(init);
</script>

<style scoped>
.edit-page {
  padding-top: 4px;
}

.panel {
  padding: 24px 16px;
}

.tip-card {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--amber-soft);
  color: #92400e;
  font-size: 11px;
  line-height: 1.55;
}

.tip-card code {
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.65);
  font-size: 10.5px;
}

.sticky-actions {
  grid-template-columns: 0.8fr 1.6fr;
  display: grid;
}
</style>
