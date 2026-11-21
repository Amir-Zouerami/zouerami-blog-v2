/**
 * Keeps the editor and its preview at the same place in the text.
 *
 * The preview marks its blocks with `data-line` (the line of the source they came from), so the two panes are
 * tied together by a list of (source line, pixel position in the preview) anchors. Between two anchors the
 * position is interpolated, so a long paragraph, list or code block still scrolls in step.
 */
export interface Anchor {
  line: number;
  top: number;
}

/** Anchors in reading order, one per source line, with strictly increasing lines and non-decreasing tops. */
export function collectAnchors(scroller: HTMLElement, root: HTMLElement): Anchor[] {
  const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
  const found: Anchor[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('[data-line]')) {
    const line = Number(el.dataset.line);
    if (!Number.isFinite(line)) continue;
    found.push({ line, top: el.getBoundingClientRect().top - base });
  }
  return cleanAnchors(found);
}

export function cleanAnchors(found: Anchor[]): Anchor[] {
  found.sort((a, b) => a.line - b.line || a.top - b.top);
  const out: Anchor[] = [];
  for (const a of found) {
    const last = out[out.length - 1];
    if (last && a.line === last.line) continue; // an outer block and its first child start on the same line
    if (last && a.top < last.top) continue; // out of order (floats, odd layouts): ignore rather than jump
    out.push(a);
  }
  return out;
}

/** Pixel position in the preview for a (fractional) source line. */
export function topForLine(
  anchors: Anchor[],
  line: number,
  endLine: number,
  endTop: number,
): number {
  const pts: Anchor[] = [{ line: 1, top: 0 }, ...anchors, { line: endLine, top: endTop }];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as Anchor;
    const b = pts[i + 1] as Anchor;
    if (line >= a.line && line < b.line) {
      const f = (line - a.line) / (b.line - a.line);
      return a.top + f * (b.top - a.top);
    }
  }
  return line < 1 ? 0 : endTop;
}

/** Source line (fractional) shown at a pixel position in the preview. */
export function lineForTop(
  anchors: Anchor[],
  top: number,
  endLine: number,
  endTop: number,
): number {
  const pts: Anchor[] = [{ line: 1, top: 0 }, ...anchors, { line: endLine, top: endTop }];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as Anchor;
    const b = pts[i + 1] as Anchor;
    if (top >= a.top && top < b.top) {
      const f = b.top === a.top ? 0 : (top - a.top) / (b.top - a.top);
      return a.line + f * (b.line - a.line);
    }
  }
  return top < 0 ? 1 : endLine;
}
