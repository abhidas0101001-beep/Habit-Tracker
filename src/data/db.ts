import Dexie, { type EntityTable } from 'dexie';
import type { Entry, Habit } from '../domain/types';

export const db = new Dexie('habit-tracker') as Dexie & {
  habits: EntityTable<Habit, 'id'>;
  entries: EntityTable<Entry, 'id'>;
};

db.version(1).stores({
  habits: 'id, order, archivedAt, updatedAt',
  entries: 'id, habitId, date, [habitId+date], updatedAt',
});
