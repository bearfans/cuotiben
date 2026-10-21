<template>
  <div class="login-page">
    <div class="hero">
      <div class="logo">
        <van-icon name="notes-o" size="30" />
      </div>
      <h1>错题本</h1>
      <p>把每一次错误，变成下一次进步</p>
      <div class="hero-tags">
        <span>AI 拍照识别</span>
        <span>知识点归纳</span>
        <span>薄弱点分析</span>
        <span>一键组卷</span>
      </div>
    </div>

    <div class="login-card card">
      <div class="mode-tabs">
        <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">
          登录
        </button>
        <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">
          注册
        </button>
      </div>

      <div class="form-body">
        <van-field
          v-model="form.username"
          label="账号"
          placeholder="请输入账号"
          autocomplete="username"
          left-icon="user-o"
          clearable
        />
        <van-field
          v-model="form.password"
          label="密码"
          type="password"
          placeholder="请输入密码"
          autocomplete="current-password"
          left-icon="lock"
          clearable
        />
        <template v-if="mode === 'register'">
          <van-field
            v-model="form.displayName"
            label="称呼"
            placeholder="例如：小明妈妈（选填）"
            left-icon="smile-o"
            clearable
          />
          <van-field
            v-model="form.studentName"
            label="孩子"
            placeholder="孩子昵称（选填）"
            left-icon="friends-o"
            clearable
          />
          <div class="select-field">
            <label>年级</label>
            <select v-model.number="form.grade">
              <option v-for="grade in GRADES" :key="grade.value" :value="grade.value">
                {{ grade.label }}
              </option>
            </select>
            <van-icon name="arrow-down" size="12" class="muted" />
          </div>
        </template>
      </div>

      <div class="submit-area">
        <van-button
          block
          round
          type="primary"
          size="large"
          :loading="submitting"
          loading-text="请稍候..."
          @click="submit"
        >
          {{ mode === 'login' ? '登录' : '创建账号' }}
        </van-button>
        <p class="agreement">登录即表示你同意妥善保管家庭学习数据</p>
      </div>

      <button v-if="mode === 'login'" type="button" class="demo-hint" @click="fillDemo">
        演示账号：demo / demo12345
        <span>一键填入</span>
      </button>
    </div>

    <p class="footer">专注错题整理 · 让学习更有方向</p>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { GRADES } from '@myos/shared';
import { useAuthStore } from '@/stores/auth';
import { errorMessage } from '@/api/client';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const mode = ref<'login' | 'register'>('login');
const submitting = ref(false);
const form = reactive({
  username: '',
  password: '',
  displayName: '',
  studentName: '',
  grade: 3,
});

function fillDemo(): void {
  form.username = 'demo';
  form.password = 'demo12345';
}

async function submit(): Promise<void> {
  if (!form.username.trim() || !form.password) {
    showToast('请填写账号和密码');
    return;
  }
  if (mode.value === 'register' && form.password.length < 8) {
    showToast('密码至少需要 8 位');
    return;
  }
  submitting.value = true;
  try {
    if (mode.value === 'login') {
      await auth.login({ username: form.username.trim(), password: form.password });
      showToast({ type: 'success', message: '欢迎回来' });
    } else {
      await auth.register({
        username: form.username.trim(),
        password: form.password,
        displayName: form.displayName.trim() || undefined,
        studentName: form.studentName.trim() || undefined,
        grade: form.studentName.trim() ? form.grade : undefined,
      });
      showToast({ type: 'success', message: '账号创建成功' });
    }
    const requested = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    const redirect = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/home';
    await router.replace(redirect);
  } catch (error) {
    showToast(errorMessage(error));
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 0 20px calc(24px + var(--safe-bottom));
  background:
    radial-gradient(circle at 88% 8%, rgba(34, 197, 94, 0.22), transparent 32%),
    radial-gradient(circle at 8% 28%, rgba(22, 163, 74, 0.14), transparent 30%),
    linear-gradient(165deg, #e8f7ee 0%, #f7fbf7 46%, #f3f8f3 100%);
}

.hero {
  padding: 56px 4px 26px;
  text-align: center;
}

.logo {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  margin: 0 auto 16px;
  border-radius: 22px;
  background: linear-gradient(140deg, #15803d, #16a34a 55%, #22c55e);
  color: #fff;
  box-shadow: 0 14px 32px rgba(22, 163, 74, 0.3);
}

.hero h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 3px;
}

.hero p {
  margin: 8px 0 0;
  color: var(--text-2);
  font-size: 13.5px;
  letter-spacing: 0.4px;
}

.hero-tags {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 16px;
}

.hero-tags span {
  padding: 4px 10px;
  border: 1px solid rgba(22, 163, 74, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: var(--brand);
  font-size: 10.5px;
  font-weight: 600;
}

.login-card {
  overflow: hidden;
  padding: 6px 4px 16px;
  border-radius: 24px;
  box-shadow: 0 18px 50px rgba(30, 41, 59, 0.1);
}

.mode-tabs {
  display: flex;
  gap: 4px;
  margin: 12px 16px 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--surface-soft);
}

.mode-tabs button {
  flex: 1;
  padding: 9px 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--muted);
  font-size: 13.5px;
  font-weight: 600;
  transition: all 0.18s ease;
}

.mode-tabs button.active {
  background: var(--surface);
  color: var(--brand);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.form-body {
  padding: 8px 8px 0;
}

.form-body :deep(.van-cell) {
  padding: 13px 12px;
}

.form-body :deep(.van-field__label) {
  width: 48px;
  color: var(--text-2);
  font-size: 13px;
}

.select-field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 12px;
  color: var(--text-2);
  font-size: 13px;
}

.select-field label {
  width: 48px;
  flex: 0 0 auto;
}

.select-field select {
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  outline: none;
}

.submit-area {
  padding: 14px 20px 0;
}

.agreement {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 10.5px;
  text-align: center;
}

.demo-hint {
  display: block;
  width: calc(100% - 40px);
  margin: 12px auto 0;
  padding: 9px;
  border: 1px dashed rgba(22, 163, 74, 0.25);
  border-radius: 10px;
  background: var(--brand-soft);
  color: var(--text-2);
  font-size: 11.5px;
}

.demo-hint span {
  margin-left: 6px;
  color: var(--brand);
  font-weight: 700;
}

.footer {
  margin: 26px 0 0;
  color: var(--muted);
  font-size: 10.5px;
  text-align: center;
  letter-spacing: 0.5px;
}
</style>
