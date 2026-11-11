import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import PocketBase from 'pocketbase';

const compose = (cmd: string) =>
  execSync(`docker compose -f compose.yaml -f compose.dev.yaml ${cmd}`, {
    cwd: '..',
    stdio: 'pipe',
  });

const PB = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090';

// The PocketBase entrypoint re-saves the superuser on every boot, which invalidates old admin tokens.
async function adminLogin() {
  await admin
    .collection('_superusers')
    .authWithPassword(
      process.env.PB_SUPERUSER_EMAIL ?? '',
      process.env.PB_SUPERUSER_PASSWORD ?? '',
    );
}

async function waitForPb() {
  for (let i = 0; i < 60; i++) {
    if (
      await fetch(`${PB}/api/health`)
        .then((r) => r.ok)
        .catch(() => false)
    ) {
      await adminLogin();
      return;
    }
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
  admin.autoCancellation(false);
  await admin
    .collection('_superusers')
    .authWithPassword(
      process.env.PB_SUPERUSER_EMAIL ?? '',
      process.env.PB_SUPERUSER_PASSWORD ?? '',
    );
  const u = await admin
    .collection('users')
    .create({ email, password, passwordConfirm: password, name: 'E2E User', verified: true });
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
  const cookie =
    res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
      .find((v) => v.startsWith('session=')) ?? '';
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

const cookieValue = (res: { headersArray(): { name: string; value: string }[] }, name: string) =>
  res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value)
    .find((v) => v.startsWith(`${name}=`))
    ?.split(';')[0]
    ?.slice(name.length + 1);

test('with only the refresh cookie, /me re-issues a short-lived access cookie via PocketBase', async ({
  playwright,
  baseURL,
}) => {
  const login = await (await playwright.request.newContext({ baseURL })).post('/api/auth/login', {
    data: { email, password },
  });
  const refresh = cookieValue(login, 'refresh');
  expect(refresh).toBeTruthy();
  expect(login.headers()['set-cookie']).toMatch(/Max-Age=600\b/);

  const ctx = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { cookie: `refresh=${refresh}` },
  });
  const me = await ctx.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect(cookieValue(me, 'session')).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
});

test('refresh fails once the user is deleted (revocation within one access-token lifetime)', async ({
  playwright,
  baseURL,
}) => {
  const tmpEmail = `e2e-rev-${Date.now()}@example.com`;
  const tmp = await admin
    .collection('users')
    .create({ email: tmpEmail, password, passwordConfirm: password, name: 'Temp', verified: true });
  const login = await (await playwright.request.newContext({ baseURL })).post('/api/auth/login', {
    data: { email: tmpEmail, password },
  });
  const refresh = cookieValue(login, 'refresh');
  await admin.collection('users').delete(tmp.id);

  const ctx = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { cookie: `refresh=${refresh}` },
  });
  const me = await ctx.get('/api/auth/me');
  expect(me.status()).toBe(401);
  expect(me.headers()['set-cookie']).toMatch(
    /refresh=deleted; Path=\/api; Expires=Thu, 01 Jan 1970/,
  );
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
