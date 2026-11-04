import { addDays, startOfWeek } from 'date-fns';
import { fromKey, toKey, type DateKey } from './dates';
import type { WeekStart } from './types';

export interface GridDay {
  date: DateKey;
  /** False for days after `endDate` (the rest of the current week). */
  inRange: boolean;
}

export interface MonthLabel {
  column: number;
  label: string;
}

export interface Grid {
  /** columns[week][row]; row 0 is the configured first day of the week. */
  columns: GridDay[][];
  monthLabels: MonthLabel[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Build a GitHub-style grid of `weeks` columns × 7 rows, ending with the week
 * that contains `endDate`. Pure and timezone-safe (works on local dates).
 */
export function buildGrid(endDate: DateKey, weeks: number, weekStart: WeekStart): Grid {
  const end = fromKey(endDate);
  const lastColumnStart = startOfWeek(end, { weekStartsOn: weekStart });
  const firstColumnStart = addDays(lastColumnStart, -(weeks - 1) * 7);

  const columns: GridDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = toKey(addDays(firstColumnStart, w * 7 + d));
      column.push({ date, inRange: date <= endDate });
    }
    columns.push(column);
  }

  // A month label goes above the first column whose first day is in a new month.
  const monthLabels: MonthLabel[] = [];
  let prevMonth = -1;
  columns.forEach((column, i) => {
    const month = fromKey(column[0]!.date).getMonth();
    if (month !== prevMonth) {
      monthLabels.push({ column: i, label: MONTHS[month]! });
      prevMonth = month;
    }
  });
  // Like GitHub, drop a leading label that would collide with the next one.
  if (monthLabels.length > 1 && monthLabels[1]!.column - monthLabels[0]!.column < 3) {
    monthLabels.shift();
  }

  return { columns, monthLabels };
}

/** Number of grid columns needed to show every day from `start` to `end`. */
export function weeksBetween(start: DateKey, end: DateKey, weekStart: WeekStart): number {
  const a = startOfWeek(fromKey(start), { weekStartsOn: weekStart });
  const b = startOfWeek(fromKey(end), { weekStartsOn: weekStart });
  return Math.round((b.getTime() - a.getTime()) / (7 * 86_400_000)) + 1;
}
