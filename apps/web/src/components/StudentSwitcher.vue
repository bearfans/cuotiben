<template>
  <div class="student-switch-wrap" :class="{ 'is-card': variant === 'card' }">
    <!-- 点击区域：整卡 / 胶囊可点，展开就近的选择面板 -->
    <button
      class="student-switch"
      :class="{ 'student-switch--card': variant === 'card', 'is-open': open }"
      type="button"
      @click="toggle"
    >
      <template v-if="variant === 'card'">
        <span class="sc-body">
          <span class="avatar avatar--lg">{{ initial }}</span>
          <span class="info">
            <strong>{{ student?.name ?? '添加孩子' }}</strong>
            <small v-if="student">{{ gradeLabel(student.grade) }} · {{ semesterLabel(student.semester) }}</small>
            <small v-else>先建立孩子档案</small>
          </span>
        </span>
        <van-icon name="arrow-down" size="16" class="sc-arrow" :class="{ rotated: open }" />
      </template>
      <template v-else>
        <span class="avatar">{{ initial }}</span>
        <span class="info">
          <strong>{{ student?.name ?? '添加孩子' }}</strong>
          <small v-if="student">{{ gradeLabel(student.grade) }} · {{ semesterLabel(student.semester) }}</small>
          <small v-else>先建立孩子档案</small>
        </span>
        <van-icon name="arrow-down" size="12" class="muted" :class="{ rotated: open }" />
      </template>
    </button>

    <!-- 就近展开的选择面板，不再从底部弹出 -->
    <transition name="drop">
      <div v-if="open" class="switch-panel" :class="{ 'switch-panel--card': variant === 'card' }">
        <div class="panel-head">
          <span>选择孩子</span>
          <button type="button" class="panel-close" @click="open = false">
            <van-icon name="cross" />
          </button>
        </div>
        <div class="student-list">
          <button
            v-for="item in students"
            :key="item.id"
            type="button"
            class="student-option"
            :class="{ active: item.id === currentStudentId }"
            @click="choose(item.id)"
          >
            <span class="avatar">
              {{ item.name.slice(0, 1) }}
            </span>
            <span class="option-main">
              <strong>{{ item.name }}</strong>
              <small>{{ gradeLabel(item.grade) }} · {{ semesterLabel(item.semester) }}</small>
            </span>
            <van-icon v-if="item.id === currentStudentId" name="success" color="#16a34a" />
          </button>

          <button type="button" class="student-option add-option" @click="add">
            <span class="avatar add-avatar">＋</span>
            <span class="option-main">
              <strong>添加孩子</strong>
              <small>新建一份孩子档案</small>
            </span>
            <van-icon name="plus" color="#16a34a" />
          </button>
        </div>
      </div>
    </transition>

    <!-- 点击面板外的区域收起 -->
    <div v-if="open" class="switch-backdrop" @click="open = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { gradeLabel, semesterLabel } from '@myos/shared';
import { useStudentStore } from '@/stores/student';

const props = withDefaults(
  defineProps<{
    /** pill：首页 hero 上的玻璃胶囊；card：录入页信息卡（头像主导、整卡可点） */
    variant?: 'pill' | 'card';
  }>(),
  { variant: 'pill' },
);

const emit = defineEmits<{
  /** 点击「添加孩子」时触发，由父级决定跳转还是打开表单 */
  (e: 'add'): void;
}>();

const studentStore = useStudentStore();
const open = ref(false);

const student = computed(() => studentStore.currentStudent);
const students = computed(() => studentStore.students);
const currentStudentId = computed(() => studentStore.currentStudentId);
const initial = computed(() => student.value?.name.slice(0, 1) ?? '＋');

function toggle(): void {
  open.value = !open.value;
}

function choose(id: string): void {
  studentStore.selectStudent(id);
  open.value = false;
}

function add(): void {
  open.value = false;
  emit('add');
}
</script>

<style scoped>
.student-switch-wrap {
  position: relative;
  display: inline-flex;
}

.student-switch-wrap.is-card {
  display: block;
  width: 100%;
}

.student-switch {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  max-width: 100%;
  padding: 5px 10px 5px 5px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: inherit;
  text-align: left;
  -webkit-backdrop-filter: blur(10px) saturate(160%);
  backdrop-filter: blur(10px) saturate(160%);
  box-shadow: inset 0 1px 0.5px rgba(255, 255, 255, 0.45);
}

/* === card 变体：录入页 / 个人中心信息卡，头像主导、整卡可点 === */
.student-switch--card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: none;
  padding: 14px 16px;
  border: 1px solid rgba(15, 23, 42, 0.03);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform 0.15s ease;
}

.student-switch--card:active {
  transform: scale(0.992);
}

.sc-body {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.sc-arrow {
  flex: 0 0 auto;
  color: var(--muted);
  transition: transform 0.22s ease;
}

.sc-arrow.rotated,
.muted.rotated {
  transform: rotate(180deg);
}

.avatar--lg {
  width: 46px;
  height: 46px;
  font-size: 18px;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.7);
}

.student-switch--card .info strong {
  font-size: 16px;
}

.student-switch--card .info small {
  margin-top: 2px;
  color: var(--text-2);
  font-size: 12px;
  opacity: 1;
}

.avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--avatar-bg);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.28);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.info strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info small {
  margin-top: 1px;
  font-size: 10.5px;
  opacity: 0.72;
}

/* === 就近展开面板 === */
.switch-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 50;
  min-width: 240px;
  max-width: 320px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  overflow: hidden;
}

.switch-panel--card {
  left: 0;
  right: 0;
  max-width: none;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px 8px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
}

.panel-close {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-soft);
  color: var(--text-2);
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.student-option {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  text-align: left;
  transition: background 0.12s ease;
}

.student-option:active {
  background: var(--surface-soft);
}

.student-option.active {
  border-color: rgba(22, 163, 74, 0.4);
  background: var(--brand-soft);
}

.add-option .add-avatar {
  background: var(--brand-soft);
  color: var(--brand);
  box-shadow: none;
}

.option-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}

.option-main strong {
  font-size: 14px;
}

.option-main small {
  color: var(--muted);
  font-size: 11.5px;
}

/* 展开收起过渡 */
.drop-enter-active,
.drop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  transform-origin: top;
}

.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: scaleY(0.92) translateY(-4px);
}

.switch-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: transparent;
}
</style>
