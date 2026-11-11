import { expect, test } from '@playwright/test';
import PocketBase from 'pocketbase';

const PB = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090';
const MAIL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025';
const stamp = Date.now();
const email = `acct-${stamp}@example.com`;
const password = 'correct-horse-battery-2';
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
});

async function mailTo(to: string, subjectPart: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = (await (await fetch(`${MAIL}/api/v1/messages`)).json()) as {
      messages: { ID: string; To: { Address: string }[]; Subject: string }[];
    };
    const m = list.messages.find(
      (x) => x.To.some((t) => t.Address === to) && x.Subject.includes(subjectPart),
    );
    if (m)
      return ((await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()) as { HTML: string })
        .HTML;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no mail to ${to} (${subjectPart})`);
}
const linkIn = (html: string, part: string) => {
  const m = new RegExp(`href="([^"]*${part}[^"]*)"`).exec(html);
  if (!m?.[1]) throw new Error(`no ${part} link`);
  return m[1].replace(/&amp;/g, '&');
};

test('register → cannot sign in unverified → verify by email → sign in', async ({
  request,
  page,
}) => {
  const reg = await request.post('/api/auth/register', {
    data: { email, password, name: 'Acct Tester' },
  });
  expect(reg.status()).toBe(201);
  // duplicate registration looks identical (no enumeration)
  expect(
    (await request.post('/api/auth/register', { data: { email, password, name: 'Dup' } })).status(),
  ).toBe(201);
  const bad = await request.post('/api/auth/register', {
    data: { email: `x${stamp}@example.com`, password: 'short', name: 'X' },
  });
  expect(bad.status()).toBe(400);

  const login1 = await request.post('/api/auth/login', { data: { email, password } });
  expect(login1.status()).toBe(403);
  expect((await login1.json()).code).toBe('unverified');

  const html = await mailTo(email, 'Verify');
  const link = linkIn(html, '/verify');
  expect(link).toContain('http://localhost:8088/verify?token=');
  await page.goto(link);
  await expect(page.locator('[data-result]')).toContainText('Email verified', { timeout: 10000 });
  expect((await request.post('/api/auth/login', { data: { email, password } })).status()).toBe(200);
});

test('forgot → reset password by email → old password stops working', async ({ request }) => {
  expect(
    (await request.post('/api/auth/forgot', { data: { email: 'nobody@example.com' } })).status(),
  ).toBe(204);
  expect((await request.post('/api/auth/forgot', { data: { email } })).status()).toBe(204);
  const link = linkIn(await mailTo(email, 'Reset'), '/reset');
  const token = new URL(link).searchParams.get('token');
  const fresh = 'brand-new-password-3';
  expect(
    (await request.post('/api/auth/reset', { data: { token, password: 'short' } })).status(),
  ).toBe(400);
  expect(
    (await request.post('/api/auth/reset', { data: { token, password: fresh } })).status(),
  ).toBe(200);
  expect((await request.post('/api/auth/login', { data: { email, password } })).status()).toBe(401);
  expect(
    (await request.post('/api/auth/login', { data: { email, password: fresh } })).status(),
  ).toBe(200);
});

test('likes, bookmarks, comments (first held, then approved) as a signed-in user', async ({
  request,
  page,
}) => {
  const pw = 'brand-new-password-3';
  expect((await request.post('/api/auth/login', { data: { email, password: pw } })).status()).toBe(
    200,
  );
  const post = await admin.collection('posts').getFirstListItem('slug = "english-only"');

  // anonymous cannot write
  const anon = await page.request.post(`/api/interactions/${post.id}`, {
    data: { kind: 'like' },
    headers: { cookie: '' },
  });
  expect(anon.status()).toBe(401);

  const before = (await (await request.get(`/api/interactions/${post.id}`)).json()) as {
    likes: number;
  };
  const liked = (await (
    await request.post(`/api/interactions/${post.id}`, { data: { kind: 'like' } })
  ).json()) as { likes: number; liked: boolean };
  expect(liked).toMatchObject({ liked: true, likes: before.likes + 1 });
  const unliked = (await (
    await request.post(`/api/interactions/${post.id}`, { data: { kind: 'like' } })
  ).json()) as { likes: number; liked: boolean };
  expect(unliked).toMatchObject({ liked: false, likes: before.likes });
  const saved = (await (
    await request.post(`/api/interactions/${post.id}`, { data: { kind: 'bookmark' } })
  ).json()) as { bookmarked: boolean };
  expect(saved.bookmarked).toBe(true);
  const bm = (await (await request.get('/api/bookmarks?lang=en')).json()) as {
    bookmarks: { slug: string }[];
  };
  expect(bm.bookmarks.map((b) => b.slug)).toContain('english-only');

  // first comment is held: author sees it as pending, others do not
  const c1 = await request.post('/api/comments', {
    data: { post: post.id, body: 'First! <b>bold</b>' },
  });
  expect(c1.status()).toBe(201);
  expect((await c1.json()).pending).toBe(true);
  const mine = (await (await request.get(`/api/comments?post=${post.id}`)).json()) as {
    comments: { id: string; body: string; pending: boolean; mine: boolean }[];
  };
  expect(mine.comments.find((c) => c.mine)?.pending).toBe(true);
  expect(mine.comments.find((c) => c.mine)?.body).not.toContain('<b>'); // markup stripped
  const mineId = mine.comments.find((c) => c.mine)?.id;
  const publicView = (await (
    await page.request.get(`/api/comments?post=${post.id}`, { headers: { cookie: '' } })
  ).json()) as { comments: { id: string }[] };
  expect(publicView.comments.map((c) => c.id)).not.toContain(mineId);

  // moderator approves → public; the next comment publishes immediately
  const me = await admin.collection('users').getFirstListItem(`email = "${email}"`);
  const held = await admin
    .collection('comments')
    .getFirstListItem(`post = "${post.id}" && user = "${me.id}"`);
  await admin.collection('comments').update(held.id, { status: 'approved' });
  const pubAfter = (await (
    await page.request.get(`/api/comments?post=${post.id}`, { headers: { cookie: '' } })
  ).json()) as { comments: { author: string }[] };
  expect(pubAfter.comments[0]?.author).toBe('Acct Tester');
  const c2 = await request.post('/api/comments', {
    data: { post: post.id, body: 'Second', parent: held.id },
  });
  expect((await c2.json()).pending).toBe(false);

  // rejects: empty, too long, bad ids, spoofed status
  expect(
    (await request.post('/api/comments', { data: { post: post.id, body: '   ' } })).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/comments', { data: { post: post.id, body: 'x'.repeat(2001) } })
    ).status(),
  ).toBe(400);
  expect(
    (await request.post('/api/comments', { data: { post: 'nope', body: 'x' } })).status(),
  ).toBe(400);
  const direct = await new PocketBase(PB)
    .collection('comments')
    .create({ post: post.id, user: 'x', body: 'y' })
    .catch((e) => e.status);
  expect(direct).toBe(400);
});

test('comments UI: posting from the page works and cross-site writes are blocked', async ({
  page,
  request,
}) => {
  await page.goto('/login');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'brand-new-password-3');
  await page.click('button[type=submit]');
  await page.waitForURL('**/account');
  await expect(page.locator('[data-account-name]')).toHaveText('Acct Tester');
  await expect(page.locator('[data-bookmarks] .row')).toHaveCount(1);

  await page.goto('/blog/english-only');
  await page.locator('.nextprev').scrollIntoViewIfNeeded(); // the comments island hydrates when visible
  const box = page.locator('textarea.area');
  await box.fill(`From the UI ${stamp}`);
  await page.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.getByText(`From the UI ${stamp}`)).toBeVisible();
  await expect(page.locator('.sq.me-link')).toContainText('Acct Tester');

  const cross = await request.post('/api/comments', {
    data: { post: 'abcdefghijklmno', body: 'x' },
    headers: { origin: 'https://evil.example' },
  });
  expect(cross.status()).toBe(403);
});

test('like button toggles in the UI; signed-out users are sent to login', async ({
  page,
  browser,
}) => {
  await page.request.post('/api/auth/login', { data: { email, password: 'brand-new-password-3' } });
  await page.goto('/blog/english-only');
  await page.locator('.nextprev').scrollIntoViewIfNeeded();
  const like = page.locator('[data-like]');
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  const ctx = await browser.newContext();
  const anon = await ctx.newPage();
  await anon.goto('/blog/english-only');
  const state = anon.waitForResponse((r) => r.url().includes('/api/interactions/'));
  await anon.locator('.nextprev').scrollIntoViewIfNeeded();
  await state;
  await anon.locator('[data-like]').click();
  await anon.waitForURL('**/login?next=*');
  await ctx.close();
});

test('delete account removes it, its comments and bookmarks; password required', async ({
  page,
  request,
}) => {
  await request.post('/api/auth/login', { data: { email, password: 'brand-new-password-3' } });
  expect(
    (await request.delete('/api/account', { data: { password: 'wrong-password-123' } })).status(),
  ).toBe(403);
  const u = await admin.collection('users').getFirstListItem(`email = "${email}"`);
  expect(
    (await request.delete('/api/account', { data: { password: 'brand-new-password-3' } })).status(),
  ).toBe(204);
  await expect(admin.collection('users').getOne(u.id)).rejects.toMatchObject({ status: 404 });
  expect(
    (await admin.collection('comments').getFullList({ filter: `user = "${u.id}"` })).length,
  ).toBe(0);
  expect((await request.get('/api/auth/me')).status()).toBe(401);
  void page;
});

test('newsletter: double opt-in, duplicates look identical, unsubscribe works', async ({
  request,
  page,
}) => {
  const sub = `sub-${stamp}@example.com`;
  expect(
    (await request.post('/api/subscribe', { data: { email: sub, locale: 'en' } })).status(),
  ).toBe(200);
  expect(
    (await request.post('/api/subscribe', { data: { email: sub, locale: 'en' } })).status(),
  ).toBe(200);
  expect((await request.post('/api/subscribe', { data: { email: 'not-an-email' } })).status()).toBe(
    400,
  );
  const row = await admin.collection('subscribers').getFirstListItem(`email = "${sub}"`);
  expect(row.confirmed).toBe(false);
  const html = await mailTo(sub, 'Confirm');
  await page.goto(linkIn(html, '/subscribe/confirm'));
  await expect(page.locator('[data-result]')).toContainText('confirmed', { timeout: 10000 });
  expect((await admin.collection('subscribers').getOne(row.id)).confirmed).toBe(true);
  // the public cannot read the list
  expect(
    await new PocketBase(PB)
      .collection('subscribers')
      .getFullList()
      .catch((e) => e.status),
  ).toBe(403);
  const un = await fetch(`${PB}/api/subscribers/unsubscribe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: row.token }),
  });
  expect(un.status).toBe(200);
  await expect(admin.collection('subscribers').getOne(row.id)).rejects.toMatchObject({
    status: 404,
  });
});

