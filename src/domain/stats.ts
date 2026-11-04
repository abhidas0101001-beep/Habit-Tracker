import { startOfWeek } from 'date-fns';
import { addDaysKey, fromKey, toKey, weekdayOf, type DateKey } from './dates';
import { ratioFor } from './levels';
import { isScheduled } from './schedule';
import type { Habit, WeekStart } from './types';

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  /** Streaks of "N times per week" habits are counted in weeks. */
  streakUnit: 'day' | 'week';
  /** Days on which the daily target was reached. */
  totalCompletions: number;
  /** Completion over the last 30 days (0..1), or null if nothing was due. */
  rate30: number | null;
}

type StatsHabit = Pick<Habit, 'type' | 'target' | 'schedule' | 'createdAt'>;
type Values = Map<DateKey, number>;

/** First day that counts for a habit: its creation day or its earliest entry, whichever is first. */
export function habitStartKey(habit: Pick<Habit, 'createdAt'>, values: Values): DateKey {
  let start = toKey(new Date(habit.createdAt));
  for (const date of values.keys()) if (date < start) start = date;
  return start;
}

const isDone = (habit: StatsHabit, values: Values, date: DateKey) =>
  ratioFor(habit, values.get(date)) >= 1;

export function weekStartKey(date: DateKey, weekStart: WeekStart): DateKey {
  return toKey(startOfWeek(fromKey(date), { weekStartsOn: weekStart }));
}

/** Days completed in the week containing `date`. */
export function weekCompletions(
  habit: StatsHabit,
  values: Values,
  date: DateKey,
  weekStart: WeekStart,
): number {
  const first = weekStartKey(date, weekStart);
  let n = 0;
  for (let i = 0; i < 7; i++) if (isDone(habit, values, addDaysKey(first, i))) n++;
  return n;
}

/**
 * Completion over [from, to] (inclusive), bounded by the habit's start and by today.
 * An unlogged today is left out: the day isn't over yet.
 * - Daily / weekday habits: average completion of the days that were due.
 * - N-per-week habits: completed days against the pro-rated goal, capped at 1.
 */
export function periodRate(
  habit: StatsHabit,
  values: Values,
  from: DateKey,
  to: DateKey,
  today: DateKey,
): number | null {
  const start = habitStartKey(habit, values);
  const first = from > start ? from : start;
  const last = to < today ? to : today;
  let days = 0;
  let score = 0;
  for (let d = first; d <= last; d = addDaysKey(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    const ratio = ratioFor(habit, values.get(d));
    if (d === today && ratio < 1) continue;
    days++;
    score += habit.schedule.kind === 'timesPerWeek' ? (ratio >= 1 ? 1 : 0) : ratio;
  }
  if (days === 0) return null;
  if (habit.schedule.kind === 'timesPerWeek') {
    return Math.min(score / ((habit.schedule.times * days) / 7), 1);
  }
  return score / days;
}

/**
 * Daily and weekday habits: streaks count consecutive *due* days that were completed;
 * days off neither break nor extend them. N-per-week habits: consecutive weeks in which
 * the goal was met. The current day or week never breaks a streak while it's in progress.
 */
export function computeStats(
  habit: StatsHabit,
  values: Values,
  today: DateKey,
  weekStart: WeekStart = 1,
): HabitStats {
  const done = (date: DateKey) => isDone(habit, values, date);
  const start = habitStartKey(habit, values);

  let totalCompletions = 0;
  for (const [date] of values) if (date <= today && done(date)) totalCompletions++;

  const rate30 = periodRate(habit, values, addDaysKey(today, -29), today, today);

  if (habit.schedule.kind === 'timesPerWeek') {
    const times = habit.schedule.times;
    const met = (week: DateKey) => weekCompletions(habit, values, week, weekStart) >= times;
    const thisWeek = weekStartKey(today, weekStart);
    const firstWeek = weekStartKey(start, weekStart);

    let currentStreak = 0;
    let w = met(thisWeek) ? thisWeek : addDaysKey(thisWeek, -7);
    while (w >= firstWeek && met(w)) {
      currentStreak++;
      w = addDaysKey(w, -7);
    }

    let longestStreak = 0;
    let run = 0;
    for (let wk = firstWeek; wk <= thisWeek; wk = addDaysKey(wk, 7)) {
      if (met(wk)) longestStreak = Math.max(longestStreak, ++run);
      else if (wk !== thisWeek) run = 0;
    }
    return { currentStreak, longestStreak, streakUnit: 'week', totalCompletions, rate30 };
  }

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

  let longestStreak = 0;
  let run = 0;
  for (let d = start; d <= today; d = addDaysKey(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    if (done(d)) longestStreak = Math.max(longestStreak, ++run);
    else if (d !== today) run = 0;
  }

  return { currentStreak, longestStreak, streakUnit: 'day', totalCompletions, rate30 };
}

export interface ChartBar {
  key: string;
  label: string;
  /** 0..1, or null when nothing was due. */
  value: number | null;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Average completion on each weekday over the last 12 months, in week order. */
export function weekdayRates(
  habit: StatsHabit,
  values: Values,
  today: DateKey,
  weekStart: WeekStart,
): ChartBar[] {
  const start = habitStartKey(habit, values);
  const from = addDaysKey(today, -364);
  const sums = Array.from({ length: 7 }, () => ({ days: 0, score: 0 }));
  for (let d = from > start ? from : start; d <= today; d = addDaysKey(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    const ratio = ratioFor(habit, values.get(d));
    if (d === today && ratio < 1) continue;
    const s = sums[weekdayOf(d)]!;
    s.days++;
    s.score += ratio;
  }
  return Array.from({ length: 7 }, (_, i) => {
    const wd = (weekStart + i) % 7;
    const s = sums[wd]!;
    return { key: String(wd), label: WEEKDAY_LABELS[wd]!, value: s.days ? s.score / s.days : null };
  });
}

/** Completion per calendar month for the last `months` months (oldest first). */
export function monthlyRates(
  habit: StatsHabit,
  values: Values,
  today: DateKey,
  months = 12,
): ChartBar[] {
  const t = fromKey(today);
  const bars: ChartBar[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const first = new Date(t.getFullYear(), t.getMonth() - i, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const from = toKey(first);
    bars.push({
      key: from.slice(0, 7),
      label: MONTH_LABELS[first.getMonth()]!,
      value: periodRate(habit, values, from, toKey(last), today),
    });
  }
  return bars;
}
