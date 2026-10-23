import { aiRecognitionSchema, normalizeAiPayload } from '@myos/shared';

describe('AI recognition payload', () => {
  it('allows an empty question list when no wrong questions are found', () => {
    const parsed = aiRecognitionSchema.parse({
      subject: '数学',
      imageQuality: 'GOOD',
      unreadableCount: 3,
      questions: [],
    });

    expect(parsed.questions).toEqual([]);
    expect(parsed.unreadableCount).toBe(3);
  });

  it('keeps only wrong questions and preserves the unreadable count', () => {
    const parsed = aiRecognitionSchema.parse({
      subject: '数学',
      imageQuality: 'BLURRY',
      unreadableCount: 2,
      questions: [
        { stem: '错题', isWrong: true },
        { stem: '正确题', isWrong: false },
      ],
    });

    const normalized = normalizeAiPayload(parsed);

    expect(normalized.questions).toHaveLength(1);
    expect(normalized.questions[0]?.stem).toBe('错题');
    expect(normalized.unreadableCount).toBe(2);
  });
});
