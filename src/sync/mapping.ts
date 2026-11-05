import type { Entry, Habit, HabitType, PaletteName, Schedule } from '../domain/types';

/** Row shapes of the Supabase tables (see supabase/schema.sql). */
export interface HabitRow {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  type: string;
  target: number;
  unit: string | null;
  schedule: Schedule;
  reminder_time: string | null;
  sort_order: number;
  created_at: string;
  archived_at: string | null;
  updated_at: string;
  deleted: boolean;
  synced_at?: string;
}

export interface EntryRow {
  id: string;
  habit_id: string;
  date: string;
  value: number;
  note: string | null;
  updated_at: string;
  deleted: boolean;
  synced_at?: string;
}

/**
 * Postgres returns timestamps like "2026-11-05T10:00:00.12+00:00"; devices store
 * "2026-11-05T10:00:00.120Z". Normalise so string comparison is time comparison.
 */
export function iso(ts: string): string {
  return new Date(ts).toISOString();
}

export function habitToRow(h: Habit): HabitRow {
  return {
    id: h.id,
    name: h.name,
    icon: h.icon ?? null,
    color: h.color,
    type: h.type,
    target: h.target,
    unit: h.unit ?? null,
    schedule: h.schedule,
    reminder_time: h.reminderTime ?? null,
    sort_order: h.order,
    created_at: h.createdAt,
    archived_at: h.archivedAt ?? null,
    updated_at: h.updatedAt,
    deleted: !!h.deleted,
  };
}

export function rowToHabit(r: HabitRow): Habit {
  const h: Habit = {
    id: r.id,
    name: r.name,
    color: r.color as PaletteName,
    type: r.type as HabitType,
    target: r.target,
    schedule: r.schedule,
    order: r.sort_order,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    pending: 0,
  };
  if (r.icon) h.icon = r.icon;
  if (r.unit) h.unit = r.unit;
  if (r.reminder_time) h.reminderTime = r.reminder_time;
  if (r.archived_at) h.archivedAt = iso(r.archived_at);
  if (r.deleted) h.deleted = true;
  return h;
}

export function entryToRow(e: Entry): EntryRow {
  return {
    id: e.id,
    habit_id: e.habitId,
    date: e.date,
    value: e.value,
    note: e.note ?? null,
    updated_at: e.updatedAt,
    deleted: !!e.deleted,
  };
}

export function rowToEntry(r: EntryRow): Entry {
  const e: Entry = {
    id: r.id,
    habitId: r.habit_id,
    date: r.date.slice(0, 10),
    value: r.value,
    updatedAt: iso(r.updated_at),
    pending: 0,
  };
  if (r.note) e.note = r.note;
  if (r.deleted) e.deleted = true;
  return e;
}
