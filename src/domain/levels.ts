import type { Habit } from './types';

export type Level = 0 | 1 | 2 | 3 | 4;

/** Map a completion ratio (0..1+) to one of five GitHub-style intensity levels. */
export function level(ratio: number): Level {
  if (!(ratio > 0)) return 0;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 1) return 3;
  return 4;
}

/** Completion ratio for one habit on one day, capped at 1. */
export function ratioFor(habit: Pick<Habit, 'type' | 'target'>, value: number | undefined): number {
  if (!value || value <= 0) return 0;
  if (habit.type === 'boolean') return 1;
  return Math.min(value / Math.max(habit.target, 1), 1);
}
