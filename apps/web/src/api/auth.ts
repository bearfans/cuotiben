import type { AuthResponse, Student, User } from '@myos/shared';
import { api } from './client';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  displayName?: string;
  studentName?: string;
  grade?: number;
  semester?: 'FIRST' | 'SECOND';
  inviteCode?: string;
}

export const authApi = {
  login: (payload: LoginPayload) => api.post<AuthResponse>('/auth/login', payload),
  register: (payload: RegisterPayload) => api.post<AuthResponse>('/auth/register', payload),
  refresh: () => api.post<AuthResponse>('/auth/refresh'),
  me: () => api.get<User>('/auth/me'),
  logout: () => api.post<{ success: boolean }>('/auth/logout'),
};

export const studentsApi = {
  list: () => api.get<Student[]>('/students'),
  create: (payload: Partial<Student> & { name: string; grade: number }) =>
    api.post<Student>('/students', payload),
  update: (id: string, payload: Partial<Student>) =>
    api.patch<Student>(`/students/${id}`, payload),
  archive: (id: string) => api.delete<{ success: boolean }>(`/students/${id}`),
};
