import { describe, expect, it } from 'vitest';
import { METRIC_ICONS, metricIcon } from '../../src/lib/metricIcons';

describe('highlight number icons', () => {
  it('knows its own names and nothing else', () => {
    expect(metricIcon('star')?.label).toBe('Stars');
    for (const bad of ['', undefined, 'nope', 'toString', '__proto__'])
      expect(metricIcon(bad)).toBeNull();
  });
  it('every drawing is path data with a label', () => {
    for (const [label, path] of Object.values(METRIC_ICONS)) {
      expect(label).toBeTruthy();
      expect(path).toMatch(/^M[0-9MmLlHhVvCcSsAaZz .,-]+$/);
    }
  });
});
