import { describe, expect, it } from 'vitest';
import {
  faDigits,
  formatDate,
  localeFromPath,
  localePath,
  stripLocale,
  switchPath,
  ui,
} from '../../src/i18n';

describe('locale paths', () => {
  it('detects locale from the path', () => {
    expect(localeFromPath('/')).toBe('en');
    expect(localeFromPath('/blog/x')).toBe('en');
    expect(localeFromPath('/fa')).toBe('fa');
    expect(localeFromPath('/fa/blog/x')).toBe('fa');
    expect(localeFromPath('/fantasy')).toBe('en');
  });
  it('prefixes only Persian', () => {
    expect(localePath('en', '/blog')).toBe('/blog');
    expect(localePath('fa', '/blog')).toBe('/fa/blog');
    expect(localePath('fa', '/')).toBe('/fa');
    expect(localePath('fa', 'blog')).toBe('/fa/blog');
  });
  it('strips and switches', () => {
    expect(stripLocale('/fa')).toBe('/');
    expect(stripLocale('/fa/work/x')).toBe('/work/x');
    expect(stripLocale('/fantasy')).toBe('/fantasy');
    expect(switchPath('/blog/x', 'fa')).toBe('/fa/blog/x');
    expect(switchPath('/fa/blog/x', 'en')).toBe('/blog/x');
    expect(switchPath('/', 'fa')).toBe('/fa');
    expect(switchPath('/fa', 'en')).toBe('/');
  });
});

describe('dates', () => {
  it('formats English as Gregorian', () => {
    expect(formatDate('2026-11-02 12:00:00.000Z', 'en')).toBe('2 Nov 2026');
    expect(formatDate('2026-11-02', 'en', true)).toBe('2 November 2026');
  });
  it('formats Persian as Jalali with Persian digits', () => {
    // 2 Nov 2026 = 11 Aban 1405
    const s = formatDate('2026-11-02 12:00:00.000Z', 'fa', true);
    expect(s).toContain('۱۴۰۵');
    expect(s).toContain('آبان');
    expect(s).toContain('۱۱');
  });
  it('returns empty string for garbage', () => {
    expect(formatDate('nope', 'en')).toBe('');
  });
  it('converts digits', () => {
    expect(faDigits(2026)).toBe('۲۰۲۶');
  });
});

describe('dictionaries', () => {
  const keys = (o: unknown, p = ''): string[] =>
    typeof o === 'object' && o !== null && !Array.isArray(o)
      ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`))
      : [p];
  it('Persian has every key English has', () => {
    expect(keys(ui.fa).sort()).toEqual(keys(ui.en).sort());
  });
});
