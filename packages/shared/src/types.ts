import type { Grade, QuestionType, Semester, Stage } from './constants';

export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  grade: Grade;
  semester: Semester;
  avatarUrl?: string | null;
  isArchived?: boolean;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  shortName: string;
  stages: Stage[];
  color: string;
  sortOrder: number;
}

export interface KnowledgePoint {
  id: string;
  subjectId: string;
  name: string;
  aliases: string[];
  gradeMin?: number | null;
  gradeMax?: number | null;
  usageCount: number;
}

export interface QuestionOption {
  label: string;
  content: string;
}

export interface QuestionImage {
  id: string;
  kind: 'SOURCE' | 'FIGURE';
  url: string;
  thumbnailUrl?: string;
  width?: number | null;
  height?: number | null;
}

export interface WrongQuestion {
  id: string;
  studentId: string;
  subjectId: string;
  subject?: Subject;
  grade: Grade;
  semester: Semester;
  questionType: QuestionType;
  stem: string;
  options?: QuestionOption[] | null;
  correctAnswer?: string | null;
  studentAnswer?: string | null;
  analysis?: string | null;
  errorReason?: string | null;
  difficulty: number;
  mastery: number;
  status: 'ACTIVE' | 'ARCHIVED';
  source: 'AI' | 'MANUAL';
  note?: string | null;
  knowledgePoints: KnowledgePoint[];
  images: QuestionImage[];
  createdAt: string;
  updatedAt: string;
}

export interface AiQuestionResult {
  questionType: QuestionType;
  stem: string;
  options?: QuestionOption[];
  correctAnswer?: string;
  studentAnswer?: string;
  analysis?: string;
  knowledgePoints: string[];
  difficulty: number;
  errorReason?: string;
  isWrong: boolean;
  confidence: number;
}

export interface AiJobImage {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  result?: {
    subject?: string;
    questions: AiQuestionResult[];
    imageQuality?: string;
    unreadableCount?: number;
  } | null;
  error?: string | null;
  confidence?: number | null;
}

export interface AiJob {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
  studentId: string;
  grade: Grade;
  semester: Semester;
  subjectHint?: string | null;
  imageCount: number;
  model: string;
  error?: string | null;
  images: AiJobImage[];
  createdAt: string;
  finishedAt?: string | null;
}

export interface PaperItem {
  id: string;
  sortOrder: number;
  section: string;
  snapshot: PaperQuestionSnapshot;
}

export interface PaperQuestionSnapshot {
  questionId: string;
  subjectId: string;
  subjectName: string;
  grade: number;
  semester: Semester;
  questionType: QuestionType;
  stem: string;
  options?: QuestionOption[] | null;
  correctAnswer?: string | null;
  studentAnswer?: string | null;
  analysis?: string | null;
  knowledgePoints: string[];
  difficulty: number;
  images: { id: string; url?: string; kind: string }[];
}

export interface Paper {
  id: string;
  studentId: string;
  title: string;
  subjectId?: string | null;
  grade: Grade;
  questionCount: number;
  settings: PaperSettings;
  status: 'READY' | 'GENERATING' | 'FAILED';
  hasPdf: boolean;
  items?: PaperItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PaperSettings {
  includeAnswers: boolean;
  includeKnowledgePoints: boolean;
  includeStudentAnswer: boolean;
  showScore: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OverviewStats {
  totalQuestions: number;
  activeQuestions: number;
  masteredQuestions: number;
  addedThisWeek: number;
  addedLast7Days: number;
  subjectDistribution: { subjectId: string; name: string; color: string; count: number }[];
  masteryDistribution: { mastery: number; count: number }[];
  trend: { date: string; count: number }[];
}

export interface KnowledgeStat {
  knowledgePointId: string;
  name: string;
  subjectId: string;
  count: number;
  avgMastery: number;
  lastWrongAt: string | null;
  weakScore: number;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface UploadedFile {
  id: string;
  width: number;
  height: number;
  mimeType: string;
  size: number;
}

export interface PaperCandidate {
  id: string;
  stem: string;
  subjectId: string;
  questionType: QuestionType;
  mastery: number;
  difficulty: number;
  createdAt: string;
  knowledgePoints: { id: string; name: string }[];
}
