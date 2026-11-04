import { addDaysKey, type DateKey } from './dates';
import { ratioFor } from './levels';
import { isScheduled } from './schedule';
import { habitStartKey } from './stats';
import type { Habit } from './types';

/**
 * For each day in [start, end], the share of habits that were due and completed.
 * A habit counts from its start day (creation or earliest entry) onwards.
 */
export function overviewRatios(
  habits: Habit[],
  values: Map<string, Map<DateKey, number>>,
  start: DateKey,
  end: DateKey,
): Map<DateKey, number> {
  const tracked = habits.map((h) => {
    const v = values.get(h.id) ?? new Map<DateKey, number>();
    return { habit: h, values: v, start: habitStartKey(h, v) };
  });
  const out = new Map<DateKey, number>();
  for (let d = start; d <= end; d = addDaysKey(d, 1)) {
    let due = 0;
    let doneScore = 0;
    for (const t of tracked) {
      if (d < t.start || !isScheduled(t.habit, d)) continue;
      due++;
      doneScore += ratioFor(t.habit, t.values.get(d));
    }
    if (due > 0 && doneScore > 0) out.set(d, doneScore / due);
  }
  return out;
}

/** Turn raw values into ratios for one habit's heatmap. */
export function habitRatios(
  habit: Pick<Habit, 'type' | 'target'>,
  values: Map<DateKey, number> | undefined,
): Map<DateKey, number> {
  const out = new Map<DateKey, number>();
  values?.forEach((v, d) => out.set(d, ratioFor(habit, v)));
  return out;
}
