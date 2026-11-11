import { expect, test } from '@playwright/test';
import PocketBase from 'pocketbase';

const PB = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090';
const stamp = Date.now();
const ADMIN = { email: 'dev-admin@example.com', password: 'dev-admin-password-1' };
const userEmail = `plain-${stamp}@example.com`;
const userPw = 'plain-user-password-1';
const slug = `e2e-post-${stamp}`;
let su: PocketBase;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  su = new PocketBase(PB);
  su.autoCancellation(false);
  await su
    .collection('_superusers')
    .authWithPassword(
      process.env.PB_SUPERUSER_EMAIL ?? '',
      process.env.PB_SUPERUSER_PASSWORD ?? '',
    );
  await su.collection('users').create({
    email: userEmail,
    password: userPw,
    passwordConfirm: userPw,
    name: 'Plain',
    verified: true,
  });
});

test.afterAll(async () => {
  for (const p of await su
    .collection('posts')
    .getFullList({ filter: `slug ~ "e2e-post-${stamp}"` }))
    await su.collection('posts').delete(p.id);
  for (const u of await su.collection('users').getFullList({ filter: `email = "${userEmail}"` }))
    await su.collection('users').delete(u.id);
});

test.describe('access control', () => {
  test('anonymous: 401 on the proxy and the preview endpoint; /admin shell is noindex', async ({
    request,
  }) => {
    expect((await request.get('/api/admin/pb/api/collections/posts/records')).status()).toBe(401);
    expect((await request.post('/api/admin/preview', { data: { markdown: 'x' } })).status()).toBe(
      401,
    );
    const html = await (await request.get('/admin')).text();
    expect(html).toContain('noindex');
  });

  test('a normal signed-in user is refused everywhere in the back office', async ({ request }) => {
    expect(
      (
        await request.post('/api/auth/login', { data: { email: userEmail, password: userPw } })
      ).status(),
    ).toBe(200);
    expect((await request.get('/api/admin/pb/api/collections/posts/records')).status()).toBe(403);
    expect(
      (
        await request.post('/api/admin/pb/api/collections/posts/records', {
          data: { slug: 'hack', date: '2026-01-01', status: 'published' },
        })
      ).status(),
    ).toBe(403);
    expect((await request.post('/api/admin/preview', { data: { markdown: 'x' } })).status()).toBe(
      403,
    );
  });

  test('PocketBase itself enforces the role: users cannot write content or promote themselves', async () => {
    const status = (p: Promise<unknown>) =>
      p.then(
        () => 0,
        (e: { status: number }) => e.status,
      );
    const u = new PocketBase(PB);
    const auth = await u.collection('users').authWithPassword(userEmail, userPw);
    const rejected = [
      await status(
        u.collection('posts').create({ slug: 'nope', date: '2026-01-01', status: 'published' }),
      ),
      await status(u.collection('users').update(auth.record.id, { role: 'admin' })),
      await status(
        new PocketBase(PB).collection('users').create({
          email: `x${stamp}@example.com`,
          password: 'longenough-pass-1',
          passwordConfirm: 'longenough-pass-1',
          role: 'admin',
        }),
      ),
    ];
    // list rules are filters: a non-admin simply sees nothing
    expect(await u.collection('subscribers').getFullList()).toHaveLength(0);
    for (const s of rejected) expect([400, 403, 404]).toContain(s);
    expect((await u.collection('users').getFullList()).length).toBe(1); // only themselves
  });

  test('the proxy only exposes content collections', async ({ request }) => {
    expect((await request.post('/api/auth/login', { data: ADMIN })).status()).toBe(200);
    for (const p of [
      'api/settings',
      'api/collections',
      'api/collections/_superusers/records',
      'api/backups',
      'api/logs',
      'api/collections/posts/records/../../../settings',
    ]) {
      expect([404, 400]).toContain((await request.get(`/api/admin/pb/${p}`)).status());
    }
    expect(
      (await request.get('/api/admin/pb/api/collections/posts/records?perPage=1')).status(),
    ).toBe(200);
  });

  test('cross-site writes to the admin API are blocked', async ({ request }) => {
    await request.post('/api/auth/login', { data: ADMIN });
    const r = await request.post('/api/admin/preview', {
      data: { markdown: 'x' },
      headers: { origin: 'https://evil.example' },
    });
    expect(r.status()).toBe(403);
  });

  test('the preview endpoint uses the public renderer and drops raw HTML', async ({ request }) => {
    await request.post('/api/auth/login', { data: ADMIN });
    const r = await request.post('/api/admin/preview', {
      data: { markdown: '## Hi\n\n<script>alert(1)</script>\n\n```ts\nconst a = 1\n```' },
    });
    const { html } = await r.json();
    expect(html).toContain('<span>/01</span>Hi');
    expect(html).toContain('class="term"');
    expect(html).not.toContain('<script');
  });
});

