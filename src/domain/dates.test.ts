import { describe, expect, it } from 'vitest';
import { addDaysKey, diffDays, fromKey, isValidKey, toKey, weekdayOf } from './dates';

describe('dates', () => {
  it('round-trips keys through local dates', () => {
    expect(toKey(fromKey('2026-11-04'))).toBe('2026-11-04');
  });

  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDaysKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysKey('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('is not affected by DST changes', () => {
    // US and EU DST transitions in 2026.
    expect(addDaysKey('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDaysKey('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDaysKey('2026-10-25', 1)).toBe('2026-10-26');
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2);
  });

  it('knows weekdays', () => {
    expect(weekdayOf('2026-11-04')).toBe(3); // Wednesday
  });

  it('validates keys', () => {
    expect(isValidKey('2026-02-28')).toBe(true);
    expect(isValidKey('2026-02-30')).toBe(false);
    expect(isValidKey('2026-2-3')).toBe(false);
  });
});
