import { describe, expect, it } from 'vitest';
import {
  display,
  formatLocal,
  fromPocketBase,
  inRange,
  monthGrid,
  parseLocal,
  toPocketBase,
} from '../../src/admin/date';

describe('parseLocal / formatLocal', () => {
  it('round-trips date and date-time strings', () => {
    expect(parseLocal('2026-11-11T14:30')).toEqual({
      year: 2026,
      month: 10,
      day: 11,
      hour: 14,
      minute: 30,
    });
    expect(formatLocal(parseLocal('2026-11-11T14:30') as never, true)).toBe('2026-11-11T14:30');
    expect(formatLocal(parseLocal('2026-01-05') as never, false)).toBe('2026-01-05');
  });
  it('rejects empty, malformed and impossible dates', () => {
    for (const bad of [
      '',
      'nope',
      '2026-02-31',
      '2026-13-01',
      '2026-11-11T25:00',
      '2026-11-11T10:99',
    ])
      expect(parseLocal(bad)).toBeNull();
    expect(parseLocal('2024-02-29')).not.toBeNull(); // leap day
    expect(parseLocal('2026-02-29')).toBeNull();
  });
  it('displays human-readable text', () => {
    expect(display('2026-11-02T09:05', true)).toBe('2 Nov 2026, 09:05');
    expect(display('2026-11-02', false)).toBe('2 Nov 2026');
    expect(display('', true)).toBe('');
  });
});

describe('monthGrid', () => {
  it('is 42 cells starting on a Monday and containing the whole month', () => {
    const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(g).toHaveLength(42);
    expect(new Date(g[0]?.year ?? 0, g[0]?.month ?? 0, g[0]?.day ?? 0).getDay()).toBe(1);
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
    expect(g.filter((c) => c.inMonth)[0]).toMatchObject({ day: 1, month: 10 });
  });
  it('handles leap Februaries and year boundaries', () => {
    expect(monthGrid(2024, 1).filter((c) => c.inMonth)).toHaveLength(29);
    const dec = monthGrid(2026, 11);
    expect(dec.some((c) => c.year === 2027 && c.month === 0)).toBe(true);
  });
});

describe('PocketBase conversion and range filter', () => {
  it('converts UTC strings to local calendar values and back', () => {
    const local = fromPocketBase('2026-11-02 12:00:00.000Z');
    expect(local).toMatch(/^2026-11-02T\d\d:\d\d$/);
    expect(new Date(toPocketBase(local).replace(' ', 'T')).getTime()).toBe(
      new Date('2026-11-02T12:00:00.000Z').getTime(),
    );
    expect(toPocketBase('2026-11-02')).toMatch(/^2026-11-0[12] \d\d:\d\d:\d\d\.\d{3}Z$/);
  });
  it('filters inclusively by local day, with open bounds', () => {
    const d = fromPocketBase('2026-11-02 12:00:00.000Z', false);
    expect(inRange('2026-11-02 12:00:00.000Z', d, d)).toBe(true);
    expect(inRange('2026-11-02 12:00:00.000Z', '', '')).toBe(true);
    expect(inRange('2026-11-02 12:00:00.000Z', '2026-11-03', '')).toBe(false);
    expect(inRange('2026-11-02 12:00:00.000Z', '', '2026-11-01')).toBe(false);
    expect(inRange('garbage', '', '')).toBe(false);
  });
});
