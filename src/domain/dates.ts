import { addDays, differenceInCalendarDays, format } from 'date-fns';

/**
 * Days are handled as local calendar-day strings ('YYYY-MM-DD'), never as
 * timestamps, so an entry logged at 11 PM stays on that day in any timezone.
 */
export type DateKey = string;

export function toKey(date: Date): DateKey {
  return format(date, 'yyyy-MM-dd');
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toKey(now);
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  return toKey(addDays(fromKey(key), days));
}

export function diffDays(later: DateKey, earlier: DateKey): number {
  return differenceInCalendarDays(fromKey(later), fromKey(earlier));
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(key: DateKey): number {
  return fromKey(key).getDay();
}

export function isValidKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return toKey(fromKey(key)) === key;
}

export function formatLong(key: DateKey): string {
  return format(fromKey(key), 'EEE, MMM d yyyy');
}
