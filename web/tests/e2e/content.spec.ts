import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import PocketBase from 'pocketbase';

/** An English-only post owned by this run (the seeded ones can be edited by the writer in the admin). */
const EN_ONLY = `e2e-enonly-${Date.now()}`;
let su: PocketBase;

test.beforeAll(async () => {
  su = new PocketBase(process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090');
  su.autoCancellation(false);
  await su
    .collection('_superusers')
    .authWithPassword(
      process.env.PB_SUPERUSER_EMAIL ?? '',
      process.env.PB_SUPERUSER_PASSWORD ?? '',
    );
  const p = await su
    .collection('posts')
    .create({ slug: EN_ONLY, date: '2026-01-15 00:00:00.000Z', status: 'published', tags: [] });
  await su.collection('post_translations').create({
    post: p.id,
    lang: 'en',
    title: 'English only fixture',
    summary: 's',
    body_md: 'Body',
  });
});
test.afterAll(async () => {
  for (const p of await su.collection('posts').getFullList({ filter: `slug = "${EN_ONLY}"` }))
    await su.collection('posts').delete(p.id);
});

test.describe('blog index', () => {
  test('lists published posts newest first, grouped by year, with EN/FA badges', async ({
    page,
  }) => {
    await page.goto('/blog');
    await expect(page.locator('h1')).toContainText('Writing');
    const titles = await page.locator('.ptile h3, .card h3').allTextContents(); // featured tiles first, then the list
    expect(titles[0]).toContain('Why I rebuilt my blog');
    expect(titles.join('|')).not.toContain('An unfinished draft');
    await expect(page.locator('.year').first()).toHaveText('2026');
    const persianOnly = page.locator('.card', { hasText: 'تایپوگرافی فارسی در وب' });
    await expect(persianOnly.locator('.lg.off')).toHaveText('EN');
  });
  test('tag filter and text search work server-side', async ({ page }) => {
    await page.goto('/blog?tag=DevOps');
    const titles = await page.locator('.card h3').allTextContents();
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) expect(t).toMatch(/PocketBase|Docker/);
    await page.goto('/blog?q=astro');
    await expect(page.locator('.card h3')).toHaveCount(1);
    await page.goto('/blog?q=zzzzzznotfound');
    await expect(page.getByText('No signal')).toBeVisible();
  });
  test('query strings cannot inject markup', async ({ page }) => {
    await page.goto('/blog?q=%22%3E%3Cscript%3Ewindow.__x=1%3C/script%3E&tag=%22%3E%3Cb%3E');
    expect(await page.evaluate(() => (window as never as { __x?: number }).__x)).toBeUndefined();
  });
  test('Persian blog index is RTL with Persian chrome', async ({ page }) => {
    await page.goto('/fa/blog');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('h1')).toContainText('نوشته‌ها');
    await expect(page.locator('nav.nav')).toContainText('وبلاگ');
  });
});

