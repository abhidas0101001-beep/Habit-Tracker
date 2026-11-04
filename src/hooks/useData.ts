import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { listHabits } from '../data/repo';
import type { DateKey } from '../domain/dates';
import type { Habit } from '../domain/types';

export type ValuesByHabit = Map<string, Map<DateKey, number>>;

/** All non-deleted habits (including archived), or undefined while loading. */
export function useHabits(): Habit[] | undefined {
  return useLiveQuery(listHabits, []);
}

export function useHabit(id: string | undefined): Habit | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const h = await db.habits.get(id);
    return h && !h.deleted ? h : null;
  }, [id]);
}

/**
 * Every logged value grouped by habit. A single user logs a few thousand
 * entries a year, so loading them all keeps streak maths simple and exact.
 */
export function useValuesByHabit(): ValuesByHabit | undefined {
  return useLiveQuery(async () => {
    const map: ValuesByHabit = new Map();
    await db.entries.each((e) => {
      if (e.deleted || e.value <= 0) return;
      let m = map.get(e.habitId);
      if (!m) map.set(e.habitId, (m = new Map()));
      m.set(e.date, e.value);
    });
    return map;
  }, []);
}
