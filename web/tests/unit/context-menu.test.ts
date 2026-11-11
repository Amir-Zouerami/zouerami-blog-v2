import { describe, expect, it } from 'vitest';
import {
  cycle,
  firstEnabled,
  lastEnabled,
  normalize,
  typeaheadFind,
} from '../../src/lib/context-menu/model';
import { placeMenu, placeSubmenu } from '../../src/lib/context-menu/placement';
import type { MenuEntry } from '../../src/lib/context-menu/types';

const VP = { w: 1000, h: 700 };
const SIZE = { w: 220, h: 300 };

describe('placeMenu', () => {
  it('opens down and to the right of the pointer when there is room', () => {
    expect(placeMenu({ x: 100, y: 100 }, SIZE, VP)).toEqual({
      left: 100,
      top: 100,
      originX: 'left',
      originY: 'top',
    });
  });
  it('flips left when it would overflow the right edge', () => {
    const p = placeMenu({ x: 900, y: 100 }, SIZE, VP);
    expect(p.left).toBe(900 - 220);
    expect(p.originX).toBe('right');
  });
  it('flips up when it would overflow the bottom edge', () => {
    const p = placeMenu({ x: 100, y: 600 }, SIZE, VP);
    expect(p.top).toBe(600 - 300);
    expect(p.originY).toBe('bottom');
  });
  it('flips both ways in the bottom-right corner and stays inside the viewport', () => {
    const p = placeMenu({ x: 995, y: 695 }, SIZE, VP);
    expect(p.left + SIZE.w).toBeLessThanOrEqual(VP.w - 8);
    expect(p.top + SIZE.h).toBeLessThanOrEqual(VP.h - 8);
    expect(p).toMatchObject({ originX: 'right', originY: 'bottom' });
  });
  it('clamps a menu taller than the viewport to the top margin', () => {
    expect(placeMenu({ x: 10, y: 400 }, { w: 200, h: 900 }, VP).top).toBe(8);
  });
  it('mirrors in right-to-left pages (opens toward the inline end = left)', () => {
    expect(placeMenu({ x: 500, y: 100 }, SIZE, VP, true)).toMatchObject({
      left: 500 - 220,
      originX: 'right',
    });
    expect(placeMenu({ x: 100, y: 100 }, SIZE, VP, true).left).toBeGreaterThanOrEqual(8); // flips to the right near the left edge
  });
  it('never leaves the viewport for any click position', () => {
    for (let x = 0; x <= VP.w; x += 37) {
      for (let y = 0; y <= VP.h; y += 41) {
        for (const rtl of [false, true]) {
          const p = placeMenu({ x, y }, SIZE, VP, rtl);
          expect(p.left).toBeGreaterThanOrEqual(8);
          expect(p.top).toBeGreaterThanOrEqual(8);
          expect(p.left + SIZE.w).toBeLessThanOrEqual(VP.w - 8);
          expect(p.top + SIZE.h).toBeLessThanOrEqual(VP.h - 8);
        }
      }
    }
  });
});

describe('placeSubmenu', () => {
  const anchor = { left: 100, right: 320, top: 200, bottom: 232 };
  it('opens beside the parent, overlapping its edge slightly', () => {
    expect(placeSubmenu(anchor, { w: 200, h: 150 }, VP)).toMatchObject({
      left: 316,
      top: 194,
      originX: 'left',
    });
  });
  it('flips to the other side when the end side has no room', () => {
    const near = { left: 700, right: 920, top: 200, bottom: 232 };
    const p = placeSubmenu(near, { w: 200, h: 150 }, VP);
    expect(p.left).toBe(700 - 200 + 4);
    expect(p.originX).toBe('right');
  });
  it('slides up to stay on screen and mirrors in RTL', () => {
    const low = { left: 100, right: 320, top: 650, bottom: 682 };
    expect(placeSubmenu(low, { w: 200, h: 150 }, VP).top).toBe(700 - 150 - 8);
    expect(
      placeSubmenu({ left: 500, right: 720, top: 100, bottom: 132 }, { w: 200, h: 100 }, VP, true)
        .left,
    ).toBe(500 - 200 + 4);
  });
});

describe('normalize', () => {
  const item = (id: string, extra: object = {}): MenuEntry => ({ id, label: id, ...extra });
  const sep: MenuEntry = { type: 'separator' };
  const ids = (es: MenuEntry[]) =>
    es.map((e) => (e.type === 'separator' ? '-' : e.type === 'label' ? `#${e.label}` : e.id));

  it('removes hidden entries and tidies the dividers around them', () => {
    expect(ids(normalize([item('a'), sep, item('b', { hidden: true }), sep, item('c')]))).toEqual([
      'a',
      '-',
      'c',
    ]);
  });
  it('drops leading, trailing and doubled separators', () => {
    expect(ids(normalize([sep, sep, item('a'), sep, sep, item('b'), sep]))).toEqual([
      'a',
      '-',
      'b',
    ]);
  });
  it('drops headings that would have nothing under them', () => {
    expect(
      ids(
        normalize([{ type: 'label', label: 'X' }, sep, item('a'), { type: 'label', label: 'Y' }]),
      ),
    ).toEqual(['a']);
    expect(ids(normalize([{ type: 'label', label: 'X' }, item('a')]))).toEqual(['#X', 'a']);
  });
  it('is empty when everything is hidden', () => {
    expect(normalize([item('a', { hidden: true }), sep])).toEqual([]);
  });
});

describe('keyboard model', () => {
  it('cycle skips disabled rows and wraps', () => {
    const en = [true, false, true, true];
    expect(cycle(0, 1, en)).toBe(2);
    expect(cycle(3, 1, en)).toBe(0);
    expect(cycle(0, -1, en)).toBe(3);
    expect(cycle(2, -1, en)).toBe(0);
    expect(cycle(-1, 1, en)).toBe(0);
  });
  it('cycle returns -1 when nothing is enabled', () => {
    expect(cycle(0, 1, [false, false])).toBe(-1);
    expect(firstEnabled([false, false])).toBe(-1);
  });
  it('first/last enabled', () => {
    expect(firstEnabled([false, true, true, false])).toBe(1);
    expect(lastEnabled([false, true, true, false])).toBe(2);
  });
  it('typeahead jumps to the next label that starts with the typed text', () => {
    const labels = ['Copy', 'Cut', 'Paste', 'Select all'];
    const en = [true, true, true, true];
    expect(typeaheadFind(labels, en, 'p', 0)).toBe(2);
    expect(typeaheadFind(labels, en, 'c', 0)).toBe(1); // next "c…" after the current one
    expect(typeaheadFind(labels, en, 'c', 1)).toBe(0); // wraps
    expect(typeaheadFind(labels, en, 'cu', 0)).toBe(1); // multi-letter prefixes narrow down
    expect(typeaheadFind(labels, en, 'z', 0)).toBe(-1);
  });
  it('typeahead ignores disabled items and case', () => {
    expect(typeaheadFind(['Alpha', 'alpine'], [false, true], 'AL', 0)).toBe(1);
    expect(typeaheadFind(['A'], [true], '', 0)).toBe(-1);
  });
});