test('SEO endpoints', async ({ request }) => {
  const sm = await (await request.get('/sitemap.xml')).text();
  expect(sm).toContain('<loc>http://localhost:8088/fa/blog/hello-bilingual</loc>');
  expect(sm).toContain('hreflang="x-default"');
  expect(sm).not.toContain('draft-post');
  expect(await (await request.get('/robots.txt')).text()).toContain(
    'Sitemap: http://localhost:8088/sitemap.xml',
  );
  const fa = await (await request.get('/fa/rss.xml')).text();
  expect(fa).toContain('چرا دوباره وبلاگم را از نو ساختم');
  expect(fa).not.toContain('PocketBase in production');
  const og = await request.get('/og/fa/hello-bilingual.png');
  expect(og.headers()['content-type']).toBe('image/png');
  expect((await request.get('/og/en/draft-post.png')).status()).toBe(404);
  expect((await request.get('/og/xx/hello-bilingual.png')).status()).toBe(404);
  const html = await (await request.get('/blog/hello-bilingual')).text();
  expect(html).toContain('application/ld+json');
  expect(html).toContain('"@type":"BlogPosting"');
  expect(html).toContain(
    'property="og:image" content="http://localhost:8088/og/en/hello-bilingual.png"',
  );
  const home = await (await request.get('/')).text();
  expect(home).toContain('"alternateName":"امیر زوارمی"');
});
