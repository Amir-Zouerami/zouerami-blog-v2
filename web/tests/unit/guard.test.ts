import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { issueChallenge, verifyGuard } from '../../src/lib/guard';
import { solve } from '../../src/lib/sha256-pow';

const SECRET = 'x'.repeat(40);
const BITS = 12; // low in tests so they stay fast

const fresh = (now = Date.now()) => {
  const { challenge } = issueChallenge(now, SECRET);
  const n = solve(`${challenge}:`, BITS);
  return { challenge, n, token: `${challenge}~${n}` };
};
const opts = (now = Date.now()) => ({ now, secret: SECRET, bits: BITS });

describe('proof of work', () => {
  it('browser solver and node SHA-256 agree', () => {
    for (const prefix of [
      'a:',
      `${'x'.repeat(40)}:`,
      `${'Z'.repeat(70)}:`,
      `${'k'.repeat(100)}:`,
      `${'q'.repeat(127)}:`,
    ]) {
      const n = solve(prefix, 10);
      const digest = createHash('sha256').update(`${prefix}${n}`).digest();
      const first = digest.readUInt32BE(0);
      expect(Math.clz32(first)).toBeGreaterThanOrEqual(10);
    }
  });
  it('returns -1 when no solution is in the chunk', () => {
    expect(solve('p:', 40, 0, 50)).toBe(-1);
  });
});

describe('verifyGuard', () => {
  it('accepts a solved, fresh challenge once', () => {
    const { token } = fresh();
    expect(verifyGuard(token, '', opts())).toBe(true);
    expect(verifyGuard(token, '', opts())).toBe(false); // replay
  });
  it('rejects a missing, malformed or unsolved token', () => {
    expect(verifyGuard(undefined, '', opts())).toBe(false);
    expect(verifyGuard('', '', opts())).toBe(false);
    expect(verifyGuard('nonsense', '', opts())).toBe(false);
    const { challenge } = fresh();
    expect(verifyGuard(`${challenge}~abc`, '', opts())).toBe(false);
    // a counter that does not solve it (find one that fails)
    let bad = 0;
    while (createHash('sha256').update(`${challenge}:${bad}`).digest()[0] === 0) bad++;
    expect(verifyGuard(`${challenge}~${bad}`, '', { ...opts(), bits: 20 })).toBe(false);
  });
  it('rejects a challenge signed with another secret or tampered with', () => {
    const other = issueChallenge(Date.now(), 'y'.repeat(40)).challenge;
    expect(verifyGuard(`${other}~${solve(`${other}:`, BITS)}`, '', opts())).toBe(false);
    const { token } = fresh();
    expect(verifyGuard(token.replace(/\d+\./, '9'), '', opts())).toBe(false);
  });
  it('rejects expired challenges', () => {
    const t0 = 1_000_000_000_000;
    const { token } = fresh(t0);
    expect(verifyGuard(token, '', opts(t0 + 16 * 60 * 1000))).toBe(false);
  });
  it('rejects when the hidden field is filled in', () => {
    const { token } = fresh();
    expect(verifyGuard(token, 'http://spam.example', opts())).toBe(false);
  });
});
