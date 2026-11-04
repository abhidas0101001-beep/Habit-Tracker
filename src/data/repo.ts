import { db } from './db';
import type { DateKey } from '../domain/dates';
import { isValidKey } from '../domain/dates';
import type { Entry, Habit } from '../domain/types';

const now = () => new Date().toISOString();
export const entryId = (habitId: string, date: DateKey) => `${habitId}:${date}`;

export type HabitInput = Pick<Habit, 'name' | 'icon' | 'color' | 'schedule'>;

/** Habits that aren't deleted, in display order. Archived ones are included. */
export async function listHabits(): Promise<Habit[]> {
  const all = await db.habits.orderBy('order').toArray();
  return all.filter((h) => !h.deleted);
}

export async function createHabit(input: HabitInput): Promise<Habit> {
  const last = await db.habits.orderBy('order').last();
  const t = now();
  const habit: Habit = {
    id: crypto.randomUUID(),
    type: 'boolean',
    target: 1,
    order: (last?.order ?? -1) + 1,
    createdAt: t,
    updatedAt: t,
    ...input,
    name: input.name.trim(),
  };
  await db.habits.add(habit);
  return habit;
}

export async function updateHabit(id: string, changes: Partial<Habit>): Promise<void> {
  await db.habits.update(id, { ...changes, updatedAt: now() });
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  const habit = await db.habits.get(id);
  if (!habit) return;
  const { archivedAt: _ignored, ...rest } = habit;
  await db.habits.put(
    archived ? { ...rest, archivedAt: now(), updatedAt: now() } : { ...rest, updatedAt: now() },
  );
}

/** Soft-delete (tombstone) the habit and its entries so the deletion can sync later. */
export async function deleteHabit(id: string): Promise<void> {
  const t = now();
  await db.transaction('rw', db.habits, db.entries, async () => {
    await db.habits.update(id, { deleted: true, updatedAt: t });
    await db.entries.where('habitId').equals(id).modify({ deleted: true, updatedAt: t });
  });
}

/** Entry values for one habit between two dates (inclusive), as date → value. */
export async function getValues(
  habitId: string,
  start: DateKey,
  end: DateKey,
): Promise<Map<DateKey, number>> {
  const rows = await db.entries
    .where('[habitId+date]')
    .between([habitId, start], [habitId, end], true, true)
    .toArray();
  return new Map(rows.filter((e) => !e.deleted && e.value > 0).map((e) => [e.date, e.value]));
}

export async function setValue(habitId: string, date: DateKey, value: number): Promise<void> {
  const id = entryId(habitId, date);
  const existing = await db.entries.get(id);
  await db.entries.put({
    ...existing,
    id,
    habitId,
    date,
    value,
    updatedAt: now(),
    deleted: value <= 0,
  });
}

export async function toggleDone(habitId: string, date: DateKey): Promise<boolean> {
  const existing = await db.entries.get(entryId(habitId, date));
  const nowDone = !(existing && !existing.deleted && existing.value > 0);
  await setValue(habitId, date, nowDone ? 1 : 0);
  return nowDone;
}

// ---------- Export / import ----------

export interface ExportFile {
  app: 'habit-tracker';
  version: 1;
  exportedAt: string;
  habits: Habit[];
  entries: Entry[];
}

export async function exportData(): Promise<ExportFile> {
  const [habits, entries] = await Promise.all([db.habits.toArray(), db.entries.toArray()]);
  return { app: 'habit-tracker', version: 1, exportedAt: now(), habits, entries };
}

export interface ImportResult {
  habits: number;
  entries: number;
}

/**
 * Merge an export into the local database. For each record the newer
 * `updatedAt` wins (the same rule sync will use), so importing is safe to repeat.
 */
export async function importData(raw: unknown): Promise<ImportResult> {
  const file = raw as Partial<ExportFile>;
  if (
    file?.app !== 'habit-tracker' ||
    !Array.isArray(file.habits) ||
    !Array.isArray(file.entries)
  ) {
    throw new Error('This file is not a Habit Tracker export.');
  }
  const habits = file.habits.filter(
    (h): h is Habit => typeof h?.id === 'string' && typeof h.name === 'string' && !!h.schedule,
  );
  const entries = file.entries.filter(
    (e): e is Entry =>
      typeof e?.id === 'string' &&
      typeof e.habitId === 'string' &&
      typeof e.date === 'string' &&
      isValidKey(e.date) &&
      typeof e.value === 'number',
  );

  let changedHabits = 0;
  let changedEntries = 0;
  await db.transaction('rw', db.habits, db.entries, async () => {
    const localHabits = new Map(
      (await db.habits.bulkGet(habits.map((h) => h.id))).map((h, i) => [habits[i]!.id, h]),
    );
    const newerHabits = habits.filter(
      (h) => !localHabits.get(h.id) || localHabits.get(h.id)!.updatedAt < h.updatedAt,
    );
    await db.habits.bulkPut(newerHabits);
    changedHabits = newerHabits.length;

    const localEntries = new Map(
      (await db.entries.bulkGet(entries.map((e) => e.id))).map((e, i) => [entries[i]!.id, e]),
    );
    const newerEntries = entries.filter(
      (e) => !localEntries.get(e.id) || localEntries.get(e.id)!.updatedAt < e.updatedAt,
    );
    await db.entries.bulkPut(newerEntries);
    changedEntries = newerEntries.length;
  });
  return { habits: changedHabits, entries: changedEntries };
}
