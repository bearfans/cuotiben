import {
  addDaysToInterval,
  MASTERY_LABELS,
  nextInterval,
  normalizeKnowledgePoint,
  normalizeQuestionType,
} from '@myos/shared';
import {
  daysAgoStart,
  formatDate,
  lastNDates,
  monthRange,
  nextReviewDate,
} from '../common/utils/date.util';

describe('review scheduling', () => {
  it('moves through the configured intervals', () => {
    expect(nextInterval(1)).toBe(2);
    expect(nextInterval(2)).toBe(4);
    expect(nextInterval(30)).toBe(60);
    expect(nextInterval(90)).toBe(135);
    expect(nextInterval(180)).toBe(180);
  });

  it('adjusts the interval based on self rating', () => {
    expect(addDaysToInterval('AGAIN', 30)).toBe(1);
    expect(addDaysToInterval('HARD', 10)).toBe(6);
    expect(addDaysToInterval('GOOD', 10)).toBe(15);
    expect(addDaysToInterval('EASY', 10)).toBe(25);
    expect(addDaysToInterval('EASY', 80)).toBe(180);
  });

  it('schedules the next review at 08:00 on a future day', () => {
    const result = nextReviewDate(2);
    expect(result.getTime()).toBeGreaterThan(Date.now());
    expect(formatDate(result, 'HH:mm')).toBe('08:00');
  });

  it('returns the correct range for a month', () => {
    const february = monthRange('2024-02');
    expect(february.days).toBe(29);
    expect(formatDate(february.start, 'YYYY-MM-DD')).toBe('2024-02-01');
    expect(formatDate(february.end, 'YYYY-MM-DD')).toBe('2024-02-29');
  });

  it('builds an ordered list of the last N dates', () => {
    const dates = lastNDates(7);
    expect(dates).toHaveLength(7);
    expect(dates[6]).toBe(formatDate(new Date(), 'YYYY-MM-DD'));
    expect(dates[0] < dates[6]).toBe(true);
    expect(daysAgoStart(1).getTime()).toBeLessThan(daysAgoStart(0).getTime());
  });
});

describe('shared normalization', () => {
  it('normalizes AI question types and aliases', () => {
    expect(normalizeQuestionType('single_choice')).toBe('SINGLE_CHOICE');
    expect(normalizeQuestionType('判断题')).toBe('TRUE_FALSE');
    expect(normalizeQuestionType('something-else')).toBe('OTHER');
  });

  it('normalizes knowledge point names', () => {
    expect(normalizeKnowledgePoint('  一元二次方程（求根）  ')).toBe('一元二次方程(求根)');
    expect(normalizeKnowledgePoint('分数与小数，')).toBe('分数与小数');
  });

  it('exposes six mastery labels', () => {
    expect(MASTERY_LABELS).toHaveLength(6);
  });
});
