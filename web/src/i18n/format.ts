import type { Locale } from './locale';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const faDigits = (s: string | number): string =>
  String(s).replace(/\d/g, (d) => FA_DIGITS[Number(d)] as string);

/** English: Gregorian ("2 Nov 2026"). Persian: Jalali with Persian digits ("۱۱ آبان ۱۴۰۵"). */
export function formatDate(iso: string, locale: Locale, long = false): string {
  const d = new Date(
    iso.includes('T') || iso.includes(' ') ? iso.replace(' ', 'T') : `${iso}T12:00:00Z`,
  );
  if (Number.isNaN(d.getTime())) return '';
  if (locale === 'fa') {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: 'numeric',
      month: long ? 'long' : 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: long ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n);
}
