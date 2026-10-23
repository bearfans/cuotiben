<template>
  <div>
    <div class="page profile-page">
      <div class="user-card card">
        <UserAvatar :name="auth.user?.displayName || auth.user?.username" size="lg" />
        <div class="user-main">
          <h2>{{ auth.user?.displayName || '家长' }}</h2>
          <p>@{{ auth.user?.username }}</p>
        </div>
        <span class="user-badge">家庭账号</span>
      </div>

      <section class="section">
        <StudentSwitcher variant="card" @add="openAdd" />
      </section>

      <section v-if="quota" class="section">
        <div class="quota-card card">
          <div class="quota-head">
            <span class="quota-icon"><van-icon name="scan" /></span>
            <div>
              <strong>AI 识别额度</strong>
              <p>今日已使用 {{ quota.used }} / {{ quota.limit }} 次</p>
            </div>
            <span class="quota-remaining">{{ quota.remaining }}<small>剩余</small></span>
          </div>
          <div class="quota-bar">
            <span :style="{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }" />
          </div>
          <p class="quota-tip">额度每天 0 点重置，单次任务最多识别 9 张</p>
        </div>
      </section>

      <section class="section">
        <div class="menu-card card">
          <button type="button" class="menu-row" @click="router.push('/knowledge')">
            <van-icon class="menu-icon" name="label-o" />
            <span class="menu-main">
              <strong>知识点库</strong>
              <small>查看、合并和整理学科标签</small>
            </span>
            <van-icon name="arrow" color="var(--muted)" />
          </button>
          <button type="button" class="menu-row" @click="router.push('/papers')">
            <van-icon class="menu-icon" name="description-o" />
            <span class="menu-main">
              <strong>我的试卷</strong>
              <small>打印或下载历史组卷</small>
            </span>
            <van-icon name="arrow" color="var(--muted)" />
          </button>
          <button type="button" class="menu-row" @click="router.push('/questions')">
            <van-icon class="menu-icon" name="notes-o" />
            <span class="menu-main">
              <strong>全部错题</strong>
              <small>按学科和掌握度查找错题</small>
            </span>
            <van-icon name="arrow" color="var(--muted)" />
          </button>
          <button type="button" class="menu-row" @click="showAbout = true">
            <van-icon class="menu-icon" name="info-o" />
            <span class="menu-main">
              <strong>关于错题本</strong>
              <small>版本 1.0 · 家庭 AI 学习助手</small>
            </span>
            <van-icon name="arrow" color="var(--muted)" />
          </button>
          <button type="button" class="menu-row" @click="logout">
            <van-icon class="menu-icon danger" name="revoke" />
            <span class="menu-main">
              <strong class="danger-text">退出登录</strong>
            </span>
            <van-icon name="arrow" color="var(--muted)" />
          </button>
        </div>
      </section>

      <p class="app-footer">用 AI 整理错题，让每次练习都有重点</p>
    </div>

    <van-popup v-model:show="showStudentPopup" position="bottom" round>
      <div class="student-sheet">
        <h3>{{ editingStudent ? '编辑孩子档案' : '添加孩子档案' }}</h3>
        <van-field
          v-model="studentForm.name"
          label="昵称"
          placeholder="例如：小明"
          maxlength="30"
        />
        <div class="form-row">
          <label>年级</label>
          <select v-model.number="studentForm.grade">
            <option v-for="grade in GRADES" :key="grade.value" :value="grade.value">
              {{ grade.label }}
            </option>
          </select>
        </div>
        <div class="form-row">
          <label>学期</label>
          <div class="semester-chips">
            <button
              v-for="semester in SEMESTERS"
              :key="semester.value"
              type="button"
              :class="{ active: studentForm.semester === semester.value }"
              @click="studentForm.semester = semester.value"
            >
              {{ semester.label }}
            </button>
          </div>
        </div>
        <van-button block round type="primary" :loading="saving" @click="saveStudent">
          保存
        </van-button>
      </div>
    </van-popup>

    <van-popup v-model:show="showAbout" position="bottom" round>
      <div class="about-sheet">
        <div class="about-logo"><van-icon name="notes-o" size="28" /></div>
        <h3>错题本</h3>
        <p class="about-version">版本 1.0.0</p>
        <p class="about-desc">
          一款面向家庭的 AI 错题本：拍照识别题目、自动归纳知识点，
          并把错题生成可打印的试卷。
        </p>
        <div class="about-features">
          <span>拍照识别</span>
          <span>知识点归纳</span>
          <span>薄弱点分析</span>
          <span>A4 组卷</span>
        </div>
        <van-button block round @click="showAbout = false">知道了</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import {
  GRADES,
  SEMESTERS,
  type Grade,
  type Semester,
  type Student,
} from '@myos/shared';
import { aiApi } from '@/api';
import { studentsApi } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useStudentStore } from '@/stores/student';
import StudentSwitcher from '@/components/StudentSwitcher.vue';
import UserAvatar from '@/components/UserAvatar.vue';

const router = useRouter();
const auth = useAuthStore();
const studentStore = useStudentStore();

const quota = ref<{ used: number; limit: number; remaining: number } | null>(null);
const showStudentPopup = ref(false);
const showAbout = ref(false);
const editingStudent = ref<Student | null>(null);
const saving = ref(false);
const studentForm = reactive<{ name: string; grade: Grade; semester: Semester }>({
  name: '',
  grade: 3,
  semester: 'FIRST',
});

async function loadQuota(): Promise<void> {
  try {
    const { data } = await aiApi.quota();
    quota.value = data;
  } catch {
    // Optional card.
  }
}

