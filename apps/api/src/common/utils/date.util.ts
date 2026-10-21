import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TIMEZONE = process.env.TZ || 'Asia/Shanghai';

export function now(): Date {
  return new Date();
}

export function startOfToday(): Date {
  return dayjs().tz(APP_TIMEZONE).startOf('day').toDate();
}

export function endOfToday(): Date {
  return dayjs().tz(APP_TIMEZONE).endOf('day').toDate();
}

export function startOfDay(value: string | Date): Date {
  return dayjs(value).tz(APP_TIMEZONE).startOf('day').toDate();
}

export function endOfDay(value: string | Date): Date {
  return dayjs(value).tz(APP_TIMEZONE).endOf('day').toDate();
}

export function nextReviewDate(days: number): Date {
  return dayjs().tz(APP_TIMEZONE).add(days, 'day').hour(8).minute(0).second(0).millisecond(0).toDate();
}

export function formatDate(value: Date | string, template = 'YYYY-MM-DD'): string {
  return dayjs(value).tz(APP_TIMEZONE).format(template);
}

export function monthRange(month: string): { start: Date; end: Date; days: number } {
  const base = dayjs(`${month}-01`).tz(APP_TIMEZONE).startOf('month');
  return {
    start: base.toDate(),
    end: base.endOf('month').toDate(),
    days: base.daysInMonth(),
  };
}

export function isOverdue(value: Date): boolean {
  return value.getTime() < startOfToday().getTime();
}

export function startOfWeek(): Date {
  const current = dayjs().tz(APP_TIMEZONE);
  const offset = (current.day() + 6) % 7;
  return current.subtract(offset, 'day').startOf('day').toDate();
}

export function daysAgoStart(days: number): Date {
  return dayjs().tz(APP_TIMEZONE).subtract(days, 'day').startOf('day').toDate();
}

export function lastNDates(days: number): string[] {
  const current = dayjs().tz(APP_TIMEZONE);
  return Array.from({ length: days }, (_, index) =>
    current
      .subtract(days - 1 - index, 'day')
      .format('YYYY-MM-DD'),
  );
}
