export type HabitType = 'boolean' | 'count' | 'duration';

export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] } // 0 = Sun … 6 = Sat
  | { kind: 'timesPerWeek'; times: number };

export type PaletteName = 'green' | 'blue' | 'purple' | 'orange' | 'pink';

export interface Habit {
  id: string;
  name: string;
  icon?: string;
  color: PaletteName;
  type: HabitType;
  /** 1 for boolean habits; count or minutes otherwise. */
  target: number;
  /** Unit shown for count habits, e.g. "glasses". Duration habits always use minutes. */
  unit?: string;
  schedule: Schedule;
  reminderTime?: string;
  order: number;
  createdAt: string; // ISO timestamp
  archivedAt?: string;
  updatedAt: string;
  deleted?: boolean;
}

/** One entry per habit per local calendar day. */
export interface Entry {
  id: string; // `${habitId}:${date}`
  habitId: string;
  date: string; // 'YYYY-MM-DD'
  value: number;
  note?: string;
  updatedAt: string;
  deleted?: boolean;
}

/** 0 = Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;
