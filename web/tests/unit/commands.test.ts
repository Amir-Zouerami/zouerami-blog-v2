import { describe, expect, it } from 'vitest';
import { filterCommands, STATIC_COMMANDS } from '../../src/lib/commands';

describe('filterCommands', () => {
  it('filters by label, case-insensitively', () => {
    expect(filterCommands(STATIC_COMMANDS, 'TH').map((c) => c.id)).toEqual(['theme']);
  });
  it('empty query returns everything in order', () => {
    expect(filterCommands(STATIC_COMMANDS, '').map((c) => c.id)).toEqual(
      STATIC_COMMANDS.map((c) => c.id),
    );
  });
  it('treats regex characters literally', () => {
    expect(filterCommands(STATIC_COMMANDS, '(')).toEqual([]);
  });
});
