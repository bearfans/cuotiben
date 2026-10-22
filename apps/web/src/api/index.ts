import type {
  AiJob,
  KnowledgePoint,
  KnowledgeStat,
  OverviewStats,
  Paginated,
  Paper,
  PaperCandidate,
  PaperSettings,
  QuestionOption,
  Subject,
  UploadedFile,
  WrongQuestion,
} from '@myos/shared';
import { api } from './client';

export const subjectsApi = {
  list: (grade?: number) =>
    api.get<Subject[]>('/subjects', { params: grade ? { grade } : {} }),
};

export interface QuestionQuery {
  studentId?: string;
  subjectId?: string;
  questionType?: string;
  knowledgePointId?: string;
  masteryMin?: number;
  masteryMax?: number;
  keyword?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QuestionPayload {
  studentId?: string;
  subjectId: string;
  grade?: number;
  semester?: string;
  questionType: string;
  stem: string;
  options?: QuestionOption[] | null;
  correctAnswer?: string;
  studentAnswer?: string;
  analysis?: string;
  errorReason?: string;
  note?: string;
  difficulty?: number;
  mastery?: number;
  knowledgePoints?: string[];
  sourceImageIds?: string[];
  figureImageIds?: string[];
  source?: 'AI' | 'MANUAL';
  sourceJobId?: string;
}

export const questionsApi = {
  list: (query: QuestionQuery) =>
    api.get<Paginated<WrongQuestion>>('/wrong-questions', { params: query }),
  get: (id: string) => api.get<WrongQuestion>(`/wrong-questions/${id}`),
  create: (payload: QuestionPayload & { studentId: string }) =>
    api.post<WrongQuestion>('/wrong-questions', payload),
  batchCreate: (payload: {
    studentId: string;
    sourceJobId?: string;
    questions: QuestionPayload[];
  }) => api.post<{ created: number; ids: string[] }>('/wrong-questions/batch', payload),
  update: (id: string, payload: Partial<QuestionPayload>) =>
    api.patch<WrongQuestion>(`/wrong-questions/${id}`, payload),
  remove: (id: string) => api.delete<{ success: boolean }>(`/wrong-questions/${id}`),
  batchAction: (ids: string[], action: 'archive' | 'activate' | 'delete') =>
    api.post<{ updated: number }>('/wrong-questions/batch-action', { ids, action }),
};

export const uploadsApi = {
  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return api.post<UploadedFile[]>('/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    });
  },
};

export const aiApi = {
  createJob: (payload: { studentId?: string; uploadIds: string[]; subjectHint?: string }) =>
    api.post<AiJob>('/ai/jobs', payload),
  getJob: (id: string) => api.get<AiJob>(`/ai/jobs/${id}`),
  retry: (id: string) => api.post<AiJob>(`/ai/jobs/${id}/retry`),
  quota: () => api.get<{ used: number; limit: number; remaining: number }>('/ai/quota'),
};

export const statsApi = {
  overview: (studentId?: string, days = 30) =>
    api.get<OverviewStats>('/stats/overview', {
      params: { ...(studentId ? { studentId } : {}), days },
    }),
  knowledge: (params: { studentId?: string; subjectId?: string; limit?: number }) =>
    api.get<KnowledgeStat[]>('/stats/knowledge', { params }),
};

export const knowledgeApi = {
  list: (params: { subjectId?: string; q?: string; grade?: number; limit?: number }) =>
    api.get<KnowledgePoint[]>('/knowledge-points', { params }),
  create: (payload: {
    subjectId: string;
    name: string;
    aliases?: string[];
    gradeMin?: number;
    gradeMax?: number;
  }) => api.post<KnowledgePoint>('/knowledge-points', payload),
  update: (id: string, payload: { name?: string; aliases?: string[] }) =>
    api.patch<KnowledgePoint>(`/knowledge-points/${id}`, payload),
  merge: (id: string, targetId: string) =>
    api.post<KnowledgePoint>(`/knowledge-points/${id}/merge`, { targetId }),
  remove: (id: string) => api.delete<{ success: boolean }>(`/knowledge-points/${id}`),
};

export interface PaperCandidateQuery {
  studentId?: string;
  subjectId?: string;
  knowledgePointIds?: string[];
  questionTypes?: string[];
  masteryMax?: number;
  keyword?: string;
  count?: number;
  random?: boolean;
  questionIds?: string[];
}

export const papersApi = {
  list: (studentId?: string) =>
    api.get<Paper[]>('/papers', { params: studentId ? { studentId } : {} }),
  candidates: (payload: PaperCandidateQuery) =>
    api.post<{ items: PaperCandidate[]; total: number }>('/papers/candidates', payload),
  create: (payload: {
    studentId: string;
    title?: string;
    subjectId?: string;
    questionIds: string[];
    settings: PaperSettings;
  }) => api.post<Paper>('/papers', payload),
  get: (id: string) => api.get<Paper>(`/papers/${id}`),
  update: (id: string, payload: { title?: string; settings?: Partial<PaperSettings> }) =>
    api.patch<Paper>(`/papers/${id}`, payload),
  updateMastery: (id: string, mastery: number) =>
    api.patch<{ updated: number }>(`/papers/${id}/mastery`, { mastery }),
  remove: (id: string) => api.delete<{ success: boolean }>(`/papers/${id}`),
  printToken: (id: string) =>
    api.get<{ token: string; expiresAt: string; url: string; pdfUrl: string }>(
      `/papers/${id}/print-token`,
    ),
};
