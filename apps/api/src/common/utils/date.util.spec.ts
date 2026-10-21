import {
  MASTERY_LABELS,
  normalizeKnowledgePoint,
  normalizeQuestionType,
} from '@myos/shared';
import { daysAgoStart, formatDate, lastNDates } from './date.util';

describe('shared question helpers', () => {
  it('normalizes question types from common aliases', () => {
    expect(normalizeQuestionType('single_choice')).toBe('SINGLE_CHOICE');
    expect(normalizeQuestionType('选择题')).toBe('SINGLE_CHOICE');
    expect(normalizeQuestionType('填空题')).toBe('FILL_BLANK');
    expect(normalizeQuestionType('short_answer')).toBe('SHORT_ANSWER');
    expect(normalizeQuestionType('')).toBe('OTHER');
    expect(normalizeQuestionType(null)).toBe('OTHER');
  });

  it('normalizes knowledge point names', () => {
    expect(normalizeKnowledgePoint('  分数与小数  ')).toBe('分数与小数');
    expect(normalizeKnowledgePoint('一元二次方程（配方法）。')).toBe('一元二次方程(配方法)');
    expect(normalizeKnowledgePoint('  Be 动词  ')).toBe('be 动词');
  });

  it('keeps six mastery labels', () => {
    expect(MASTERY_LABELS).toHaveLength(6);
    expect(MASTERY_LABELS[0]).toBe('未掌握');
    expect(MASTERY_LABELS[5]).toBe('已掌握');
  });
});

describe('date utilities', () => {
  it('returns the last N dates ending today', () => {
    const dates = lastNDates(3);
    expect(dates).toHaveLength(3);
    expect(dates[2]).toBe(formatDate(new Date()));
    expect(dates[0] < dates[1]).toBe(true);
    expect(dates[1] < dates[2]).toBe(true);
  });

  it('returns the start of a past day', () => {
    const today = daysAgoStart(0);
    const yesterday = daysAgoStart(1);
    expect(yesterday.getTime()).toBeLessThan(today.getTime());
    expect(today.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
