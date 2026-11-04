import { describe, expect, it } from 'vitest';
import { level, ratioFor } from './levels';

describe('level', () => {
  it('maps ratios to five buckets', () => {
    expect(level(0)).toBe(0);
    expect(level(-1)).toBe(0);
    expect(level(Number.NaN)).toBe(0);
    expect(level(0.1)).toBe(1);
    expect(level(0.25)).toBe(2);
    expect(level(0.5)).toBe(3);
    expect(level(0.99)).toBe(3);
    expect(level(1)).toBe(4);
    expect(level(2)).toBe(4);
  });
});

describe('ratioFor', () => {
  it('treats boolean habits as all-or-nothing', () => {
    const h = { type: 'boolean' as const, target: 1 };
    expect(ratioFor(h, undefined)).toBe(0);
    expect(ratioFor(h, 0)).toBe(0);
    expect(ratioFor(h, 1)).toBe(1);
  });

  it('uses value / target for counts, capped at 1', () => {
    const h = { type: 'count' as const, target: 8 };
    expect(ratioFor(h, 6)).toBe(0.75);
    expect(ratioFor(h, 12)).toBe(1);
  });
});