function openAdd(): void {
  editingStudent.value = null;
  studentForm.name = '';
  studentForm.grade = studentStore.currentStudent?.grade ?? 3;
  studentForm.semester = (studentStore.currentStudent?.semester ?? 'FIRST') as Semester;
  showStudentPopup.value = true;
}

async function saveStudent(): Promise<void> {
  if (!studentForm.name.trim()) {
    showToast('请输入孩子昵称');
    return;
  }
  saving.value = true;
  try {
    if (editingStudent.value) {
      await studentsApi.update(editingStudent.value.id, {
        name: studentForm.name.trim(),
        grade: studentForm.grade,
        semester: studentForm.semester,
      });
      showToast('档案已更新');
    } else {
      const { data } = await studentsApi.create({
        name: studentForm.name.trim(),
        grade: studentForm.grade,
        semester: studentForm.semester,
      });
      studentStore.selectStudent(data.id);
      showToast('孩子档案已添加');
    }
    await auth.loadStudents();
    showStudentPopup.value = false;
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function logout(): Promise<void> {
  try {
    await showConfirmDialog({
      title: '退出登录',
      message: '确认退出当前账号吗？',
      confirmButtonText: '退出',
      confirmButtonColor: 'var(--danger)',
    });
    await auth.logout();
    await router.replace('/login');
  } catch (error) {
    if (error !== 'cancel') showToast(errorMessage(error));
  }
}

onMounted(loadQuota);
</script>

<style scoped>
.profile-page {
  padding-top: calc(14px + var(--safe-top));
}

.user-card {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 18px;
  background:
    radial-gradient(circle at 90% 0%, rgba(var(--accent-rgb), 0.09), transparent 40%),
    var(--surface);
}

.user-main {
  flex: 1;
  min-width: 0;
}

.user-main h2 {
  margin: 0;
  font-size: 19px;
}

.user-main p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.user-badge {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 9.5px;
  font-weight: 600;
}

.add-student {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 5px 10px;
  border: 1px dashed #bbf7d0;
  border-radius: 999px;
  background: transparent;
  color: var(--brand);
  font-size: 11px;
  font-weight: 600;
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.student-card {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px;
}

.student-card.active {
  box-shadow: 0 0 0 1.5px rgba(var(--accent-rgb), 0.35);
}

.student-main {
  flex: 1;
  min-width: 0;
}

.student-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.student-name strong {
  font-size: 14.5px;
}

.current-tag {
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 8.5px;
  font-weight: 600;
}

.student-main p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.student-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.student-actions button {
  padding: 4px 7px;
  border: 0;
  border-radius: 6px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 9.5px;
  font-weight: 600;
}

.student-actions .muted-btn {
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 12px;
}

.add-student-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 24px;
  border: 1.5px dashed #bbf7d0;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.5);
  color: var(--brand);
}

.add-student-card span {
  font-size: 13px;
  font-weight: 600;
}

.add-student-card small {
  color: var(--muted);
  font-size: 10px;
}

.quota-card {
  padding: 15px 16px;
}

.quota-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.quota-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 17px;
}

.quota-head > div {
  flex: 1;
}

.quota-head strong {
  font-size: 13px;
}

.quota-head p {
  margin: 1px 0 0;
  color: var(--muted);
  font-size: 10px;
}

.quota-remaining {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  color: var(--brand);
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
}

.quota-remaining small {
  color: var(--muted);
  font-size: 8.5px;
  font-weight: 400;
}

.quota-bar {
  height: 6px;
  margin-top: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-soft);
}

.quota-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--brand-light), var(--brand));
}

.quota-tip {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 9px;
}

.menu-card {
  overflow: hidden;
  padding: 0 14px;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 13px 0;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  text-align: left;
}

.menu-row:last-child {
  border-bottom: 0;
}

.menu-icon {
  width: 24px;
  flex: 0 0 auto;
  color: var(--brand);
  font-size: 20px;
  text-align: center;
}

.menu-icon.danger {
  color: var(--rose);
}

.danger-text {
  color: var(--rose);
}

.menu-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}

.menu-main strong {
  font-size: 13.5px;
}

.menu-main small {
  color: var(--muted);
  font-size: 10px;
}

.app-footer {
  margin: 18px 0 0;
  color: var(--muted);
  font-size: 9.5px;
  text-align: center;
  letter-spacing: 0.4px;
}

.student-sheet {
  padding: 20px 18px calc(18px + var(--safe-bottom));
}

.student-sheet h3 {
  margin: 0 0 14px;
  font-size: 18px;
}

.student-sheet :deep(.van-field) {
  margin-bottom: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
}

.form-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
}

.form-row > label {
  width: 44px;
  flex: 0 0 auto;
  color: var(--text-2);
  font-size: 12px;
}

.form-row select {
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  outline: none;
}

.semester-chips {
  display: flex;
  gap: 6px;
}

.semester-chips button {
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 11px;
}

.semester-chips button.active {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}

.about-sheet {
  padding: 26px 24px calc(22px + var(--safe-bottom));
  text-align: center;
}

.about-logo {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  margin: 0 auto 10px;
  border-radius: 18px;
  background: var(--avatar-bg);
  color: #fff;
}

.about-sheet h3 {
  margin: 0;
  font-size: 20px;
}

.about-version {
  margin: 3px 0 12px;
  color: var(--muted);
  font-size: 10.5px;
}

.about-desc {
  margin: 0 auto 16px;
  max-width: 300px;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.7;
}

.about-features {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 20px;
}

.about-features span {
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 9.5px;
  font-weight: 500;
}
</style>
