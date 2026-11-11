import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { created, EnvelopeSchema, fail, ok, readJson, TRACE_HEADER } from '../../src/lib/api';
import { api, describe as describeResult, parseEnvelope } from '../../src/lib/client-api';
import { buildLogger, maskEmail, runWithContext } from '../../src/lib/log';
import { isUuid, uuidv7 } from '../../src/lib/uuid7';

const bodyOf = async (res: Response) => EnvelopeSchema.parse(await res.json());

describe('uuidv7', () => {
  it('is a valid RFC 9562 version-7 UUID', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isUuid(id)).toBe(true);
  });
  it('encodes the millisecond timestamp in the first 48 bits and sorts by time', () => {
    const t = Date.UTC(2026, 10, 11, 12, 0, 0);
    const a = uuidv7(t);
    const b = uuidv7(t + 1);
    expect(Number.parseInt(a.replace(/-/g, '').slice(0, 12), 16)).toBe(t);
    expect(a.slice(0, 13) < b.slice(0, 13)).toBe(true);
  });
  it('does not collide', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => uuidv7()));
    expect(ids.size).toBe(5000);
  });
  it('isUuid rejects junk and log-injection attempts', () => {
    for (const bad of [
      '',
      'abc',
      '0192a000-0000-7000-8000-00000000000g',
      'x\n{"level":50}',
      null,
      undefined,
    ]) {
      expect(isUuid(bad as string)).toBe(false);
    }
  });
});

describe('response envelope { meta, data, traceId }', () => {
  const inContext = <T>(fn: () => T) =>
    runWithContext(
      { traceId: '0192a000-0000-7000-8000-000000000001', log: buildLogger({ write() {} }) },
      fn,
    );

  it('success: meta, data and the request traceId, mirrored in the header', async () => {
    const res = inContext(() => ok({ hello: 'world' }));
    const body = await bodyOf(res);
    expect(body).toEqual({
      meta: { status: 200, code: 'ok' },
      data: { hello: 'world' },
      traceId: '0192a000-0000-7000-8000-000000000001',
    });
    expect(res.headers.get(TRACE_HEADER)).toBe(body.traceId);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
  it('created uses 201 and code "created"', async () => {
    const res = inContext(() => created({ id: 'x' }));
    expect(res.status).toBe(201);
    expect((await bodyOf(res)).meta).toMatchObject({ status: 201, code: 'created' });
  });
  it('failure: data is null, code and message present, fields optional', async () => {
    const res = inContext(() =>
      fail(400, 'validation_failed', 'Bad input.', { email: 'Invalid email' }),
    );
    const body = await bodyOf(res);
    expect(res.status).toBe(400);
    expect(body.data).toBeNull();
    expect(body.meta).toEqual({
      status: 400,
      code: 'validation_failed',
      message: 'Bad input.',
      fields: { email: 'Invalid email' },
    });
  });
  it('outside a request a fresh UUIDv7 is generated', async () => {
    const body = await bodyOf(ok(null));
    expect(isUuid(body.traceId)).toBe(true);
  });
  it('readJson turns validation problems into a ready 400 envelope with per-field messages', async () => {
    const schema = z.object({ email: z.email(), n: z.number() });
    const req = (body: unknown) =>
      new Request('http://x', {
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    expect((await readJson(req({ email: 'a@b.co', n: 1 }), schema)).ok).toBe(true);
    const bad = await readJson(req({ email: 'nope', n: 'x' }), schema, 'Check the form.');
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      const body = await bodyOf(bad.response);
      expect(body.meta).toMatchObject({
        status: 400,
        code: 'validation_failed',
        message: 'Check the form.',
      });
      expect(Object.keys(body.meta.fields ?? {}).sort()).toEqual(['email', 'n']);
    }
    const empty = await readJson(req('not json'), schema);
    if (!empty.ok) expect((await bodyOf(empty.response)).meta.fields).toHaveProperty('body');
  });
});

describe('browser client', () => {
  it('parses the envelope into one result shape', () => {
    const r = parseEnvelope<{ a: number }>(
      200,
      { meta: { status: 200, code: 'ok', message: 'Done' }, data: { a: 1 }, traceId: 't1' },
      null,
    );
    expect(r).toMatchObject({
      ok: true,
      status: 200,
      code: 'ok',
      message: 'Done',
      data: { a: 1 },
      traceId: 't1',
    });
    const e = parseEnvelope(
      401,
      {
        meta: { status: 401, code: 'unauthorized', fields: { x: 'y' } },
        data: null,
        traceId: 't2',
      },
      null,
    );
    expect(e).toMatchObject({ ok: false, code: 'unauthorized', fields: { x: 'y' }, traceId: 't2' });
  });
  it('tolerates bodies that are not the envelope (proxy error pages)', () => {
    const r = parseEnvelope(502, '<html>Bad Gateway</html>', 'hdr-trace');
    expect(r).toMatchObject({ ok: false, status: 502, code: 'bad_response', traceId: 'hdr-trace' });
  });
  it('reports network failures instead of throwing', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(await api('/x')).toMatchObject({ ok: false, status: 0, code: 'network_error' });
    } finally {
      globalThis.fetch = original;
      console.warn = warn;
    }
  });
  it('describe adds a short reference only for server-side failures', () => {
    const base = {
      ok: false,
      code: 'x',
      message: 'Nope',
      fields: {},
      data: null,
      traceId: '0192a000-0000-7000-8000-0000deadbeef',
    };
    expect(describeResult({ ...base, status: 400 }, 'fallback')).toBe('Nope');
    expect(describeResult({ ...base, status: 503 }, 'fallback')).toBe('Nope (ref deadbeef)');
    expect(describeResult({ ...base, status: 400, message: '' }, 'fallback')).toBe('fallback');
  });
});

describe('logging', () => {
  const capture = () => {
    const lines: string[] = [];
    return { lines, log: buildLogger({ write: (c: string) => void lines.push(c) }) };
  };
  it('masks emails', () => {
    expect(maskEmail('amir@example.com')).toBe('a***@example.com');
  });
  it('writes JSON lines with the bound traceId', () => {
    const { lines, log } = capture();
    log.child({ traceId: 'abc' }).info({ userId: 'u1' }, 'hello');
    const line = JSON.parse(lines[0] ?? '{}');
    expect(line).toMatchObject({
      level: 30,
      msg: 'hello',
      traceId: 'abc',
      userId: 'u1',
      service: 'web',
    });
  });
  it('never logs passwords, tokens or cookies, at any depth we use', () => {
    const { lines, log } = capture();
    log.info(
      {
        password: 'hunter2',
        body: { password: 'hunter3', token: 'tok', turnstile: 'cf' },
        headers: { cookie: 'session=abc', authorization: 'Bearer x' },
      },
      'x',
    );
    const out = lines.join('');
    for (const secret of ['hunter2', 'hunter3', '"tok"', 'session=abc', 'Bearer x', '"cf"'])
      expect(out).not.toContain(secret);
    expect(out).toContain('[redacted]');
  });
  it('serialises errors with their stack', () => {
    const { lines, log } = capture();
    log.error({ err: new Error('boom') }, 'failed');
    expect(JSON.parse(lines[0] ?? '{}').err).toMatchObject({ type: 'Error', message: 'boom' });
  });
});
