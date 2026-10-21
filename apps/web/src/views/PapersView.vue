<template>
  <div>
    <PageHeader title="错题组卷" subtitle="从错题本生成可打印的复习试卷" :back="false">
      <template #right>
        <button type="button" class="header-add" @click="router.push('/papers/new')">
          <van-icon name="plus" /> 新建
        </button>
      </template>
    </PageHeader>

    <div class="page papers-page">
      <div class="create-banner">
        <div class="banner-copy">
          <span class="banner-label">错题重练</span>
          <h2>把错题变成一张试卷</h2>
          <p>按学科、掌握度筛选题目，A4 排版，答案单独成页</p>
          <van-button round size="small" class="banner-btn" @click="router.push('/papers/new')">
            开始组卷
            <van-icon name="arrow" />
          </van-button>
        </div>
        <div class="banner-art">
          <span class="paper-sheet back" />
          <span class="paper-sheet front">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>

      <div v-if="paperSelection.count" class="selection-banner card" @click="router.push('/papers/new')">
        <van-icon name="checked" color="#4f46e5" size="18" />
        <span>已从错题本选择 <b>{{ paperSelection.count }}</b> 道题</span>
        <van-icon name="arrow" color="#94a3b8" />
      </div>

      <div class="section-head list-head">
        <h2 class="section-title">我的试卷</h2>
        <span class="muted small">{{ papers.length }} 份</span>
      </div>

      <div v-if="loading" class="tab-loading">
        <div class="skeleton-card" />
        <div class="skeleton-card" />
      </div>

      <template v-else>
        <button
          v-for="paper in papers"
          :key="paper.id"
          type="button"
          class="paper-card card"
          @click="router.push(`/papers/${paper.id}`)"
        >
          <div class="paper-icon">
            <van-icon name="description-o" size="24" />
          </div>
          <div class="paper-main">
            <strong>{{ paper.title }}</strong>
            <div class="paper-meta">
              <span v-if="paper.subjectId">{{ subjectName(paper.subjectId) }}</span>
              <span>{{ paper.questionCount }} 道题</span>
              <span>{{ formatDate(paper.createdAt, 'YYYY-MM-DD') }}</span>
            </div>
            <div class="paper-tags">
              <span v-if="paper.settings.includeAnswers" class="tag">含答案</span>
              <span v-if="paper.settings.includeKnowledgePoints" class="tag">含知识点</span>
              <span v-if="paper.hasPdf" class="tag pdf">已生成 PDF</span>
            </div>
          </div>
          <van-icon name="arrow" color="#cbd5e1" />
        </button>

        <div v-if="!papers.length" class="card empty-card">
          <EmptyState
            emoji="📄"
            title="还没有生成过试卷"
            description="从错题中挑几道题，生成一张专属复习卷，打印出来练一练"
          >
            <van-button round type="primary" @click="router.push('/papers/new')">生成第一份试卷</van-button>
          </EmptyState>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { subjectName, type Paper } from '@myos/shared';
import { papersApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useStudentStore } from '@/stores/student';
import { usePaperSelectionStore } from '@/stores/paperSelection';
import PageHeader from '@/components/PageHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import { formatDate } from '@/utils/format';

const router = useRouter();
const studentStore = useStudentStore();
const paperSelection = usePaperSelectionStore();

const papers = ref<Paper[]>([]);
const loading = ref(true);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const { data } = await papersApi.list(studentStore.currentStudentId || undefined);
    papers.value = data;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

watch(() => studentStore.currentStudentId, load);
onMounted(load);
</script>

<style scoped>
.papers-page {
  padding-top: 4px;
}

.header-add {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 6px 11px;
  border: 0;
  border-radius: 999px;
  background: var(--brand);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.create-banner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  overflow: hidden;
  padding: 20px 18px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 92% 12%, rgba(255, 255, 255, 0.24), transparent 38%),
    linear-gradient(135deg, #0f766e, #0d9488 55%, #14b8a6);
  color: #fff;
  box-shadow: 0 12px 28px rgba(13, 148, 136, 0.22);
}

.banner-copy {
  position: relative;
  z-index: 1;
}

.banner-label {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 9.5px;
  letter-spacing: 0.6px;
}

.banner-copy h2 {
  margin: 7px 0 4px;
  font-size: 19px;
  font-weight: 700;
}

.banner-copy p {
  max-width: 210px;
  margin: 0 0 12px;
  color: rgba(255, 255, 255, 0.74);
  font-size: 10.5px;
  line-height: 1.55;
}

.banner-btn {
  height: 32px;
  border: 0;
  background: #fff;
  color: #0f766e;
  font-size: 11.5px;
}

.banner-art {
  position: relative;
  width: 84px;
  height: 104px;
  flex: 0 0 auto;
}

.paper-sheet {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 64px;
  height: 88px;
  padding: 12px 10px;
  border-radius: 8px;
  background: #fff;
}

.paper-sheet.back {
  top: 4px;
  right: 2px;
  opacity: 0.4;
  transform: rotate(9deg);
}

.paper-sheet.front {
  top: 10px;
  right: 12px;
  transform: rotate(-5deg);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
}

.paper-sheet.front i {
  display: block;
  height: 4px;
  border-radius: 999px;
  background: #ccfbf1;
}

.paper-sheet.front i:nth-child(1) {
  width: 70%;
  height: 6px;
  background: #5eead4;
}

.paper-sheet.front i:nth-child(3) {
  width: 84%;
}

.selection-banner {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
  padding: 11px 14px;
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
}

.selection-banner span {
  flex: 1;
}

.selection-banner b {
  color: var(--brand);
}

.list-head {
  margin-top: 20px;
}

.small {
  font-size: 11px;
}

.tab-loading {
  padding-top: 4px;
}

.paper-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-bottom: 10px;
  padding: 14px;
  border: 0;
  text-align: left;
}

.paper-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  border-radius: 14px;
  background: var(--teal-soft);
  color: var(--teal);
}

.paper-main {
  flex: 1;
  min-width: 0;
}

.paper-main strong {
  display: block;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}

.paper-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.tag {
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 9px;
}

.tag.pdf {
  background: var(--teal-soft);
  color: var(--teal);
}

.empty-card {
  padding: 22px 16px;
}
</style>
