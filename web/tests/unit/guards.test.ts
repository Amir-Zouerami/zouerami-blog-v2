import type { APIContext } from 'astro';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '../../src/lib/auth/guards';
import { adminOnly, authed } from '../../src/lib/auth/guards';

// the guard only reads locals.user and the PocketBase token cookie
const ctx = (user: unknown, token?: string) =>
  ({
    locals: { user },
    cookies: {
      get: (name: string) => (name === 'refresh' && token ? { value: token } : undefined),
    },
  }) as unknown as APIContext;

const ok = vi.fn(async (_ctx: APIContext, _session: Session) => new Response('ok'));

beforeAll(() => {
  vi.stubEnv('PB_URL', 'http://pb:8090');
  vi.stubEnv('PB_PUBLIC_URL', '/pb');
  vi.stubEnv('SITE_URL', 'http://localhost:8088');
  vi.stubEnv('AUTH_SECRET', 'x'.repeat(40));
});

describe('route guards', () => {
  it('authed: 401 when anonymous, 401 when the PocketBase token cookie is missing, runs the handler otherwise', async () => {
    const route = authed(ok);
    expect((await route(ctx(null, 't'))).status).toBe(401);
    expect((await route(ctx({ id: 'u', role: 'user' }))).status).toBe(401);
    expect(ok).not.toHaveBeenCalled();
    const res = await route(ctx({ id: 'u', role: 'user' }, 'tok'));
    expect(res.status).toBe(200);
    expect(ok).toHaveBeenCalledOnce();
    const session = ok.mock.calls[0]?.[1];
    expect(session?.user.id).toBe('u');
    expect(session?.token).toBe('tok');
  });
  it('adminOnly: 403 for normal users, passes admins', async () => {
    ok.mockClear();
    const route = adminOnly(ok);
    expect((await route(ctx({ id: 'u', role: 'user' }, 't'))).status).toBe(403);
    expect(ok).not.toHaveBeenCalled();
    expect((await route(ctx({ id: 'a', role: 'admin' }, 't'))).status).toBe(200);
  });
});
