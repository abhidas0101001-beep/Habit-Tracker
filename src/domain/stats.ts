import { addDaysKey, toKey, type DateKey } from './dates';
import { ratioFor } from './levels';
import { isScheduled } from './schedule';
import type { Habit } from './types';

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  /** Share of scheduled days completed in the last 30 days (0..1), or null if none were scheduled. */
  rate30: number | null;
}

type StatsHabit = Pick<Habit, 'type' | 'target' | 'schedule' | 'createdAt'>;

/** First day that counts for a habit: its creation day or its earliest entry, whichever is first. */
export function habitStartKey(
  habit: Pick<Habit, 'createdAt'>,
  values: Map<DateKey, number>,
): DateKey {
  let start = toKey(new Date(habit.createdAt));
  for (const date of values.keys()) if (date < start) start = date;
  return start;
}

/**
 * Streaks count consecutive *scheduled* days that were completed. Unscheduled
 * days neither break nor extend a streak. An unlogged today doesn't break the
 * current streak (the day isn't over yet).
 */
export function computeStats(
  habit: StatsHabit,
  values: Map<DateKey, number>,
  today: DateKey,
): HabitStats {
  const done = (date: DateKey) => ratioFor(habit, values.get(date)) >= 1;
  const start = habitStartKey(habit, values);

  let totalCompletions = 0;
  for (const [date] of values) if (date <= today && done(date)) totalCompletions++;

  // Current streak: walk backwards from today.
  let currentStreak = 0;
  let cursor = today;
  if (isScheduled(habit, today) && !done(today)) cursor = addDaysKey(today, -1);
  while (cursor >= start) {
    if (isScheduled(habit, cursor)) {
      if (!done(cursor)) break;
      currentStreak++;
    }
    cursor = addDaysKey(cursor, -1);
  }

  // Longest streak: one forward pass.
  let longestStreak = 0;
  let run = 0;
  for (let d = start; d <= today; d = addDaysKey(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    if (done(d)) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else if (d !== today) {
      run = 0;
    }
  }

  // Completion rate over the last 30 days (bounded by the habit's start).
  let scheduled = 0;
  let completed = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDaysKey(today, -i);
    if (d < start) break;
    if (!isScheduled(habit, d)) continue;
    if (d === today && !done(d)) continue; // today isn't over
    scheduled++;
    if (done(d)) completed++;
  }

  return {
    currentStreak,
    longestStreak,
    totalCompletions,
    rate30: scheduled ? completed / scheduled : null,
  };
}
