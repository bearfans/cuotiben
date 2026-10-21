<template>
  <div>
    <PageHeader title="复习计划" subtitle="按记忆曲线安排，每天一点点" :back="false" />

    <div class="page review-page">
      <van-tabs
        v-model:active="activeTab"
        background="transparent"
        color="#4f46e5"
        title-active-color="#4f46e5"
        title-inactive-color="#94a3b8"
        line-width="24"
        @change="onTabChange"
      >
        <van-tab title="今日复习">
          <div v-if="loadingToday" class="tab-loading">
            <div class="skeleton-card" />
            <div class="skeleton-card" />
          </div>

          <template v-else-if="today">
            <div class="today-summary card">
              <div class="summary-ring" :style="{ '--progress': progressAngle }">
                <div class="ring-inner">
                  <strong>{{ today.completedToday }}</strong>
                  <span>今日完成</span>
                </div>
              </div>
              <div class="summary-copy">
                <h2>{{ today.totalDue ? '还有任务待完成' : '今天的复习完成啦' }}</h2>
                <p>
                  待复习 <b>{{ today.totalDue }}</b> 道
                  <span v-if="today.overdue.length">· 逾期 <b class="overdue">{{ today.overdue.length }}</b> 道</span>
                </p>
                <div class="summary-tags">
                  <span>今日完成 {{ today.completedToday }} 道</span>
                  <span v-if="today.totalDue">完成后会自动安排下次复习</span>
                </div>
              </div>
            </div>

            <template v-if="today.overdue.length">
              <div class="section-head list-title">
                <h3>逾期任务</h3>
                <span class="overdue-badge">{{ today.overdue.length }}</span>
              </div>
              <ReviewTaskCard
                v-for="task in today.overdue"
                :key="task.id"
                :task="task"
                :busy="busyId === task.id"
                @complete="completeTask"
                @snooze="snoozeTask"
              />
            </template>

            <template v-if="today.today.length">
              <div class="section-head list-title">
                <h3>今日任务</h3>
                <span class="muted small">{{ today.today.length }} 道</span>
              </div>
              <ReviewTaskCard
                v-for="task in today.today"
                :key="task.id"
                :task="task"
                :busy="busyId === task.id"
                @complete="completeTask"
                @snooze="snoozeTask"
              />
            </template>

            <div v-if="!today.totalDue" class="card done-card">
              <EmptyState
                emoji="🎉"
                title="今日复习已完成"
                description="坚持每天复习，错题会越来越少。可以提前看看明天的安排。"
              >
                <van-button round plain size="small" @click="activeTab = 1">查看复习日历</van-button>
              </EmptyState>
            </div>
          </template>

          <div v-else class="card done-card">
            <EmptyState
              emoji="🧒"
              title="先添加孩子档案"
              description="添加孩子后即可按记忆曲线安排每日复习"
            >
              <van-button round type="primary" size="small" @click="router.push('/profile')">
                去添加
              </van-button>
            </EmptyState>
          </div>
        </van-tab>

        <van-tab title="日历">
          <div class="calendar-head">
            <button type="button" class="month-btn" @click="changeMonth(-1)">
              <van-icon name="arrow-left" />
            </button>
            <strong>{{ calendarTitle }}</strong>
            <button type="button" class="month-btn" @click="changeMonth(1)">
              <van-icon name="arrow" />
            </button>
          </div>

          <div class="card calendar-card">
            <div class="weekdays">
              <span v-for="day in weekdays" :key="day">{{ day }}</span>
            </div>
            <div class="calendar-grid">
              <div
                v-for="(cell, index) in calendarCells"
                :key="index"
                class="calendar-cell"
                :class="{ empty: !cell, today: cell?.isToday }"
              >
                <template v-if="cell">
                  <span class="day-num">{{ cell.day }}</span>
                  <span v-if="cell.due" class="day-dot due" :title="`待复习 ${cell.due} 道`" />
                  <span
                    v-if="cell.completed"
                    class="day-dot completed"
                    :title="`已完成 ${cell.completed} 次`"
                  />
                </template>
              </div>
            </div>
            <div class="calendar-legend">
              <span><i class="legend-dot due" /> 待复习</span>
              <span><i class="legend-dot completed" /> 已完成</span>
            </div>
          </div>

          <div v-if="calendar" class="calendar-summary card">
            <div>
              <strong>{{ calendar.due.reduce((sum, item) => sum + item.count, 0) }}</strong>
              <span>本月待复习</span>
            </div>
            <div>
              <strong>{{ calendar.completed.reduce((sum, item) => sum + item.count, 0) }}</strong>
              <span>本月已完成</span>
            </div>
          </div>
        </van-tab>

        <van-tab title="复习记录">
          <div v-if="historyLoading && !history.length" class="tab-loading">
            <div class="skeleton-card" />
            <div class="skeleton-card" />
          </div>
          <template v-else>
            <div v-if="history.length" class="history-list">
              <article v-for="log in history" :key="log.id" class="history-card card">
                <div class="history-head">
                  <span
                    class="rating-pill"
                    :style="ratingStyle(log.rating)"
                  >
                    {{ ratingLabel(log.rating) }}
                  </span>
                  <span class="history-date">{{ formatDate(log.completedAt, 'MM月DD日 HH:mm') }}</span>
                  <span class="history-interval">
                    {{ log.intervalBefore }}天 → {{ log.intervalAfter }}天
                  </span>
                </div>
                <button
                  type="button"
                  class="history-stem"
                  @click="router.push(`/questions/${log.wrongQuestion.id}`)"
                >
                  <RichText :text="log.wrongQuestion.stem" />
                </button>
                <div class="history-foot">
                  <SubjectPill :subject-id="log.wrongQuestion.subjectId" />
                  <span>掌握度 {{ log.masteryBefore }} → {{ log.masteryAfter }}</span>
                </div>
              </article>
            </div>
            <EmptyState
              v-else
              emoji="📝"
              title="还没有复习记录"
              description="完成一次复习后，这里会记录你的每一次进步"
            >
              <van-button round type="primary" size="small" @click="activeTab = 0">去复习</van-button>
            </EmptyState>
            <div v-if="history.length" class="load-more">
              <van-button
                v-if="history.length < historyTotal"
                block
                round
                plain
                :loading="historyLoading"
                @click="loadHistory(false)"
              >
                加载更多
              </van-button>
              <span v-else class="muted small">已显示全部记录</span>
            </div>
          </template>
        </van-tab>
      </van-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { showToast } from 'vant';
