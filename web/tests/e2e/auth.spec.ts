import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import PocketBase from 'pocketbase';

const compose = (cmd: string) =>
  execSync(`docker compose -f compose.yaml -f compose.dev.yaml ${cmd}`, {
    cwd: '..',
    stdio: 'pipe',
  });

const PB = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090';

async function waitForPb() {
  for (let i = 0; i < 60; i++) {
    if (
      await fetch(`${PB}/api/health`)
        .then((r) => r.ok)
        .catch(() => false)
    )
      return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('PocketBase did not come back');
}

const email = `e2e-${Date.now()}@example.com`;
const password = 'correct-horse-battery-1';
let userId = '';
let admin: PocketBase;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  admin = new PocketBase(PB);
  await admin
    .collection('_superusers')
    .authWithPassword(
      process.env.PB_SUPERUSER_EMAIL ?? '',
      process.env.PB_SUPERUSER_PASSWORD ?? '',
    );
  const u = await admin
    .collection('users')
    .create({ email, password, passwordConfirm: password, name: 'E2E User' });
  userId = u.id;
});

test.afterAll(async () => {
  try {
    compose('start pocketbase');
  } catch {}
  await waitForPb();
  if (userId)
    await admin
      .collection('users')
      .delete(userId)
      .catch(() => {});
});

test('anonymous /me is 401', async ({ request }) => {
  expect((await request.get('/api/auth/me')).status()).toBe(401);
});

test('wrong password is 401 and sets no cookie', async ({ request }) => {
  const res = await request.post('/api/auth/login', {
    data: { email, password: 'nope-nope-nope' },
  });
  expect(res.status()).toBe(401);
  expect(res.headers()['set-cookie']).toBeUndefined();
});

test('malformed body is 400', async ({ request }) => {
  expect((await request.post('/api/auth/login', { data: { email: 'x' } })).status()).toBe(400);
});

test('login sets an httpOnly JWT cookie; /me then works with PocketBase STOPPED', async ({
  request,
}) => {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  const cookie = res.headers()['set-cookie'] ?? '';
  expect(cookie).toMatch(/^session=[\w-]+\.[\w-]+\.[\w-]+/);
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=Lax/i);

  compose('stop pocketbase');
  const me = await request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect((await me.json()).user).toMatchObject({ id: userId, email, name: 'E2E User' });
  compose('start pocketbase');
  await waitForPb();
});

test('a forged cookie is rejected', async ({ playwright, baseURL }) => {
  const ctx = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { cookie: 'session=aaa.bbb.ccc' },
  });
  expect((await ctx.get('/api/auth/me')).status()).toBe(401);
});

test('logout clears the cookie', async ({ request }) => {
  await request.post('/api/auth/logout');
  expect((await request.get('/api/auth/me')).status()).toBe(401);
});
