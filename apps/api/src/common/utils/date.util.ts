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

export function startOfDay(value: string | Date): Date {
  return dayjs(value).tz(APP_TIMEZONE).startOf('day').toDate();
}

export function endOfDay(value: string | Date): Date {
  return dayjs(value).tz(APP_TIMEZONE).endOf('day').toDate();
}

export function formatDate(value: Date | string, template = 'YYYY-MM-DD'): string {
  return dayjs(value).tz(APP_TIMEZONE).format(template);
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
