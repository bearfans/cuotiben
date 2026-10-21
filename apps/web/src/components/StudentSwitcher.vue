<template>
  <div>
    <button class="student-switch" type="button" @click="show = true">
      <span class="avatar">{{ initial }}</span>
      <span class="info">
        <strong>{{ student?.name ?? '添加孩子' }}</strong>
        <small v-if="student">{{ gradeLabel(student.grade) }} · {{ semesterLabel(student.semester) }}</small>
        <small v-else>先建立孩子档案</small>
      </span>
      <van-icon name="arrow-down" size="12" class="muted" />
    </button>

    <van-popup v-model:show="show" position="bottom" round :style="{ paddingBottom: '16px' }">
      <div class="sheet-head">
        <h3>切换孩子</h3>
        <button type="button" class="sheet-close" @click="show = false">
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
      </div>
      <div class="sheet-footer">
        <van-button block round plain type="primary" icon="plus" @click="goProfile">
          管理孩子档案
        </van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { gradeLabel, semesterLabel } from '@myos/shared';
import { useStudentStore } from '@/stores/student';

const studentStore = useStudentStore();
const router = useRouter();
const show = ref(false);

const student = computed(() => studentStore.currentStudent);
const students = computed(() => studentStore.students);
const currentStudentId = computed(() => studentStore.currentStudentId);
const initial = computed(() => student.value?.name.slice(0, 1) ?? '＋');

function choose(id: string): void {
  studentStore.selectStudent(id);
  show.value = false;
}

function goProfile(): void {
  show.value = false;
  void router.push('/profile');
}
</script>

<style scoped>
.student-switch {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  max-width: 100%;
  padding: 5px 10px 5px 5px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.13);
  color: inherit;
  text-align: left;
  backdrop-filter: blur(6px);
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

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 10px;
}

.sheet-head h3 {
  margin: 0;
  font-size: 18px;
}

.sheet-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-soft);
  color: var(--text-2);
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 16px;
}

.student-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  text-align: left;
}

.student-option.active {
  border-color: rgba(22, 163, 74, 0.4);
  background: var(--brand-soft);
}

.option-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  line-height: 1.3;
}

.option-main strong {
  font-size: 15px;
}

.option-main small {
  color: var(--muted);
  font-size: 12px;
}

.sheet-footer {
  padding: 10px 16px 0;
}
</style>
