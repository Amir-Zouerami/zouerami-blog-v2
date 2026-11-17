import { describe, expect, it } from 'vitest';
import { isCrossSiteWrite } from '../../src/lib/csrf';
import { Lru } from '../../src/lib/lru';

describe('Lru', () => {
  it('evicts the least recently used entry', () => {
    const c = new Lru<number>(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // a is now fresher than b
    c.set('c', 3);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(c.size).toBe(2);
  });
  it('overwrites without growing', () => {
    const c = new Lru<number>(2);
    c.set('a', 1);
    c.set('a', 2);
    expect(c.size).toBe(1);
    expect(c.get('a')).toBe(2);
  });
});

describe('isCrossSiteWrite', () => {
  const hosts = ['localhost:8088', 'amir-zouerami.dev'];
  it('allows same-site writes (either the request host or the public host)', () => {
    expect(isCrossSiteWrite('POST', 'http://localhost:8088', hosts)).toBe(false);
    expect(isCrossSiteWrite('DELETE', 'https://amir-zouerami.dev', hosts)).toBe(false);
  });
  it('blocks writes from other origins and malformed origins', () => {
    expect(isCrossSiteWrite('POST', 'https://evil.example', hosts)).toBe(true);
    expect(isCrossSiteWrite('PATCH', 'https://amir-zouerami.dev.evil.example', hosts)).toBe(true);
    expect(isCrossSiteWrite('POST', 'null', hosts)).toBe(true);
  });
  it('never blocks reads or requests without an Origin header', () => {
    expect(isCrossSiteWrite('GET', 'https://evil.example', hosts)).toBe(false);
    expect(isCrossSiteWrite('POST', null, hosts)).toBe(false);
  });
});