test.describe('post page', () => {
  test('renders markdown: numbered headings, TOC, code block, figure, footnote', async ({
    page,
  }) => {
    await page.goto('/blog/hello-bilingual');
    await expect(page.locator('h1')).toHaveText('Why I rebuilt my blog (again)');
    await expect(page.locator('.prose h2 span').first()).toHaveText('/01');
    await expect(page.locator('#toc a')).toHaveCount(4);
    await expect(page.locator('.term').first()).toBeVisible();
    await expect(page.locator('.term .tb span').first()).toHaveText('astro');
    await expect(page.locator('.prose figure img')).toHaveAttribute(
      'src',
      /\/pb\/api\/files\/posts\/.+\/signal_art_/,
    );
    await expect(page.locator('.footnotes')).toContainText('feeling, not a requirement');
    await page.waitForLoadState('networkidle');
    const loaded = await page
      .locator('.prose figure img')
      .evaluate((i: HTMLImageElement) => i.naturalWidth > 0);
    expect(loaded).toBe(true);
  });
  test('the tags of a post link to the blog list filtered by that tag', async ({ page }) => {
    await page.goto('/blog/hello-bilingual');
    const tag = page.locator('.post-head a.tagp-link').first();
    const name = ((await tag.textContent()) ?? '').trim();
    await tag.click();
    await expect(page).toHaveURL(new RegExp(`/blog\\?tag=${encodeURIComponent(name)}`));
    await expect(page.locator('.ftab.on')).toContainText(name);
  });
  test('a visible language control links to the other language and crosses out a missing one', async ({
    page,
  }) => {
    await page.goto('/blog/hello-bilingual');
    const seg = page.locator('.langseg');
    await expect(seg.locator('a[hreflang="fa"]')).toBeVisible();
    await expect(seg.locator('a[hreflang="fa"]')).toHaveAttribute(
      'href',
      '/blog/hello-bilingual?lang=fa',
    );
    await expect(seg.locator('a.cur')).toHaveText('English');
    await seg.locator('a[hreflang="fa"]').click();
    await page.waitForURL('**/blog/hello-bilingual?lang=fa');
    await expect(page.locator('.prose')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en'); // content only: the site chrome stays English
    await expect(page.locator('.langseg a.cur')).toHaveText('فارسی');
    await expect(page.locator('.langseg a[hreflang="en"]')).toHaveAttribute(
      'href',
      '/blog/hello-bilingual',
    );

    await page.goto(`/blog/${EN_ONLY}`);
    await expect(page.locator('.langseg .off')).toContainText('not written yet');
    await expect(page.locator('.langseg a')).toHaveCount(1);
  });
  test('Persian post: RTL, Jalali date, Persian title', async ({ page }) => {
    await page.goto('/fa/blog/hello-bilingual');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('h1')).toHaveText('چرا دوباره وبلاگم را از نو ساختم');
    await expect(page.locator('.meta-grid')).toContainText('۱۴۰۵');
    await expect(page.locator('.prose')).toHaveAttribute('dir', 'rtl');
  });
  test('Persian-only post opened on the English site shows it in Persian with a notice', async ({
    page,
  }) => {
    await page.goto('/blog/persian-only');
    await expect(page.locator('.prose')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('.notice')).toContainText('only available in Persian');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
  test('hreflang pairs only for languages that exist; canonical is self', async ({ request }) => {
    const both = await (await request.get('/blog/hello-bilingual')).text();
    expect(both).toContain('<link rel="alternate" hreflang="en"');
    expect(both).toContain('<link rel="alternate" hreflang="fa"');
    const one = await (await request.get(`/blog/${EN_ONLY}`)).text();
    expect(one).toContain('<link rel="alternate" hreflang="en"');
    expect(one).not.toContain('<link rel="alternate" hreflang="fa"');
    expect(one).toContain(`rel="canonical" href="http://localhost:8088/blog/${EN_ONLY}"`);
  });
  test('unknown slug is a real 404; malformed slugs too', async ({ request }) => {
    expect((await request.get('/blog/does-not-exist')).status()).toBe(404);
    expect((await request.get('/blog/%22%20%7C%7C%201=1')).status()).toBe(404);
    expect((await request.get('/fa/blog/does-not-exist')).status()).toBe(404);
  });
  test('drafts are 404 unless the preview token matches, and previews are noindex + no-store', async ({
    request,
  }) => {
    expect((await request.get('/blog/draft-post')).status()).toBe(404);
    expect((await request.get('/blog/draft-post?token=wrong')).status()).toBe(404);
    const ok = await request.get('/blog/draft-post?token=dev-preview-token-0001');
    expect(ok.status()).toBe(200);
    expect(ok.headers()['cache-control']).toContain('no-store');
    expect(await ok.text()).toContain('noindex');
  });
  test('view beacon fires once per day per post (bots are ignored server-side, see integration tests)', async ({
    page,
  }) => {
    let calls = 0;
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'webdriver', { get: () => false }),
    );
    await page.route('**/pb/api/views/**', (r) => {
      calls += 1;
      return r.fulfill({ status: 204 });
    });
    await page.goto('/blog/english-only');
    await page.waitForLoadState('networkidle');
    await page.goto('/blog/english-only');
    await page.waitForLoadState('networkidle');
    expect(calls).toBe(1);
  });
  test('prev/next navigation exists', async ({ page }) => {
    await page.goto('/blog/english-only');
    await expect(page.locator('.nextprev a')).toHaveCount(2);
  });
});

