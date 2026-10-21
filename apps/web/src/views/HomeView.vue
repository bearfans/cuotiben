<template>
  <div class="home">
    <header class="home-hero">
      <div class="hero-top">
        <div>
          <p class="hello">{{ greeting }}，{{ auth.user?.displayName || '家长' }}</p>
          <h1>今天也一起进步</h1>
        </div>
        <StudentSwitcher />
      </div>

      <div v-if="studentStore.currentStudent" class="overview-card">
        <div class="overview-copy">
          <span class="overview-label">本周新增</span>
          <strong>{{ stats?.addedThisWeek ?? 0 }}<small> 道错题</small></strong>
          <p class="overview-hint">继续整理，让薄弱点越来越清晰</p>
        </div>
        <button type="button" class="overview-action" @click="router.push('/upload')">
          <van-icon name="photograph" size="24" />
          <span>录题</span>
        </button>
      </div>
      <div v-else class="overview-card no-student">
        <div class="overview-copy">
          <strong>先添加孩子档案</strong>
          <p class="overview-hint">建立档案后即可录题、管理错题</p>
        </div>
        <button type="button" class="overview-action" @click="router.push('/profile')">
          <van-icon name="plus" size="22" />
          <span>添加</span>
        </button>
      </div>
    </header>

    <div class="page home-body">
      <div v-if="studentStore.currentStudent" class="stat-grid">
        <div class="stat-card card">
          <span class="stat-icon" style="background: #e8f7ee; color: #16a34a">
            <van-icon name="notes-o" />
          </span>
          <strong>{{ stats?.activeQuestions ?? 0 }}</strong>
          <span>错题总数</span>
        </div>
        <div class="stat-card card">
          <span class="stat-icon" style="background: #dcfce7; color: #15803d">
            <van-icon name="certificate" />
          </span>
          <strong>{{ stats?.masteredQuestions ?? 0 }}</strong>
          <span>已掌握</span>
        </div>
        <div class="stat-card card">
          <span class="stat-icon" style="background: #fef3c7; color: #d97706">
            <van-icon name="fire-o" />
          </span>
          <strong>{{ stats?.addedLast7Days ?? 0 }}</strong>
          <span>近 7 天新增</span>
        </div>
      </div>

      <template v-if="studentStore.currentStudent">
        <section class="section">
          <div class="section-head">
            <h2 class="section-title">学科分布</h2>
            <router-link class="section-link" to="/questions">全部错题 <van-icon name="arrow" /></router-link>
          </div>
          <div class="card panel">
            <div v-if="subjectRows.length" class="subject-list">
              <div v-for="row in subjectRows" :key="row.subjectId" class="subject-row">
                <span class="subject-dot" :style="{ background: row.color }" />
                <span class="subject-name">{{ row.name }}</span>
                <div class="subject-bar">
                  <span
                    :style="{
                      width: `${Math.max(6, (row.count / maxSubjectCount) * 100)}%`,
                      background: row.color,
                    }"
                  />
                </div>
                <strong>{{ row.count }}</strong>
              </div>
            </div>
            <EmptyState
              v-else
              emoji="📚"
              title="还没有错题"
              description="拍照识别或手动录入，开始建立专属错题本"
            >
              <van-button size="small" round type="primary" @click="router.push('/upload')">
                去录题
              </van-button>
            </EmptyState>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <h2 class="section-title">近 7 天录入</h2>
            <span class="section-link">{{ stats?.addedLast7Days ?? 0 }} 道新增</span>
          </div>
          <div class="card panel trend-panel">
            <div class="trend-bars">
              <div v-for="day in trend" :key="day.date" class="trend-col">
                <span class="trend-value" :class="{ zero: !day.count }">{{ day.count }}</span>
                <div class="trend-track">
                  <span
                    :style="{
                      height: `${day.count ? Math.max(12, (day.count / maxTrend) * 100) : 4}%`,
                    }"
                  />
                </div>
                <span class="trend-label">{{ day.label }}</span>
              </div>
            </div>
          </div>
        </section>

        <section v-if="weakPoints.length" class="section">
          <div class="section-head">
            <h2 class="section-title">薄弱知识点</h2>
            <router-link class="section-link" to="/knowledge">查看全部 <van-icon name="arrow" /></router-link>
          </div>
          <div class="card panel weak-list">
            <button
              v-for="point in weakPoints"
              :key="point.knowledgePointId"
              type="button"
              class="weak-row"
              @click="openKnowledge(point)"
            >
              <div class="weak-main">
                <div class="weak-title">
                  <span>{{ point.name }}</span>
                  <span class="weak-count">{{ point.count }} 题</span>
                </div>
                <div class="weak-bar">
                  <span :style="{ width: `${Math.max(5, (point.avgMastery / 5) * 100)}%` }" />
                </div>
              </div>
              <span class="weak-score">{{ point.avgMastery.toFixed(1) }}</span>
              <van-icon name="arrow" color="#cbd5e1" />
            </button>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <h2 class="section-title">最近错题</h2>
            <router-link class="section-link" to="/questions">更多 <van-icon name="arrow" /></router-link>
          </div>
          <QuestionCard
            v-for="question in recent"
            :key="question.id"
            :question="question"
            @open="router.push(`/questions/${question.id}`)"
          />
          <div v-if="!recent.length" class="card panel">
            <EmptyState emoji="✏️" title="最近还没有录入" description="拍照或手动添加一道错题吧" />
          </div>
        </section>
      </template>

      <section v-else class="section welcome-card card">
        <span class="welcome-emoji">👋</span>
        <h2>欢迎使用错题本</h2>
        <p>先建立孩子档案，AI 才能按年级和学科整理错题。</p>
        <van-button round type="primary" @click="router.push('/profile')">添加孩子档案</van-button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import type { KnowledgeStat, OverviewStats, WrongQuestion } from '@myos/shared';
