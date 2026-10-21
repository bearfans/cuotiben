import type {
  Grade,
  QuestionOption,
  QuestionType,
  Semester,
  WrongQuestion,
} from '@myos/shared';
import type { QuestionPayload } from '@/api';

export interface QuestionDraft {
  subjectId: string;
  grade: number;
  semester: Semester;
  questionType: QuestionType;
  stem: string;
  options: QuestionOption[];
  correctAnswer: string;
  studentAnswer: string;
  analysis: string;
  errorReason: string;
  note: string;
  difficulty: number;
  mastery: number;
  knowledgePoints: string[];
}

export function emptyDraft(
  subjectId: string,
  grade: number,
  semester: Semester = 'FIRST',
): QuestionDraft {
  return {
    subjectId,
    grade,
    semester,
    questionType: 'SINGLE_CHOICE',
    stem: '',
    options: [
      { label: 'A', content: '' },
      { label: 'B', content: '' },
      { label: 'C', content: '' },
      { label: 'D', content: '' },
    ],
    correctAnswer: '',
    studentAnswer: '',
    analysis: '',
    errorReason: '',
    note: '',
    difficulty: 3,
    mastery: 0,
    knowledgePoints: [],
  };
}

export function draftFromQuestion(question: WrongQuestion): QuestionDraft {
  return {
    subjectId: question.subjectId,
    grade: question.grade,
    semester: question.semester,
    questionType: question.questionType,
    stem: question.stem,
    options: (question.options ?? []).map((option) => ({ ...option })),
    correctAnswer: question.correctAnswer ?? '',
    studentAnswer: question.studentAnswer ?? '',
    analysis: question.analysis ?? '',
    errorReason: question.errorReason ?? '',
    note: question.note ?? '',
    difficulty: question.difficulty,
    mastery: question.mastery,
    knowledgePoints: question.knowledgePoints.map((point) => point.name),
  };
}

export function draftToPayload(
  draft: QuestionDraft,
  extra: Partial<QuestionPayload> = {},
): QuestionPayload {
  const needsOptions =
    draft.questionType === 'SINGLE_CHOICE' || draft.questionType === 'MULTIPLE_CHOICE';
  const options = needsOptions
    ? draft.options
        .map((option) => ({ label: option.label.trim(), content: option.content.trim() }))
        .filter((option) => option.label && option.content)
    : undefined;
  return {
    subjectId: draft.subjectId,
    grade: draft.grade,
    semester: draft.semester,
    questionType: draft.questionType,
    stem: draft.stem.trim(),
    options: options ?? [],
    correctAnswer: draft.correctAnswer.trim(),
    studentAnswer: draft.studentAnswer.trim(),
    analysis: draft.analysis.trim(),
    errorReason: draft.errorReason.trim(),
    note: draft.note.trim(),
    difficulty: draft.difficulty,
    mastery: draft.mastery,
    knowledgePoints: draft.knowledgePoints,
    ...extra,
  };
}

export function isValidDraft(draft: QuestionDraft): boolean {
  if (!draft.subjectId || !draft.stem.trim()) return false;
  if (draft.questionType === 'SINGLE_CHOICE' || draft.questionType === 'MULTIPLE_CHOICE') {
    return draft.options.some((option) => option.content.trim());
  }
  return true;
}

export function defaultSubjectId(subjects: { id: string }[]): string {
  return subjects[0]?.id ?? 'math';
}

export const GRADE_OPTIONS: { text: string; value: Grade }[] = [
  { text: '一年级', value: 1 },
  { text: '二年级', value: 2 },
  { text: '三年级', value: 3 },
  { text: '四年级', value: 4 },
  { text: '五年级', value: 5 },
  { text: '六年级', value: 6 },
  { text: '初一', value: 7 },
  { text: '初二', value: 8 },
  { text: '初三', value: 9 },
  { text: '高一', value: 10 },
  { text: '高二', value: 11 },
  { text: '高三', value: 12 },
];
