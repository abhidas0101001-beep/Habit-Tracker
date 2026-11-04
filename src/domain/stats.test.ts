import { describe, expect, it } from 'vitest';
import { computeStats, monthlyRates, periodRate, weekCompletions, weekdayRates } from './stats';
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

describe('N times per week', () => {
  const tpw = { ...daily, schedule: { kind: 'timesPerWeek' as const, times: 3 } };
  // Weeks start Monday: Oct 19, Oct 26, Nov 2 (today = Wed Nov 4).

  it('counts streaks in weeks and ignores the week in progress', () => {
    const values = done(
      '2026-10-19',
      '2026-10-21',
      '2026-10-23', // week of Oct 19: 3 ✓
      '2026-10-26',
      '2026-10-27',
      '2026-10-30', // week of Oct 26: 3 ✓
      '2026-11-03', // this week: 1 so far
    );
    const s = computeStats(tpw, values, '2026-11-04', 1);
    expect(s.streakUnit).toBe('week');
    expect(s.currentStreak).toBe(2);
    expect(s.longestStreak).toBe(2);
  });

  it('includes the current week once its goal is met', () => {
    const values = done(
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    );
    expect(computeStats(tpw, values, '2026-11-04', 1).currentStreak).toBe(2);
  });

  it('breaks on a week that missed the goal', () => {
    const values = done('2026-10-19', '2026-10-20', '2026-10-21', '2026-10-26');
    const s = computeStats(tpw, values, '2026-11-04', 1);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(1);
  });

  it('respects the week start setting', () => {
    expect(weekCompletions(tpw, done('2026-11-01', '2026-11-02'), '2026-11-04', 0)).toBe(2);
    expect(weekCompletions(tpw, done('2026-11-01', '2026-11-02'), '2026-11-04', 1)).toBe(1);
  });

  it('rates completion against the pro-rated weekly goal', () => {
    const h = { ...tpw, createdAt: '2026-10-22T09:00:00' }; // 14 days up to Nov 4, today unlogged
    const values = done(
      '2026-10-22',
      '2026-10-24',
      '2026-10-27',
      '2026-10-29',
      '2026-11-01',
      '2026-11-03',
    );
    // 13 finished days → goal 3 × 13/7 ≈ 5.57; 6 done → capped at 1.
    expect(periodRate(h, values, '2026-10-06', '2026-11-04', '2026-11-04')).toBe(1);
    expect(
      periodRate(h, done('2026-10-22', '2026-10-27'), '2026-10-06', '2026-11-04', '2026-11-04'),
    ).toBeCloseTo(2 / ((3 * 13) / 7));
  });
});

describe('charts', () => {
  it('averages completion per weekday in week order', () => {
    const h = { ...daily, createdAt: '2026-10-26T09:00:00' };
    // Mon Oct 26 – Tue Nov 3 finished; Mondays both done, Tuesdays one of two.
    const bars = weekdayRates(h, done('2026-10-26', '2026-11-02', '2026-10-27'), '2026-11-04', 1);
    expect(bars.map((b) => b.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(bars[0]!.value).toBe(1);
    expect(bars[1]!.value).toBe(0.5);
    expect(bars[2]!.value).toBe(0); // Wed Oct 28 missed; today (Wed) excluded
  });

  it('gives partial credit to count habits in monthly rates', () => {
    const h = { ...daily, type: 'count' as const, target: 8, createdAt: '2026-11-01T09:00:00' };
    const bars = monthlyRates(
      h,
      new Map([
        ['2026-11-01', 8],
        ['2026-11-02', 4],
        ['2026-11-03', 0],
      ]),
      '2026-11-04',
      3,
    );
    expect(bars.map((b) => b.key)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(bars[0]!.value).toBeNull(); // before the habit started
    expect(bars[2]!.value).toBeCloseTo((1 + 0.5 + 0) / 3);
  });
});
