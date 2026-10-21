import { z } from 'zod';
import { QUESTION_TYPES, type QuestionType } from './constants';

const questionTypeValues = QUESTION_TYPES.map((item) => item.value) as [QuestionType, ...QuestionType[]];

export const aiOptionSchema = z.object({
  label: z.string().default(''),
  content: z.string().default(''),
});

export const aiQuestionSchema = z.object({
  questionType: z.string().default('OTHER'),
  stem: z.string().min(1),
  options: z.array(aiOptionSchema).optional().default([]),
  correctAnswer: z.string().optional().nullable(),
  studentAnswer: z.string().optional().nullable(),
  analysis: z.string().optional().nullable(),
  knowledgePoints: z.array(z.string()).optional().default([]),
  difficulty: z.coerce.number().min(1).max(5).optional().default(3),
  errorReason: z.string().optional().nullable(),
  isWrong: z.boolean().optional().default(true),
  confidence: z.coerce.number().min(0).max(1).optional().default(0.8),
});

export const aiRecognitionSchema = z.object({
  subject: z.string().optional().nullable(),
  questions: z.array(aiQuestionSchema).min(1),
  imageQuality: z.enum(['GOOD', 'BLURRY', 'PARTIAL']).optional().default('GOOD'),
});

export type AiRecognitionPayload = z.infer<typeof aiRecognitionSchema>;
export type AiQuestionPayload = z.infer<typeof aiQuestionSchema>;

const typeAliases: Record<string, QuestionType> = {
  single_choice: 'SINGLE_CHOICE',
  singlechoice: 'SINGLE_CHOICE',
  单选题: 'SINGLE_CHOICE',
  选择题: 'SINGLE_CHOICE',
  multiple_choice: 'MULTIPLE_CHOICE',
  multiplechoice: 'MULTIPLE_CHOICE',
  多选题: 'MULTIPLE_CHOICE',
  true_false: 'TRUE_FALSE',
  truefalse: 'TRUE_FALSE',
  判断题: 'TRUE_FALSE',
  fill_blank: 'FILL_BLANK',
  fillblank: 'FILL_BLANK',
  填空题: 'FILL_BLANK',
  short_answer: 'SHORT_ANSWER',
  shortanswer: 'SHORT_ANSWER',
  解答题: 'SHORT_ANSWER',
  主观题: 'SHORT_ANSWER',
  计算题: 'SHORT_ANSWER',
  other: 'OTHER',
  其他: 'OTHER',
};

export function normalizeQuestionType(value: string | null | undefined): QuestionType {
  if (!value) return 'OTHER';
  const normalized = value.trim();
  const upper = normalized.toUpperCase();
  if (questionTypeValues.includes(upper as QuestionType)) return upper as QuestionType;
  return typeAliases[normalized.toLowerCase()] ?? typeAliases[normalized] ?? 'OTHER';
}

export function normalizeAiPayload(payload: AiRecognitionPayload): AiRecognitionPayload {
  return {
    ...payload,
    questions: payload.questions.map((question) => ({
      ...question,
      questionType: normalizeQuestionType(question.questionType),
      knowledgePoints: question.knowledgePoints
        .map((point) => point.trim())
        .filter(Boolean)
        .slice(0, 6),
    })),
  };
}
