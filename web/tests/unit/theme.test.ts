import { describe, expect, it } from 'vitest';
import { applyTheme, readTheme } from '../../src/lib/theme';

const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('theme', () => {
  it('reads light only when stored', () => {
    expect(readTheme({ getItem: () => 'light' })).toBe('light');
    expect(readTheme({ getItem: () => null })).toBe('dark');
    expect(readTheme({ getItem: () => 'banana' })).toBe('dark');
  });
  it('falls back to dark when storage throws', () => {
    expect(readTheme(throwing)).toBe('dark');
  });
  it('applyTheme sets the attribute even if storage throws', () => {
    const root = { dataset: {} } as unknown as HTMLElement;
    expect(() => applyTheme('light', root, throwing)).not.toThrow();
    expect(root.dataset.theme).toBe('light');
  });
});
