import type { Habit } from './types';

/** "6 / 8 glasses", "20 / 30 min", or "done" / "not done" for yes/no habits. */
export function formatProgress(
  habit: Pick<Habit, 'type' | 'target' | 'unit'>,
  value: number | undefined,
): string {
  const v = value ?? 0;
  if (habit.type === 'boolean') return v > 0 ? 'done' : 'not done';
  return `${v} / ${habit.target} ${unitLabel(habit)}`;
}

export function unitLabel(habit: Pick<Habit, 'type' | 'unit'>): string {
  if (habit.type === 'duration') return 'min';
  return habit.unit?.trim() || 'times';
}

export function describeTarget(habit: Pick<Habit, 'type' | 'target' | 'unit'>): string {
  if (habit.type === 'boolean') return '';
  return `${habit.target} ${unitLabel(habit)}`;
}
