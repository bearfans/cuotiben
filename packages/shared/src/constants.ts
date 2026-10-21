export type Stage = 'PRIMARY' | 'JUNIOR' | 'SENIOR';
export type Semester = 'FIRST' | 'SECOND';
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const STAGES: { value: Stage; label: string }[] = [
  { value: 'PRIMARY', label: '小学' },
  { value: 'JUNIOR', label: '初中' },
  { value: 'SENIOR', label: '高中' },
];

export const GRADES: { value: Grade; label: string; stage: Stage }[] = [
  { value: 1, label: '一年级', stage: 'PRIMARY' },
  { value: 2, label: '二年级', stage: 'PRIMARY' },
  { value: 3, label: '三年级', stage: 'PRIMARY' },
  { value: 4, label: '四年级', stage: 'PRIMARY' },
  { value: 5, label: '五年级', stage: 'PRIMARY' },
  { value: 6, label: '六年级', stage: 'PRIMARY' },
  { value: 7, label: '初一', stage: 'JUNIOR' },
  { value: 8, label: '初二', stage: 'JUNIOR' },
  { value: 9, label: '初三', stage: 'JUNIOR' },
  { value: 10, label: '高一', stage: 'SENIOR' },
  { value: 11, label: '高二', stage: 'SENIOR' },
  { value: 12, label: '高三', stage: 'SENIOR' },
];

export const SEMESTERS: { value: Semester; label: string }[] = [
  { value: 'FIRST', label: '上学期' },
  { value: 'SECOND', label: '下学期' },
];

export const QUESTION_TYPES = [
  { value: 'SINGLE_CHOICE', label: '单选题' },
  { value: 'MULTIPLE_CHOICE', label: '多选题' },
  { value: 'TRUE_FALSE', label: '判断题' },
  { value: 'FILL_BLANK', label: '填空题' },
  { value: 'SHORT_ANSWER', label: '解答题' },
  { value: 'OTHER', label: '其他' },
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number]['value'];

export const QUESTION_TYPE_ORDER: QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'SHORT_ANSWER',
  'OTHER',
];

export const PAPER_SECTIONS: Record<string, string> = {
  CHOICE: '一、选择题',
  TRUE_FALSE: '二、判断题',
  FILL_BLANK: '三、填空题',
  SHORT_ANSWER: '四、解答题',
  OTHER: '五、其他题目',
};

export interface SubjectSeed {
  id: string;
  name: string;
  shortName: string;
  stages: Stage[];
  color: string;
  sortOrder: number;
}

export const SUBJECTS: SubjectSeed[] = [
  { id: 'chinese', name: '语文', shortName: '语', stages: ['PRIMARY', 'JUNIOR', 'SENIOR'], color: '#e26d5c', sortOrder: 1 },
  { id: 'math', name: '数学', shortName: '数', stages: ['PRIMARY', 'JUNIOR', 'SENIOR'], color: '#4f6ef7', sortOrder: 2 },
  { id: 'english', name: '英语', shortName: '英', stages: ['PRIMARY', 'JUNIOR', 'SENIOR'], color: '#8b5cf6', sortOrder: 3 },
  { id: 'physics', name: '物理', shortName: '物', stages: ['JUNIOR', 'SENIOR'], color: '#0ea5e9', sortOrder: 4 },
  { id: 'chemistry', name: '化学', shortName: '化', stages: ['JUNIOR', 'SENIOR'], color: '#10b981', sortOrder: 5 },
  { id: 'biology', name: '生物', shortName: '生', stages: ['JUNIOR', 'SENIOR'], color: '#84cc16', sortOrder: 6 },
  { id: 'history', name: '历史', shortName: '史', stages: ['JUNIOR', 'SENIOR'], color: '#f59e0b', sortOrder: 7 },
  { id: 'geography', name: '地理', shortName: '地', stages: ['JUNIOR', 'SENIOR'], color: '#14b8a6', sortOrder: 8 },
  { id: 'morality', name: '道德与法治', shortName: '道', stages: ['PRIMARY', 'JUNIOR'], color: '#f43f5e', sortOrder: 9 },
  { id: 'politics', name: '思想政治', shortName: '政', stages: ['SENIOR'], color: '#fb7185', sortOrder: 10 },
  { id: 'science', name: '科学', shortName: '科', stages: ['PRIMARY'], color: '#06b6d4', sortOrder: 11 },
  { id: 'other', name: '综合', shortName: '综', stages: ['PRIMARY', 'JUNIOR', 'SENIOR'], color: '#64748b', sortOrder: 99 },
];

export const SUBJECT_MAP: Record<string, SubjectSeed> = Object.fromEntries(
  SUBJECTS.map((subject) => [subject.id, subject]),
);

export const MASTERY_LABELS = ['未掌握', '很薄弱', '薄弱', '一般', '较熟', '已掌握'];

export const MASTERY_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981'];

export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30, 60, 90];

export const REVIEW_RATINGS = [
  { value: 'AGAIN', label: '没掌握', description: '明天重新复习', color: '#ef4444' },
  { value: 'HARD', label: '有点模糊', description: '缩短复习间隔', color: '#f59e0b' },
  { value: 'GOOD', label: '掌握了', description: '按计划继续', color: '#3b82f6' },
  { value: 'EASY', label: '很熟练', description: '拉长复习间隔', color: '#10b981' },
] as const;

export type ReviewRating = (typeof REVIEW_RATINGS)[number]['value'];

export const AI_JOB_STATUS_LABELS: Record<string, string> = {
  PENDING: '排队中',
  PROCESSING: '识别中',
  SUCCEEDED: '识别完成',
  PARTIAL: '部分完成',
  FAILED: '识别失败',
};

export function gradeLabel(grade: number): string {
  return GRADES.find((item) => item.value === grade)?.label ?? `${grade}年级`;
}

export function gradeStage(grade: number): Stage {
  return GRADES.find((item) => item.value === grade)?.stage ?? 'PRIMARY';
}

export function semesterLabel(semester: string): string {
  return SEMESTERS.find((item) => item.value === semester)?.label ?? semester;
}

export function subjectName(id: string): string {
  return SUBJECT_MAP[id]?.name ?? id;
}

export function subjectColor(id: string): string {
  return SUBJECT_MAP[id]?.color ?? '#64748b';
}

export function questionTypeLabel(type: string): string {
  return QUESTION_TYPES.find((item) => item.value === type)?.label ?? '其他';
}

export function normalizeKnowledgePoint(name: string): string {
  return name
    .trim()
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[：:；;，,。.！!？?、]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function nextInterval(current: number): number {
  const found = REVIEW_INTERVALS.find((value) => value > current);
  return found ?? Math.min(180, Math.round(current * 1.5));
}

export function addDaysToInterval(rating: ReviewRating, currentInterval: number): number {
  switch (rating) {
    case 'AGAIN':
      return 1;
    case 'HARD':
      return Math.max(1, Math.round(currentInterval * 0.6));
    case 'EASY':
      return Math.min(180, Math.max(nextInterval(currentInterval), Math.round(currentInterval * 2.5)));
    case 'GOOD':
    default:
      return nextInterval(currentInterval);
  }
}
