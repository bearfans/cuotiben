<template>
  <div class="papers-view">
    <div class="page papers-page">
      <section class="papers-hero">
        <div class="hero-copy">
          <span class="hero-label">错题重练</span>
          <h1>把错题变成一张试卷</h1>
          <p>按学科、掌握度筛选题目，A4 排版，答案单独成页</p>
          <van-button round size="small" class="hero-action" @click="router.push('/papers/new')">
            <van-icon name="plus" />
            新建试卷
          </van-button>
        </div>
        <div class="hero-art">
          <span class="hero-sheet back" />
          <span class="hero-sheet front">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </section>

      <div v-if="paperSelection.count" class="selection-banner card" @click="router.push('/papers/new')">
        <van-icon name="passed" color="var(--brand)" size="18" />
        <span>已从错题本选择 <b>{{ paperSelection.count }}</b> 道题</span>
        <van-icon name="arrow" color="var(--muted)" />
      </div>

      <div class="section-head list-head">
        <h2 class="section-title">我的试卷</h2>
        <span class="muted small">{{ papers.length }} 份</span>
      </div>

      <div class="papers-scroll-wrap">
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
            <van-icon name="arrow" color="var(--muted)" />
          </button>

          <div v-if="!papers.length" class="card empty-card">
            <EmptyState
              icon="description-o"
              title="还没有生成过试卷"
              description="从错题中挑几道题，生成一张专属练习卷，打印出来练一练"
            >
              <van-button round type="primary" @click="router.push('/papers/new')">生成第一份试卷</van-button>
            </EmptyState>
          </div>
        </template>
      </div>
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
.papers-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 76px - var(--safe-bottom));
  height: calc(100dvh - 76px - var(--safe-bottom));
  overflow: hidden;
}

.papers-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding-top: calc(10px + var(--safe-top));
  padding-bottom: 0;
}

.papers-page > :not(.papers-scroll-wrap) {
  flex: 0 0 auto;
}

.papers-scroll-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}

.papers-hero {
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

.hero-sheet {
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

.hero-sheet.back {
  top: 4px;
  right: 2px;
  opacity: 0.4;
  transform: rotate(9deg);
}

.hero-sheet.front {
  top: 10px;
  right: 12px;
  transform: rotate(-5deg);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
}

.hero-sheet.front i {
  display: block;
  height: 4px;
  border-radius: 999px;
  background: var(--accent-soft);
}

.hero-sheet.front i:first-child {
  width: 70%;
  height: 6px;
  background: var(--accent-light);
}

.hero-sheet.front i:nth-child(3) {
  width: 84%;
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
  background: var(--brand-soft);
  color: var(--brand);
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
  background: var(--brand-soft);
  color: var(--brand);
}

.empty-card {
  padding: 22px 16px;
}
</style>
