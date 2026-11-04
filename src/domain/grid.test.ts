import { describe, expect, it } from 'vitest';
import { buildGrid, weeksBetween } from './grid';
import { weekdayOf } from './dates';

describe('buildGrid', () => {
  it('builds weeks × 7 cells ending in the week of endDate (Sunday start)', () => {
    const { columns } = buildGrid('2026-11-04', 53, 0);
    expect(columns).toHaveLength(53);
    columns.forEach((c) => expect(c).toHaveLength(7));
    const last = columns[52]!;
    expect(last[0]!.date).toBe('2026-11-01'); // Sunday
    expect(last[3]!.date).toBe('2026-11-04');
    expect(last[3]!.inRange).toBe(true);
    expect(last[4]!.inRange).toBe(false);
    expect(columns[0]![0]!.date).toBe('2025-11-02');
  });

  it('starts rows on Monday when configured', () => {
    const { columns } = buildGrid('2026-11-04', 53, 1);
    columns.forEach((c) => expect(weekdayOf(c[0]!.date)).toBe(1));
    expect(columns[52]![0]!.date).toBe('2026-11-02');
  });

  it('has consecutive days with no gaps', () => {
    const days = buildGrid('2028-03-01', 53, 1).columns.flat();
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]!.date + 'T12:00:00');
      const cur = new Date(days[i]!.date + 'T12:00:00');
      expect(Math.round((cur.getTime() - prev.getTime()) / 86_400_000)).toBe(1);
    }
  });

  it('labels months on the first column of each month and skips crowded leading labels', () => {
    const { monthLabels } = buildGrid('2026-11-04', 53, 0);
    // First column starts 2025-11-02 (Nov); Dec starts at column 5, so the Nov label is kept.
    expect(monthLabels[0]).toEqual({ column: 0, label: 'Nov' });
    expect(monthLabels.map((m) => m.label)).toContain('Dec');
    expect(monthLabels.at(-1)!.label).toBe('Nov');

    const crowded = buildGrid('2026-10-28', 53, 0); // first column 2025-10-26 (Oct), Nov next column
    expect(crowded.monthLabels[0]!.label).toBe('Nov');
    const tight = buildGrid('2026-11-25', 53, 0); // first column 2025-11-23, Dec two columns later
    expect(tight.monthLabels[0]!.label).toBe('Dec');
  });
});

describe('weeksBetween', () => {
  it('counts the columns for a calendar year', () => {
    expect(weeksBetween('2026-01-01', '2026-12-31', 0)).toBe(53);
    expect(weeksBetween('2023-01-01', '2023-12-31', 0)).toBe(53); // Jan 1 2023 is a Sunday
    expect(weeksBetween('2026-11-02', '2026-11-08', 1)).toBe(1);
  });
});
