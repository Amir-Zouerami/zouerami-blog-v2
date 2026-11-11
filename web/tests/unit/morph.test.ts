import { describe, expect, it } from 'vitest';
import { morphSettings } from '../../src/components/HeroName';

const wght = (s: string) => Number(/'wght' (\d+)/.exec(s)?.[1]);

describe('morphSettings', () => {
  it('is heaviest at the pointer and relaxed at/after the radius', () => {
    expect(morphSettings(0)).toBe("'wght' 800, 'wdth' 78");
    expect(morphSettings(300)).toBe("'wght' 250, 'wdth' 100");
    expect(morphSettings(9999)).toBe("'wght' 250, 'wdth' 100");
  });
  it('is monotonic in between', () => {
    expect(wght(morphSettings(50))).toBeGreaterThan(wght(morphSettings(150)));
    expect(wght(morphSettings(150))).toBeGreaterThan(wght(morphSettings(250)));
  });
});