import {
  REVIEW_RATINGS,
  questionTypeLabel,
  type ReviewCalendar,
  type ReviewHistoryItem,
  type ReviewRating,
  type ReviewTask,
  type ReviewToday,
} from '@myos/shared';
import { reviewApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useStudentStore } from '@/stores/student';
import PageHeader from '@/components/PageHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import RichText from '@/components/RichText.vue';
import SubjectPill from '@/components/SubjectPill.vue';
import MasteryBadge from '@/components/MasteryBadge.vue';
import { formatDate, formatRelative } from '@/utils/format';

const router = useRouter();
const studentStore = useStudentStore();

const activeTab = ref(0);
const today = ref<ReviewToday | null>(null);
const loadingToday = ref(true);
const busyId = ref('');
const calendar = ref<ReviewCalendar | null>(null);
const month = ref(dayjs().format('YYYY-MM'));
const history = ref<ReviewHistoryItem[]>([]);
const historyTotal = ref(0);
const historyPage = ref(1);
const historyLoading = ref(false);
const calendarLoaded = ref(false);
const historyLoaded = ref(false);

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const calendarTitle = computed(() => dayjs(`${month.value}-01`).format('YYYY年MM月'));

const progressAngle = computed(() => {
  if (!today.value) return '0deg';
  const total = today.value.completedToday + today.value.totalDue;
  const ratio = total ? today.value.completedToday / total : 0;
  return `${Math.round(ratio * 360)}deg`;
});

