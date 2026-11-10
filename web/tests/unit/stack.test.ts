import { readFileSync } from 'node:fs';
import React from 'react';
import { describe, expect, it } from 'vitest';

describe('stack', () => {
  it('has react 19', () => {
    expect(React.version.startsWith('19.')).toBe(true);
  });
  it('tsconfig is strict', () => {
    const raw = readFileSync(new URL('../../tsconfig.json', import.meta.url), 'utf8');
    // astro's strict presets extend a base; accept either explicit strict or the strict preset
    expect(raw.includes('"strict": true') || raw.includes('astro/tsconfigs/strict')).toBe(true);
  });
});
