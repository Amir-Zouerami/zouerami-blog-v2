export interface Paged<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

/** Parses `?page=` leniently: anything that is not a positive integer is page 1. */
export function pageParam(raw: string | null | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** One page of `items` (1-based); a page past the end is clamped to the last one. */
export function paginate<T>(items: T[], page: number, size: number): Paged<T> {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((p - 1) * size, p * size), page: p, pages, total: items.length };
}

/** Page numbers to show: first, last, and a window around the current page, with '…' for the gaps. */
export function pageWindow(page: number, pages: number, around = 1): (number | '…')[] {
  const keep = new Set([1, pages, page]);
  for (let i = 1; i <= around; i++) {
    keep.add(page - i);
    keep.add(page + i);
  }
  const nums = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => {
    const prev = nums[i - 1];
    if (prev !== undefined && n - prev > 1) out.push(n - prev === 2 ? n - 1 : '…');
    out.push(n);
  });
  return out;
}
