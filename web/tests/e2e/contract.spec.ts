import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { envelope } from './envelope';

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'); // colour codes from pino-pretty

const stackLogs = () =>
  execSync(
    'docker compose -f compose.yaml -f compose.dev.yaml logs web --no-log-prefix --since 2m',
    {
      cwd: '..',
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).replace(ANSI, '');

test.describe('every API response is { meta, data, traceId }', () => {
  const calls: [string, string, unknown?][] = [
    ['GET', '/api/auth/me'],
    ['POST', '/api/auth/login', { email: 'nobody@example.com', password: 'x' }],
    ['POST', '/api/auth/login', { nope: true }],
    ['POST', '/api/auth/register', { email: 'bad', password: 'x', name: '' }],
    ['POST', '/api/auth/verify', { token: 'short' }],
    ['POST', '/api/auth/resend', { email: 'nobody@example.com' }],
    ['POST', '/api/auth/forgot', { email: 'nobody@example.com' }],
    ['POST', '/api/auth/reset', { token: 'short', password: 'short' }],
    ['POST', '/api/auth/logout', {}],
    ['GET', '/api/search?q=rebuilt'],
    ['GET', '/api/search?q=a'],
    ['GET', '/api/comments?post=notanid'],
    ['GET', '/api/comments?post=abcdefghijklmno'],
    ['POST', '/api/comments', { post: 'abcdefghijklmno', body: 'x' }],
    ['DELETE', '/api/comments?id=abcdefghijklmno'],
    ['GET', '/api/interactions/abcdefghijklmno'],
    ['POST', '/api/interactions/abcdefghijklmno', { kind: 'like' }],
    ['GET', '/api/bookmarks'],
    ['DELETE', '/api/account', {}],
    ['POST', '/api/subscribe', { email: 'not-an-email' }],
    ['POST', '/api/admin/preview', { markdown: 'x' }],
    ['GET', '/api/admin/pb/api/collections/posts/records'],
  ];

  for (const [method, path, data] of calls) {
    test(`${method} ${path} ${JSON.stringify(data ?? '')}`, async ({ request }) => {
      const res = await request.fetch(path, {
        method,
        data,
        headers: data ? { 'content-type': 'application/json' } : {},
      });
      const body = await envelope(res);
      expect(body.meta.code).not.toBe('');
      if (res.status() >= 400) expect(body.data).toBeNull();
    });
  }

  test('cross-site blocks and unknown JSON bodies are enveloped too', async ({ request }) => {
    const blocked = await request.post('/api/comments', {
      data: {},
      headers: { origin: 'https://evil.example' },
    });
    expect((await envelope(blocked)).meta.code).toBe('cross_site_blocked');
  });

  test('a valid inbound x-trace-id is reused; junk is replaced', async ({ request }) => {
    const mine = '0192a000-0000-7000-8000-00000000abcd';
    const echoed = await envelope(
      await request.get('/api/auth/me', { headers: { 'x-trace-id': mine } }),
    );
    expect(echoed.traceId).toBe(mine);
    const replaced = await envelope(
      await request.get('/api/auth/me', { headers: { 'x-trace-id': 'not-a-uuid {"level":60}' } }),
    );
    expect(replaced.traceId).not.toContain('level');
  });

  test('pages and assets carry x-trace-id too', async ({ request }) => {
    for (const path of [
      '/',
      '/blog',
      '/sitemap.xml',
      '/robots.txt',
      '/og/en/default.png',
      '/does-not-exist',
    ]) {
      const res = await request.get(path);
      expect(res.headers()['x-trace-id'], path).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  test('PocketBase hook endpoints use the same envelope', async ({ request }) => {
    const res = await request.post('/pb/api/subscribers/confirm', { data: { token: 'x' } });
    const body = await envelope(res);
    expect(body.meta.code).toBe('invalid_token');
    const view = await request.post('/pb/api/views/english-only', {
      headers: { 'user-agent': 'Mozilla/5.0 Firefox/130' },
    });
    expect((await envelope(view)).meta.status).toBe(200);
  });

  test('the traceId in a response finds its request in the server logs', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'trace-me@example.com', password: 'wrong-password-1' },
    });
    const { traceId } = await envelope(res);
    await new Promise((r) => setTimeout(r, 500));
    const logs = stackLogs();
    const lines = logs.split('\n').filter((l) => l.includes(traceId));
    expect(lines.length, 'log lines for the traceId').toBeGreaterThanOrEqual(2);
    const text = lines.join('\n');
    expect(text).toContain('login failed');
    expect(text).toContain('POST /api/auth/login → 401');
    expect(logs).not.toContain('wrong-password-1'); // never log passwords
    expect(logs).not.toContain('trace-me@example.com'); // emails are masked
    expect(logs).toContain('t***@example.com');
  });
});

test.describe('regression: the UI reacts to sign-up', () => {
  test('registering shows the "check your inbox" message and keeps it on screen', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.fill('input[name=name]', 'UI Tester');
    await page.fill('input[name=email]', `ui-${Date.now()}@example.com`);
    await page.fill('input[name=password]', 'a-long-password-123');
    await page.click('button[type=submit]');
    const msg = page.locator('[data-msg]');
    await expect(msg).toContainText('Check your inbox');
    await expect(msg).toHaveAttribute('data-kind', 'ok');
    await page.waitForTimeout(1200); // the router must not swap the page out from under the message
    await expect(msg).toContainText('Check your inbox');
    expect(new URL(page.url()).pathname).toBe('/register');
  });

  test('an unverified user who signs in sees why, with a resend option', async ({ page }) => {
    const email = `unv-${Date.now()}@example.com`;
    await page.request.post('/api/auth/register', {
      data: { email, password: 'a-long-password-123', name: 'Unv' },
    });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'a-long-password-123');
    await page.click('button[type=submit]');
    await expect(page.locator('[data-msg]')).toContainText('verify your email');
    await expect(page.locator('[data-resend]')).toBeVisible();
  });
});
