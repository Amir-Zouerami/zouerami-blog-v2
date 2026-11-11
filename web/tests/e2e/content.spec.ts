import { expect, test } from '@playwright/test';

test.describe('blog index', () => {
  test('lists published posts newest first, grouped by year, with EN/FA badges', async ({
    page,
  }) => {
    await page.goto('/blog');
    await expect(page.locator('h1')).toContainText('Writing');
    const titles = await page.locator('.row h3').allTextContents();
    expect(titles[0]).toContain('Why I rebuilt my blog');
    expect(titles.join('|')).not.toContain('An unfinished draft');
    await expect(page.locator('.year').first()).toHaveText('2026');
    const persianOnly = page.locator('.row', { hasText: 'تایپوگرافی فارسی در وب' });
    await expect(persianOnly.locator('.lg.off')).toHaveText('EN');
  });
  test('tag filter and text search work server-side', async ({ page }) => {
    await page.goto('/blog?tag=DevOps');
    const titles = await page.locator('.row h3').allTextContents();
    expect(titles.length).toBeGreaterThan(0);
    for (const t of titles) expect(t).toMatch(/PocketBase|Docker/);
    await page.goto('/blog?q=astro');
    await expect(page.locator('.row h3')).toHaveCount(1);
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
  test('language dropdown links to the other language and crosses out a missing one', async ({
    page,
  }) => {
    await page.goto('/blog/hello-bilingual');
    await page.locator('[data-dd-toggle]').click();
    await expect(page.locator('.dd-menu a[hreflang="fa"]')).toHaveAttribute(
      'href',
      '/fa/blog/hello-bilingual',
    );
    await page.goto('/blog/english-only');
    await page.locator('[data-dd-toggle]').click();
    await expect(page.locator('.dd-menu span.off')).toContainText('not written yet');
    await expect(page.locator('.dd-menu a')).toHaveCount(1);
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
    await expect(page.locator('.notice')).toContainText('only available in فارسی');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
  test('hreflang pairs only for languages that exist; canonical is self', async ({ request }) => {
    const both = await (await request.get('/blog/hello-bilingual')).text();
    expect(both).toContain('<link rel="alternate" hreflang="en"');
    expect(both).toContain('<link rel="alternate" hreflang="fa"');
    const one = await (await request.get('/blog/english-only')).text();
    expect(one).toContain('<link rel="alternate" hreflang="en"');
    expect(one).not.toContain('<link rel="alternate" hreflang="fa"');
    expect(one).toMatch(/rel="canonical" href="http:\/\/localhost:8088\/blog\/english-only"/);
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
    await expect(page.locator('.tl-row')).toHaveCount(5);
    await page.goto('/fa/about');
    await expect(page.locator('.tl-row').first()).toContainText('بازسازی');
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
  test('toggle on an English-only post points at the Persian blog home, not a dead URL', async ({
    page,
  }) => {
    await page.goto('/blog/english-only');
    const href = await page.locator('a[data-lang-switch]').getAttribute('href');
    expect(href).toBe('/fa');
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