const calendarCells = computed(() => {
  const first = dayjs(`${month.value}-01`);
  const daysInMonth = first.daysInMonth();
  const offset = first.day();
  const dueMap = new Map((calendar.value?.due ?? []).map((item) => [item.date, item.count]));
  const completedMap = new Map(
    (calendar.value?.completed ?? []).map((item) => [item.date, item.count]),
  );
  const cells: Array<{
    date: string;
    day: number;
    due: number;
    completed: number;
    isToday: boolean;
  } | null> = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = first.date(day).format('YYYY-MM-DD');
    cells.push({
      date,
      day,
      due: dueMap.get(date) ?? 0,
      completed: completedMap.get(date) ?? 0,
      isToday: date === dayjs().format('YYYY-MM-DD'),
    });
  }
  return cells;
});

const ReviewTaskCard = defineComponent({
  props: {
    task: { type: Object as () => ReviewTask, required: true },
    busy: { type: Boolean, default: false },
  },
  emits: ['complete', 'snooze'],
  setup(props, { emit }) {
    const expanded = ref(false);
    return () =>
      h('article', { class: ['review-task', 'card', { overdue: props.task.overdue }] }, [
        h('div', { class: 'task-head' }, [
          h(SubjectPill, { subjectId: props.task.subjectId, subject: props.task.subject }),
          h('span', { class: 'task-type' }, questionTypeLabel(props.task.questionType)),
          h(MasteryBadge, { value: props.task.mastery }),
          h(
            'span',
            { class: ['task-due', { overdue: props.task.overdue }] },
            formatRelative(props.task.nextReviewAt),
          ),
        ]),
        h('div', { class: 'task-stem' }, [h(RichText, { text: props.task.stem })]),
        props.task.knowledgePoints.length
          ? h(
              'div',
              { class: 'task-kps' },
              props.task.knowledgePoints.slice(0, 3).map((point) =>
                h('span', { key: point.id, class: 'task-kp' }, point.name),
              ),
            )
          : null,
        expanded.value
          ? h('div', { class: 'task-answer' }, [
              h('div', { class: 'answer-line' }, [
                h('b', {}, '答案：'),
                h(RichText, { text: props.task.correctAnswer || '暂无答案' }),
              ]),
              props.task.analysis
                ? h('div', { class: 'answer-line' }, [
                    h('b', {}, '解析：'),
                    h(RichText, { text: props.task.analysis }),
                  ])
                : null,
            ])
          : null,
        h('button', {
          type: 'button',
          class: 'toggle-answer',
          onClick: () => {
            expanded.value = !expanded.value;
          },
        }, expanded.value ? '收起答案' : '查看答案与解析'),
        h(
          'div',
          { class: 'rating-buttons' },
          REVIEW_RATINGS.map((rating) =>
            h(
              'button',
              {
                key: rating.value,
                type: 'button',
                class: 'rating-btn',
                style: { color: rating.color, background: `${rating.color}12` },
                disabled: props.busy,
                onClick: () => emit('complete', props.task, rating.value),
              },
              rating.label,
            ),
          ),
        ),
        h('div', { class: 'task-foot' }, [
          h('button', {
            type: 'button',
            class: 'snooze-btn',
            disabled: props.busy,
            onClick: () => emit('snooze', props.task),
          }, '明天再复习'),
          h('span', { class: 'muted tiny' }, `已复习 ${props.task.reviewCount} 次`),
        ]),
      ]);
  },
});

async function loadToday(): Promise<void> {
  if (!studentStore.currentStudentId) {
    today.value = null;
    loadingToday.value = false;
    return;
  }
  loadingToday.value = true;
  try {
    const { data } = await reviewApi.today(studentStore.currentStudentId);
    today.value = data;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    loadingToday.value = false;
  }
}

