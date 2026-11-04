import { describe, expect, it } from 'vitest';
import { computeStats } from './stats';
import type { Habit } from './types';

const daily: Pick<Habit, 'type' | 'target' | 'schedule' | 'createdAt'> = {
  type: 'boolean',
  target: 1,
  schedule: { kind: 'daily' },
  createdAt: '2026-10-01T12:00:00',
};

const done = (...dates: string[]) => new Map(dates.map((d) => [d, 1]));

describe('computeStats', () => {
  it('counts a streak ending today', () => {
    const s = computeStats(daily, done('2026-11-02', '2026-11-03', '2026-11-04'), '2026-11-04');
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
    expect(s.totalCompletions).toBe(3);
  });

  it('does not break the current streak when today is not logged yet', () => {
    const s = computeStats(daily, done('2026-11-02', '2026-11-03'), '2026-11-04');
    expect(s.currentStreak).toBe(2);
  });

  it('resets after a missed day', () => {
    const s = computeStats(
      daily,
      done('2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-03'),
      '2026-11-04',
    );
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(4);
  });

  it('skips unscheduled days', () => {
    const weekdays = { ...daily, schedule: { kind: 'weekdays' as const, days: [1, 2, 3, 4, 5] } };
    // Fri Oct 30, (weekend), Mon Nov 2, Tue Nov 3
    const s = computeStats(weekdays, done('2026-10-30', '2026-11-02', '2026-11-03'), '2026-11-04');
    expect(s.currentStreak).toBe(3);
  });

  it('includes backfilled entries before the creation date', () => {
    const s = computeStats(daily, done('2026-09-29', '2026-09-30'), '2026-09-30');
    expect(s.longestStreak).toBe(2);
  });

  it('computes the 30-day completion rate from the habit start', () => {
    const h = { ...daily, createdAt: '2026-11-01T09:00:00' };
    // Nov 1–3 are over (2 of 3 done); today Nov 4 not logged → excluded.
    const s = computeStats(h, done('2026-11-01', '2026-11-03'), '2026-11-04');
    expect(s.rate30).toBeCloseTo(2 / 3);
  });

  it('treats partially completed count habits as not done', () => {
    const count = { ...daily, type: 'count' as const, target: 8 };
    const s = computeStats(
      count,
      new Map([
        ['2026-11-03', 5],
        ['2026-11-04', 8],
      ]),
      '2026-11-04',
    );
    expect(s.currentStreak).toBe(1);
    expect(s.totalCompletions).toBe(1);
  });
});
