import { describe, expect, it } from 'vitest';
import { cleanAnchors, lineForTop, topForLine } from '../../src/admin/scrollSync';
import { renderMarkdown } from '../../src/lib/markdown';

const anchors = cleanAnchors([
  { line: 3, top: 100 },
  { line: 3, top: 100 },
  { line: 10, top: 300 },
  { line: 20, top: 700 },
]);

describe('scroll sync', () => {
  it('keeps one anchor per line, in order', () => {
    expect(anchors.map((a) => a.line)).toEqual([3, 10, 20]);
  });
  it('interpolates between anchors and is its own inverse', () => {
    expect(topForLine(anchors, 10, 31, 1000)).toBe(300);
    expect(topForLine(anchors, 15, 31, 1000)).toBe(500);
    expect(lineForTop(anchors, 500, 31, 1000)).toBe(15);
    for (const l of [1, 2.5, 6, 12, 19.5, 25]) {
      expect(lineForTop(anchors, topForLine(anchors, l, 31, 1000), 31, 1000)).toBeCloseTo(l, 5);
    }
  });
  it('covers the start and the end of the page', () => {
    expect(topForLine(anchors, 1, 31, 1000)).toBe(0);
    expect(topForLine(anchors, 31, 31, 1000)).toBe(1000);
  });
});

describe('data-line markers', () => {
  const opts = { resolveImage: (n: string) => n };
  it('are only added when asked for, and point at the typed line', async () => {
    const md = '# a\n\npara\n\n$$x^2$$\n\n- one\n- two\n';
    const off = await renderMarkdown(md, opts);
    expect(off.html).not.toContain('data-line');
    const on = await renderMarkdown(md, { ...opts, sourceLines: true });
    expect(on.html).toContain('data-line="3"'); // the paragraph
    expect(on.html).toContain('data-line="7"'); // the list, after the formula's extra lines
    expect(on.html).toContain('data-line="8"'); // its second item
  });
});