test.describe('work and about', () => {
  test('work index filters by category and links to project pages', async ({ page }) => {
    await page.goto('/work');
    await expect(page.locator('.tile')).toHaveCount(6);
    await page.goto('/work?cat=Tool');
    await expect(page.locator('.tile.dim')).toHaveCount(4);
    await page.goto('/work');
    await page.locator('.tile', { hasText: 'Lumen' }).click();
    await page.waitForURL('**/work/lumen');
    await expect(page.locator('h1')).toHaveText('Lumen');
    await expect(page.locator('.nums b')).toHaveText('48');
    await expect(page.locator('.big-next')).toBeVisible();
  });
  test('unknown project is 404; Persian project page falls back to English text with notice', async ({
    page,
    request,
  }) => {
    expect((await request.get('/work/nope')).status()).toBe(404);
    await page.goto('/fa/work/lumen');
    await expect(page.locator('.notice')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
  test('about page has timeline in both languages', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('.tl-item')).toHaveCount(5);
    await expect(page.locator('.tl-svg .tl-main')).toHaveCount(1);
    await page.goto('/fa/about');
    await expect(page.locator('.tl-item').first()).toContainText('لندین');
  });
});

test.describe('language switching', () => {
  test('header toggle goes to the equivalent page and never auto-redirects', async ({ page }) => {
    await page.goto('/blog/hello-bilingual');
    await page.locator('a[data-lang-switch]').click();
    await page.waitForURL('**/fa/blog/hello-bilingual');
    await page.goto('/blog');
    await expect(page).toHaveURL(/\/blog$/);
  });
  test('the header switch stays on the same page, even where no translation exists', async ({
    page,
  }) => {
    await page.goto(`/blog/${EN_ONLY}`);
    await expect(page.locator('a[data-lang-switch]')).toHaveAttribute(
      'href',
      `/fa/blog/${EN_ONLY}`,
    );
    await page.locator('a[data-lang-switch]').click();
    await page.waitForURL(`**/fa/blog/${EN_ONLY}`);
    await expect(page.locator('.notice')).toBeVisible(); // English text inside the Persian chrome, with a notice
    await expect(page.locator('a[data-lang-switch]')).toHaveAttribute('href', `/blog/${EN_ONLY}`);
  });
  test('switching language keeps the page and its query string', async ({ page }) => {
    for (const [from, to] of [
      ['/blog?tag=Web', '/fa/blog?tag=Web'],
      ['/work?cat=Tool', '/fa/work?cat=Tool'],
      ['/about', '/fa/about'],
      ['/work/lumen', '/fa/work/lumen'],
      ['/privacy', '/fa/privacy'],
      ['/fa/blog', '/blog'],
      ['/fa', '/'],
    ] as const) {
      await page.goto(from);
      await expect(page.locator('a[data-lang-switch]'), from).toHaveAttribute('href', to);
    }
    await page.goto('/blog?tag=Web');
    await page.locator('a[data-lang-switch]').click();
    await page.waitForURL('**/fa/blog?tag=Web');
  });
  test('Persian home shows the Persian name as visible text and keeps the Latin hero', async ({
    page,
  }) => {
    await page.goto('/fa');
    await expect(page.locator('.fa-name')).toHaveText('امیر زوارمی');
    await expect(page.locator('h1#heroName')).toHaveAttribute('aria-label', 'Amir Zouerami');
  });
  test('a remembered Persian choice shows a dismissible hint on English pages, no redirect', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('s')) {
        sessionStorage.setItem('s', '1');
        localStorage.setItem('sig-lang', 'fa');
      }
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#langhint')).toBeVisible();
    await page.locator('[data-lang-dismiss]').click();
    await expect(page.locator('#langhint')).toBeHidden();
  });
});

/** A tiny valid PNG (a flat colour), built here so the test needs no fixture file. */
function solidPng(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = (crcTable[(c ^ x) & 0xff] as number) ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x80)]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test.describe('social preview image', () => {
  test('a post with a cover shares the cover, cropped to 1200x630; without one it is the generated card', async ({
    request,
  }) => {
    const slug = `e2e-ogcover-${Date.now()}`;
    const fd = new FormData();
    fd.append('slug', slug);
    fd.append('date', '2026-01-16 00:00:00.000Z');
    fd.append('status', 'published');
    fd.append('tags', '[]');
    fd.append(
      'cover',
      new Blob([new Uint8Array(solidPng(1000, 300))], { type: 'image/png' }),
      'cover.png',
    );
    const p = await su.collection('posts').create(fd);
    await su
      .collection('post_translations')
      .create({ post: p.id, lang: 'en', title: 'Cover card', summary: 's', body_md: 'Body' });
    try {
      const page = await request.get(`/blog/${slug}`);
      expect(await page.text()).toContain(`/og/en/${slug}.png`);
      const og = await request.get(`/og/en/${slug}.png`);
      expect(og.status()).toBe(200);
      const body = await og.body();
      // PNG header: width and height are bytes 16..24
      expect(og.headers()['content-type']).toContain('image/png');
      expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([1200, 630]);
      // the generated card (no cover) is also 1200x630, but a different image
      const plain = await request.get(`/og/en/${EN_ONLY}.png`);
      expect(plain.status()).toBe(200);
      expect((await plain.body()).equals(body)).toBe(false);
    } finally {
      await su.collection('posts').delete(p.id);
    }
  });
});
