import { isAction, type MenuEntry } from './types';

/** Drops hidden entries and tidies separators/labels so a menu never starts, ends or doubles up with dividers. */
export function normalize(entries: MenuEntry[]): MenuEntry[] {
  const visible = entries.filter((e) => !(isAction(e) && e.hidden));
  const out: MenuEntry[] = [];
  for (let i = 0; i < visible.length; i++) {
    const e = visible[i] as MenuEntry;
    if (e.type === 'separator') {
      const prev = out[out.length - 1];
      if (!prev || prev.type === 'separator') continue; // leading or doubled
      out.push(e);
    } else if (e.type === 'label') {
      const next = visible[i + 1];
      if (!next || next.type === 'separator' || next.type === 'label') continue; // heading with nothing under it
      out.push(e);
    } else {
      out.push(e);
    }
  }
  while (out.length && out[out.length - 1]?.type === 'separator') out.pop();
  return out;
}

/** Next enabled index moving `dir` steps through a ring; -1 when nothing is enabled. */
export function cycle(current: number, dir: 1 | -1, enabled: boolean[]): number {
  const n = enabled.length;
  if (!enabled.some(Boolean)) return -1;
  let i = current;
  for (let step = 0; step < n; step++) {
    i = (i + dir + n) % n;
    if (enabled[i]) return i;
  }
  return -1;
}

export const firstEnabled = (enabled: boolean[]): number => enabled.findIndex(Boolean);
export const lastEnabled = (enabled: boolean[]): number => enabled.lastIndexOf(true);

/** Type-to-jump: the next enabled item (after `from`, wrapping) whose label starts with `buffer`. */
export function typeaheadFind(
  labels: string[],
  enabled: boolean[],
  buffer: string,
  from: number,
): number {
  const q = buffer.toLowerCase();
  if (!q) return -1;
  const n = labels.length;
  // a repeated single letter ("ccc") cycles through items starting with that letter
  const cyclic = q.length > 1 && [...q].every((c) => c === q[0]);
  const needle = cyclic ? (q[0] as string) : q;
  const start = cyclic || q.length === 1 ? from + 1 : Math.max(from, 0);
  for (let step = 0; step < n; step++) {
    const i = (((start + step) % n) + n) % n;
    if (enabled[i] && (labels[i] ?? '').toLowerCase().startsWith(needle)) return i;
  }
  return -1;
}