import { questionsApi, statsApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useStudentStore } from '@/stores/student';
import StudentSwitcher from '@/components/StudentSwitcher.vue';
import QuestionCard from '@/components/QuestionCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import { formatDate } from '@/utils/format';

const router = useRouter();
const auth = useAuthStore();
const studentStore = useStudentStore();

const stats = ref<OverviewStats | null>(null);
const weakPoints = ref<KnowledgeStat[]>([]);
const recent = ref<WrongQuestion[]>([]);
const loading = ref(false);

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const subjectRows = computed(() =>
  [...(stats.value?.subjectDistribution ?? [])].sort((a, b) => b.count - a.count),
);
const maxSubjectCount = computed(() => Math.max(1, ...subjectRows.value.map((row) => row.count)));
const trend = computed(() =>
  (stats.value?.trend ?? []).slice(-7).map((day) => ({
    ...day,
    label: `${formatDate(day.date, 'D')}日`,
  })),
);
const maxTrend = computed(() => Math.max(1, ...trend.value.map((day) => day.count)));

async function load(): Promise<void> {
  if (!studentStore.currentStudentId) {
    stats.value = null;
    weakPoints.value = [];
    recent.value = [];
    return;
  }
  loading.value = true;
  try {
    const studentId = studentStore.currentStudentId;
    const [overview, knowledge, questions] = await Promise.all([
      statsApi.overview(studentId),
      statsApi.knowledge({ studentId, limit: 4 }),
      questionsApi.list({ studentId, page: 1, pageSize: 3 }),
    ]);
    stats.value = overview.data;
    weakPoints.value = knowledge.data;
    recent.value = questions.data.items;
  } catch (error) {
    showError(error);
  } finally {
    loading.value = false;
  }
}

function showError(error: unknown): void {
  showToast(errorMessage(error));
}

function openKnowledge(point: KnowledgeStat): void {
  void router.push({ path: '/questions', query: { knowledgePointId: point.knowledgePointId } });
}

onMounted(load);
watch(() => studentStore.currentStudentId, load);
</script>

<style scoped>
.home {
  min-height: 100vh;
}

.home-hero {
  padding: 18px 18px 44px;
  background:
    radial-gradient(circle at 90% 10%, rgba(255, 255, 255, 0.2), transparent 36%),
    linear-gradient(145deg, #15803d 0%, #16a34a 42%, #22c55e 100%);
  color: #fff;
  border-radius: 0 0 28px 28px;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
}

.hello {
  margin: 0 0 4px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.hero-top h1 {
  margin: 0;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.overview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
}

.overview-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.overview-label {
  color: rgba(255, 255, 255, 0.68);
  font-size: 11px;
  letter-spacing: 0.5px;
}

.overview-copy strong {
  margin-top: 2px;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.1;
}

.overview-copy strong small {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.75;
}

.overview-hint {
  margin: 3px 0 0;
  color: rgba(255, 255, 255, 0.66);
  font-size: 11px;
}

.overview-action {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 14px;
  border: 0;
  border-radius: 14px;
  background: #fff;
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
}

.home-body {
  margin-top: -26px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 13px 12px;
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-bottom: 4px;
  border-radius: 9px;
  font-size: 15px;
}

.stat-card strong {
  font-size: 21px;
  font-weight: 800;
  line-height: 1.15;
}

.stat-card > span:last-child {
  color: var(--muted);
  font-size: 10.5px;
}

.panel {
  padding: 16px;
}

.subject-list {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.subject-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.subject-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.subject-name {
  width: 46px;
  flex: 0 0 auto;
  color: var(--text-2);
}

.subject-bar {
  flex: 1;
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-soft);
}

.subject-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.subject-row strong {
  width: 22px;
  color: var(--text-2);
  font-size: 12px;
  text-align: right;
}

.trend-panel {
  padding: 16px 12px 12px;
}

.trend-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 5px;
  height: 120px;
}

.trend-col {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.trend-value {
  color: var(--text-2);
  font-size: 10px;
  font-weight: 700;
}

.trend-value.zero {
  color: var(--muted);
}

.trend-track {
  display: flex;
  align-items: flex-end;
  width: 100%;
  flex: 1;
  overflow: hidden;
  border-radius: 6px;
  background: linear-gradient(to top, #e8f7ee, transparent);
}

.trend-track span {
  display: block;
  width: 100%;
  border-radius: 6px 6px 3px 3px;
  background: linear-gradient(to top, #22c55e, #86efac);
}

.trend-label {
  color: var(--muted);
  font-size: 9.5px;
}

.weak-list {
  padding: 6px 14px;
}

.weak-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 0;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  text-align: left;
}

.weak-row:last-child {
  border-bottom: 0;
}

.weak-main {
  flex: 1;
  min-width: 0;
}

.weak-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
}

.weak-count {
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 400;
}

.weak-bar {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-soft);
}

.weak-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f59e0b, #f97316);
}

.weak-score {
  width: 28px;
  color: #d97706;
  font-size: 13px;
  font-weight: 800;
  text-align: right;
}

.welcome-card {
  padding: 32px 24px;
  text-align: center;
}

.welcome-emoji {
  font-size: 44px;
}

.welcome-card h2 {
  margin: 10px 0 6px;
  font-size: 20px;
}

.welcome-card p {
  margin: 0 0 18px;
  color: var(--muted);
  font-size: 13px;
}
</style>
