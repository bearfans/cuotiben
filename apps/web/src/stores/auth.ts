import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Student, User } from '@myos/shared';
import { authApi, studentsApi, type LoginPayload, type RegisterPayload } from '@/api/auth';
import { setAccessToken } from '@/api/client';
import { usePaperSelectionStore } from './paperSelection';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const initialized = ref(false);
  const students = ref<Student[]>([]);
  const loadingStudents = ref(false);

  const isLoggedIn = computed(() => Boolean(token.value && user.value));

  function applySession(nextToken: string, nextUser: User): void {
    token.value = nextToken;
    user.value = nextUser;
    setAccessToken(nextToken);
  }

  function clearSession(): void {
    token.value = null;
    user.value = null;
    students.value = [];
    setAccessToken(null);
    usePaperSelectionStore().clear();
  }

  async function bootstrap(): Promise<void> {
    if (initialized.value) return;
    try {
      const { data } = await authApi.refresh();
      applySession(data.accessToken, data.user);
      await loadStudents();
    } catch {
      clearSession();
    } finally {
      initialized.value = true;
    }
  }

  async function login(payload: LoginPayload): Promise<void> {
    const { data } = await authApi.login(payload);
    applySession(data.accessToken, data.user);
    await loadStudents();
  }

  async function register(payload: RegisterPayload): Promise<void> {
    const { data } = await authApi.register(payload);
    applySession(data.accessToken, data.user);
    await loadStudents();
  }

  async function loadStudents(): Promise<void> {
    loadingStudents.value = true;
    try {
      const { data } = await studentsApi.list();
      students.value = data;
    } finally {
      loadingStudents.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // Local session still needs to be cleared.
    }
    clearSession();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('auth:expired', () => {
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    });
  }

  return {
    user,
    token,
    initialized,
    students,
    loadingStudents,
    isLoggedIn,
    bootstrap,
    login,
    register,
    loadStudents,
    logout,
    clearSession,
  };
});
