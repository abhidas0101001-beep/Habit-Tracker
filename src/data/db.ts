import Dexie, { type EntityTable } from 'dexie';
import type { Entry, Habit } from '../domain/types';

export type AppDb = Dexie & {
  habits: EntityTable<Habit, 'id'>;
  entries: EntityTable<Entry, 'id'>;
};

export function createDb(name: string): AppDb {
  const db = new Dexie(name) as AppDb;
  db.version(1).stores({
    habits: 'id, order, archivedAt, updatedAt',
    entries: 'id, habitId, date, [habitId+date], updatedAt',
  });
  // v2: `pending` (1 = changed on this device, not yet uploaded) for sync.
  db.version(2)
    .stores({
      habits: 'id, order, archivedAt, updatedAt, pending',
      entries: 'id, habitId, date, [habitId+date], updatedAt, pending',
    })
    .upgrade(async (tx) => {
      // Everything created before sync existed still needs its first upload.
      await tx.table('habits').toCollection().modify({ pending: 1 });
      await tx.table('entries').toCollection().modify({ pending: 1 });
    });
  return db;
}

export const db = createDb('habit-tracker');
