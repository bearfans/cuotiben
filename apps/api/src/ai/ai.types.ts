import type { AiRecognitionPayload } from '@myos/shared';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiRecognitionInput {
  image: Buffer;
  mimeType: string;
  grade: number;
  semester: string;
  subjectHint?: string | null;
  isStitched?: boolean;
}

export interface AiRecognitionOutput {
  payload: AiRecognitionPayload;
  raw: unknown;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export interface AiProvider {
  recognize(input: AiRecognitionInput): Promise<AiRecognitionOutput>;
}
