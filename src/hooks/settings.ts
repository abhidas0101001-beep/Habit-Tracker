import { useSyncExternalStore } from 'react';
import type { WeekStart } from '../domain/types';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  theme: Theme;
  weekStart: WeekStart;
}

const KEY = 'habit-tracker:settings';
const DEFAULTS: Settings = { theme: 'system', weekStart: 1 };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function updateSettings(changes: Partial<Settings>): void {
  current = { ...current, ...changes };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: keep the in-memory value */
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