async function completeTask(task: ReviewTask, rating: ReviewRating): Promise<void> {
  busyId.value = task.id;
  try {
    await reviewApi.complete(task.id, rating);
    if (today.value) {
      today.value.overdue = today.value.overdue.filter((item) => item.id !== task.id);
      today.value.today = today.value.today.filter((item) => item.id !== task.id);
      today.value.completedToday += 1;
      today.value.totalDue = today.value.overdue.length + today.value.today.length;
    }
    showToast({ type: 'success', message: '复习完成，已安排下次复习' });
    calendarLoaded.value = false;
    historyLoaded.value = false;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    busyId.value = '';
  }
}

async function snoozeTask(task: ReviewTask): Promise<void> {
  busyId.value = task.id;
  try {
    await reviewApi.snooze(task.id, 1);
    if (today.value) {
      today.value.overdue = today.value.overdue.filter((item) => item.id !== task.id);
      today.value.today = today.value.today.filter((item) => item.id !== task.id);
      today.value.totalDue = today.value.overdue.length + today.value.today.length;
    }
    showToast('已推迟到明天');
    calendarLoaded.value = false;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    busyId.value = '';
  }
}

async function loadCalendar(): Promise<void> {
  if (!studentStore.currentStudentId) return;
  try {
    const { data } = await reviewApi.calendar(month.value, studentStore.currentStudentId);
    calendar.value = data;
    calendarLoaded.value = true;
  } catch (error) {
    showToast(errorMessage(error));
  }
}

async function loadHistory(reset: boolean): Promise<void> {
  if (!studentStore.currentStudentId) return;
  if (reset) {
    historyPage.value = 1;
    history.value = [];
  }
  historyLoading.value = true;
  try {
    const { data } = await reviewApi.history({
      studentId: studentStore.currentStudentId,
      page: historyPage.value,
      pageSize: 20,
    });
    history.value = reset ? data.items : [...history.value, ...data.items];
    historyTotal.value = data.total;
    historyPage.value += 1;
    historyLoaded.value = true;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    historyLoading.value = false;
  }
}

function onTabChange(index: number): void {
  if (index === 1 && !calendarLoaded.value) void loadCalendar();
  if (index === 2 && !historyLoaded.value) void loadHistory(true);
}

function changeMonth(delta: number): void {
  month.value = dayjs(`${month.value}-01`).add(delta, 'month').format('YYYY-MM');
  void loadCalendar();
}

function ratingLabel(value: ReviewRating): string {
  return REVIEW_RATINGS.find((rating) => rating.value === value)?.label ?? value;
}

function ratingStyle(value: ReviewRating): Record<string, string> {
  const color = REVIEW_RATINGS.find((rating) => rating.value === value)?.color ?? '#64748b';
  return { color, background: `${color}14` };
}

watch(
  () => studentStore.currentStudentId,
  () => {
    calendarLoaded.value = false;
    historyLoaded.value = false;
    void loadToday();
    if (activeTab.value === 1) void loadCalendar();
    if (activeTab.value === 2) void loadHistory(true);
  },
);

onMounted(loadToday);
</script>

<style scoped>
.review-page {
  padding-top: 0;
}

.review-page :deep(.van-tabs__nav) {
  background: transparent;
}

.review-page :deep(.van-tab) {
  font-size: 13px;
}

.tab-loading {
  padding-top: 16px;
}

.today-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  padding: 18px;
}

.summary-ring {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: conic-gradient(var(--brand) var(--progress), #eef2ff 0);
}

.ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: var(--surface);
}

.ring-inner strong {
  font-size: 23px;
  font-weight: 800;
  line-height: 1.1;
}

.ring-inner span {
  color: var(--muted);
  font-size: 9.5px;
}

.summary-copy {
  min-width: 0;
}

.summary-copy h2 {
  margin: 0 0 4px;
  font-size: 17px;
}

.summary-copy p {
  margin: 0;
  color: var(--text-2);
  font-size: 12px;
}

.summary-copy p b {
  color: var(--brand);
  font-size: 14px;
}

.summary-copy p b.overdue {
  color: var(--rose);
}

