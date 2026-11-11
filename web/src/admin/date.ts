/** Date helpers for the back office. "Local" strings are `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` in the user's time zone. */

const pad = (n: number) => String(n).padStart(2, '0');

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
/** Weeks start on Monday. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface Parts {
  year: number;
  /** 0-based */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Parses a local string; null when empty or invalid (including impossible dates such as 2026-02-31). */
export function parseLocal(v: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(v);
  if (!m) return null;
  const [year, month, day, hour, minute] = [
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
  ] as const;
  const d = new Date(year, month, day, hour, minute);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day ||
    hour > 23 ||
    minute > 59
  )
    return null;
  return { year, month, day, hour, minute };
}

export function formatLocal(p: Parts, withTime: boolean): string {
  const date = `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
  return withTime ? `${date}T${pad(p.hour)}:${pad(p.minute)}` : date;
}

/** "11 Nov 2026, 14:30" for display. */
export function display(v: string, withTime: boolean): string {
  const p = parseLocal(v);
  if (!p) return '';
  const date = `${p.day} ${MONTHS[p.month]?.slice(0, 3)} ${p.year}`;
  return withTime ? `${date}, ${pad(p.hour)}:${pad(p.minute)}` : date;
}

/** The 6×7 grid (Monday first) of days shown for a month, including the leading/trailing days of neighbours. */
export function monthGrid(
  year: number,
  month: number,
): { year: number; month: number; day: number; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    };
  });
}

export function nowParts(): Parts {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

/** PocketBase stores UTC as "YYYY-MM-DD HH:mm:ss.SSSZ"; show it in local time. */
export function fromPocketBase(pbDate: string, withTime = true): string {
  if (!pbDate) return '';
  const d = new Date(pbDate.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return formatLocal(
    {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    },
    withTime,
  );
}

/** Local string → PocketBase's UTC format. Date-only values mean local midnight. */
export function toPocketBase(local: string): string {
  const p = parseLocal(local);
  const d = p ? new Date(p.year, p.month, p.day, p.hour, p.minute) : new Date();
  return d.toISOString().replace('T', ' ');
}

/** Inclusive date-range test on local calendar days; empty bounds are open. */
export function inRange(pbDate: string, from: string, to: string): boolean {
  const day = fromPocketBase(pbDate, false);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
