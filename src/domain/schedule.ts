import { weekdayOf, type DateKey } from './dates';
import type { Habit } from './types';

/** Whether the habit is due on the given day. */
export function isScheduled(habit: Pick<Habit, 'schedule'>, date: DateKey): boolean {
  const s = habit.schedule;
  switch (s.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return s.days.includes(weekdayOf(date));
    case 'timesPerWeek':
      // Any day can count towards the weekly goal.
      return true;
  }
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function describeSchedule(habit: Pick<Habit, 'schedule'>): string {
  const s = habit.schedule;
  switch (s.kind) {
    case 'daily':
      return 'Every day';
    case 'weekdays': {
      const days = [...s.days].sort((a, b) => a - b);
      if (days.join() === '1,2,3,4,5') return 'Weekdays';
      if (days.join() === '0,6') return 'Weekends';
      return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
    }
    case 'timesPerWeek':
      return `${s.times}× per week`;
  }
}
