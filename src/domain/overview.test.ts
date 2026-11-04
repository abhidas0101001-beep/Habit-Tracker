import { describe, expect, it } from 'vitest';
import { overviewRatios } from './overview';
import type { Habit } from './types';

const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({
  id,
  name: id,
  color: 'green',
  type: 'boolean',
  target: 1,
  schedule: { kind: 'daily' },
  order: 0,
  createdAt: '2026-11-01T08:00:00',
  updatedAt: '2026-11-01T08:00:00',
  ...extra,
});

describe('overviewRatios', () => {
  it('averages completion over habits due that day', () => {
    const habits = [
      habit('a'),
      habit('b'),
      habit('c', { schedule: { kind: 'weekdays', days: [1] } }),
    ];
    const values = new Map([
      [
        'a',
        new Map([
          ['2026-11-01', 1],
          ['2026-11-02', 1],
        ]),
      ],
      ['b', new Map([['2026-11-02', 1]])],
    ]);
    const r = overviewRatios(habits, values, '2026-10-31', '2026-11-02');
    expect(r.has('2026-10-31')).toBe(false); // before any habit started
    expect(r.get('2026-11-01')).toBe(0.5); // Sunday: a, b due; c not
    expect(r.get('2026-11-02')).toBeCloseTo(2 / 3); // Monday: all three due
  });
});

describe('overviewRatios with weekly goals', () => {
  it('counts an N-per-week habit only on days it was done', () => {
    const habits = [habit('a'), habit('w', { schedule: { kind: 'timesPerWeek', times: 3 } })];
    const values = new Map([
      [
        'a',
        new Map([
          ['2026-11-01', 1],
          ['2026-11-02', 1],
        ]),
      ],
      ['w', new Map([['2026-11-02', 1]])],
    ]);
    const r = overviewRatios(habits, values, '2026-11-01', '2026-11-02');
    expect(r.get('2026-11-01')).toBe(1);
    expect(r.get('2026-11-02')).toBe(1);
  });
});