.summary-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.summary-tags span {
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 9.5px;
}

.list-title {
  margin-top: 18px;
}

.list-title h3 {
  margin: 0;
  font-size: 14px;
}

.overdue-badge {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--rose-soft);
  color: var(--rose);
  font-size: 10px;
  font-weight: 700;
}

.small {
  font-size: 11px;
}

.done-card {
  margin-top: 18px;
  padding: 18px;
}

.calendar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 2px 10px;
}

.calendar-head strong {
  font-size: 16px;
}

.month-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-2);
}

.calendar-card {
  padding: 16px 12px 12px;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: 9px;
  font-size: 12px;
}

.calendar-cell.empty {
  visibility: hidden;
}

.calendar-cell.today {
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 800;
}

.day-num {
  line-height: 1;
}

.day-dot {
  position: absolute;
  bottom: 5px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.day-dot.due {
  left: calc(50% - 5px);
  background: var(--amber);
}

.day-dot.completed {
  left: calc(50% + 2px);
  background: var(--teal);
}

.calendar-legend {
  display: flex;
  gap: 14px;
  justify-content: center;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
  color: var(--muted);
  font-size: 10px;
}

.calendar-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.legend-dot.due {
  background: var(--amber);
}

.legend-dot.completed {
  background: var(--teal);
}

.calendar-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 12px;
  padding: 14px 0;
}

.calendar-summary > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1px solid var(--line);
}

.calendar-summary > div:last-child {
  border-right: 0;
}

.calendar-summary strong {
  font-size: 22px;
  font-weight: 800;
}

.calendar-summary span {
  color: var(--muted);
  font-size: 10.5px;
}

.history-list {
  margin-top: 12px;
}

.history-card {
  padding: 13px 14px;
  margin-bottom: 9px;
}

.history-head {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.rating-pill {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 700;
}

.history-date {
  color: var(--muted);
  font-size: 10.5px;
}

.history-interval {
  margin-left: auto;
  color: var(--muted);
  font-size: 9.5px;
}

.history-stem {
  display: block;
  width: 100%;
  margin: 8px 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
}

.history-stem :deep(.rich-text) {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.history-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 10px;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 14px 0;
}

.review-task {
  padding: 14px;
  margin-bottom: 10px;
}

.review-task.overdue {
  box-shadow: 0 0 0 1px rgba(225, 29, 72, 0.18);
}

:deep(.review-task .task-head) {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

:deep(.review-task .task-type) {
  color: var(--muted);
  font-size: 10.5px;
}

:deep(.review-task .task-due) {
  margin-left: auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 9.5px;
}

:deep(.review-task .task-due.overdue) {
  background: var(--rose-soft);
  color: var(--rose);
}

:deep(.review-task .task-stem) {
  font-size: 14px;
  line-height: 1.65;
}

:deep(.review-task .task-stem .katex-display) {
  display: inline-block;
  margin: 0;
}

:deep(.review-task .task-kps) {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 8px;
}

:deep(.review-task .task-kp) {
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 9.5px;
}

:deep(.review-task .task-answer) {
  margin-top: 10px;
  padding: 10px;
  border-radius: 10px;
  background: var(--surface-soft);
  font-size: 12px;
  line-height: 1.6;
}

:deep(.review-task .answer-line) {
  margin-bottom: 4px;
}

:deep(.review-task .answer-line:last-child) {
  margin-bottom: 0;
}

:deep(.review-task .toggle-answer) {
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--brand);
  font-size: 10.5px;
  font-weight: 600;
}

:deep(.review-task .rating-buttons) {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 12px;
}

:deep(.review-task .rating-btn) {
  padding: 8px 2px;
  border: 0;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
}

:deep(.review-task .rating-btn:disabled) {
  opacity: 0.5;
}

:deep(.review-task .task-foot) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

:deep(.review-task .snooze-btn) {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 10.5px;
}

:deep(.review-task .tiny) {
  font-size: 9.5px;
}
</style>
