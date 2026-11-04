import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  createHabit,
  deleteHabit,
  exportData,
  getValues,
  importData,
  listHabits,
  toggleDone,
} from './repo';

beforeEach(async () => {
  await db.habits.clear();
  await db.entries.clear();
});

describe('repo', () => {
  it('creates habits in order and toggles entries', async () => {
    const a = await createHabit({ name: ' Read ', color: 'green', schedule: { kind: 'daily' } });
    const b = await createHabit({ name: 'Run', color: 'blue', schedule: { kind: 'daily' } });
    expect(a.name).toBe('Read');
    expect((await listHabits()).map((h) => h.id)).toEqual([a.id, b.id]);

    expect(await toggleDone(a.id, '2026-11-04')).toBe(true);
    expect(await getValues(a.id, '2026-11-01', '2026-11-30')).toEqual(new Map([['2026-11-04', 1]]));
    expect(await toggleDone(a.id, '2026-11-04')).toBe(false);
    expect((await getValues(a.id, '2026-11-01', '2026-11-30')).size).toBe(0);
  });

  it('soft-deletes habits', async () => {
    const a = await createHabit({ name: 'Read', color: 'green', schedule: { kind: 'daily' } });
    await toggleDone(a.id, '2026-11-04');
    await deleteHabit(a.id);
    expect(await listHabits()).toEqual([]);
    expect((await getValues(a.id, '2026-11-01', '2026-11-30')).size).toBe(0);
  });

  it('round-trips export → import and keeps newer local edits', async () => {
    const a = await createHabit({ name: 'Read', color: 'green', schedule: { kind: 'daily' } });
    await toggleDone(a.id, '2026-11-03');
    const file = JSON.parse(JSON.stringify(await exportData()));

    await db.habits.clear();
    await db.entries.clear();
    expect(await importData(file)).toEqual({ habits: 1, entries: 1 });
    expect((await getValues(a.id, '2026-11-01', '2026-11-30')).has('2026-11-03')).toBe(true);

    // Importing the same file again changes nothing.
    expect(await importData(file)).toEqual({ habits: 0, entries: 0 });
  });

  it('rejects files that are not exports', async () => {
    await expect(importData({ foo: 1 })).rejects.toThrow(/not a Habit Tracker export/);
  });
});