test.describe('back office UI', () => {
  test.beforeEach(async ({ page }) => {
    const r = await page.request.post('/api/auth/login', { data: ADMIN });
    expect(r.status()).toBe(200);
  });

  test('non-admin sees "Admins only"', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.request.post('/api/auth/login', { data: { email: userEmail, password: userPw } });
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admins only' })).toBeVisible();
    await ctx.close();
  });

  test('dashboard shows the counters', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.adm-card').first()).toBeVisible();
    await expect(page.getByText('Published posts')).toBeVisible();
  });

  test('write a post: markdown + live preview, save as draft (hidden), upload an image, publish (visible), Persian tab', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    page.on('dialog', (d) => void d.accept());
    await page.goto('/admin#/posts/new');
    await page.getByLabel('Slug (URL)').fill(slug);
    await page.locator('.adm-title').fill('E2E hello world');
    await page.getByLabel('Tags (comma separated)').fill('E2E, Testing');
    await page.locator('.cm-content').click();
    await page.keyboard.type('Intro paragraph.\n\n## First section\n\nSome **bold** text.');
    // live preview through the real pipeline
    await expect(page.locator('.adm-pane.preview h2')).toContainText('/01');
    await expect(page.locator('.adm-pane.preview strong')).toHaveText('bold');

    await page.getByRole('button', { name: /^Save/ }).click();
    await page.waitForURL(/#\/posts\/[a-z0-9]{15}$/);
    await expect(page.getByText('Unsaved changes')).toBeHidden();

    // draft is not public
    expect((await request.get(`/blog/${slug}`)).status()).toBe(404);

    // image upload through the toolbar → inserts markdown and shows in the library
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.adm-toolbar button', { hasText: 'Image' }).click();
    const fc = await chooser;
    await fc.setFiles({
      name: 'pic.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
    await expect(page.locator('.adm-imgs figure')).toHaveCount(1);
    await expect(page.locator('.cm-content')).toContainText('![](img:');

    // Persian translation
    await page.getByRole('tab', { name: /فارسی/ }).click();
    await page.locator('.adm-title').fill('سلام دنیا');
    await page.locator('.cm-content').click();
    await page.keyboard.type('متن آزمایشی');
    await expect(page.locator('.adm-pane.preview .prose')).toHaveAttribute('dir', 'rtl');

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

    const en = await request.get(`/blog/${slug}`);
    expect(en.status()).toBe(200);
    const html = await en.text();
    expect(html).toContain('E2E hello world');
    expect(html).toContain('<span>/01</span>First section');
    expect(html).toMatch(/src="\/pb\/api\/files\/posts\/[a-z0-9]+\/pic_[a-z0-9]+\.png"/);
    const fa = await request.get(`/fa/blog/${slug}`);
    expect(fa.status()).toBe(200);
    expect(await fa.text()).toContain('سلام دنیا');
    expect(await (await request.get('/sitemap.xml')).text()).toContain(`/fa/blog/${slug}`);

    // unpublish hides it again
    await page.getByRole('button', { name: 'Unpublish' }).click();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    expect((await request.get(`/blog/${slug}`)).status()).toBe(404);

    // preview link works for the draft
    await page.locator('.adm-field button', { hasText: /^(Re)?generate$/i }).click();
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.adm-field a', { hasText: /^Open$/ })).toBeVisible();
    const link = await page.locator('.adm-field a', { hasText: /^Open$/ }).getAttribute('href');
    expect((await request.get(link ?? '/')).status()).toBe(200);

    // appears in the list, then delete
    await page.goto('/admin#/posts');
    await expect(page.getByRole('link', { name: 'E2E hello world' })).toBeVisible();
    await page.getByRole('link', { name: 'E2E hello world' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await page.waitForURL(/#\/posts$/);
    await expect(page.getByRole('link', { name: 'E2E hello world' })).toHaveCount(0);
  });

  test('validation: bad slug and missing title are refused with a message', async ({ page }) => {
    await page.goto('/admin#/posts/new');
    await page.getByLabel('Slug (URL)').fill('Bad Slug!');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.adm-toast.err')).toContainText('Slug');
    await page.getByLabel('Slug (URL)').fill('ok-slug');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.adm-toast.err').last()).toContainText('title');
  });

  test('moderate comments: approve a pending one and it becomes public', async ({
    page,
    request,
  }) => {
    const post = await su.collection('posts').getFirstListItem('slug = "english-only"');
    const u = await su.collection('users').getFirstListItem(`email = "${userEmail}"`);
    const c = await su.collection('comments').create({
      post: post.id,
      user: u.id,
      body: `Needs review ${stamp}`,
      status: 'pending',
      author_name: 'Plain',
    });
    expect(await (await request.get(`/api/comments?post=${post.id}`)).text()).not.toContain(
      `Needs review ${stamp}`,
    );
    await page.goto('/admin#/comments');
    const card = page.locator('.adm-cmt', { hasText: `Needs review ${stamp}` });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Approve' }).click();
    await expect(card).toHaveCount(0);
    expect(await (await request.get(`/api/comments?post=${post.id}`)).text()).toContain(
      `Needs review ${stamp}`,
    );
    await su.collection('comments').delete(c.id);
  });

  test('subscribers and users pages load; projects can be created and removed', async ({
    page,
  }) => {
    page.on('dialog', (d) => void d.accept());
    await page.goto('/admin#/subscribers');
    await expect(page.getByRole('heading', { name: 'Subscribers' })).toBeVisible();
    await page.goto('/admin#/users');
    await expect(page.getByText('dev-admin@example.com')).toBeVisible();
    await page.goto('/admin#/projects/new');
    await page.getByLabel('Name').fill(`E2E Proj ${stamp}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL(/#\/projects\/[a-z0-9]{15}$/);
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await page.waitForURL(/#\/projects$/);
  });
});
