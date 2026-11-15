import { expect, test } from '@playwright/test';

test.describe('writing features', () => {
  test('callouts, heading anchors and every diagram type render', async ({ page }) => {
    await page.goto('/blog/diagrams-demo');
    await expect(page.locator('.callout.callout-tip .callout-title')).toHaveText(
      'Callouts work too',
    );
    const anchor = page.locator('.prose h2 a.anchor').first();
    await expect(anchor).toHaveAttribute('href', /^#/);
    const blocks = page.locator('.mermaid-block');
    const n = await blocks.count();
    expect(n).toBeGreaterThanOrEqual(10);
    for (let i = 0; i < n; i++) {
      await blocks.nth(i).scrollIntoViewIfNeeded();
      await expect(blocks.nth(i).locator('svg').first()).toBeVisible({ timeout: 20000 });
    }
    await expect(page.locator('.mermaid-block.mm-error, .mm-errmsg')).toHaveCount(0);
  });

  test('holding Ctrl over a diagram locks page scroll', async ({ page }) => {
    await page.goto('/blog/diagrams-demo');
    const view = page.locator('.mm-view').first();
    await view.scrollIntoViewIfNeeded();
    await expect(view.locator('svg')).toBeVisible({ timeout: 20000 });
    await view.hover();
    await page.keyboard.down('Control');
    await page.mouse.move(
      ...(await view.boundingBox().then((b) => [b!.x + 30, b!.y + 30] as [number, number])),
    );
    await expect(page.locator('html')).toHaveClass(/mm-lock/);
    await page.keyboard.up('Control');
    await page.mouse.move(2, 2);
    await expect(page.locator('html')).not.toHaveClass(/mm-lock/);
  });

  test('selecting article text offers a link to the quote', async ({ page }) => {
    await page.goto('/blog/diagrams-demo');
    await page.locator('.prose p').first().selectText();
    await expect(page.locator('.quote-btn')).toBeVisible();
  });

  test('home shows posts as cards', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('.cards .card').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('.card-xl')).toHaveCount(1);
  });

  test('Persian blog index groups by Jalali year', async ({ page }) => {
    await page.goto('/fa/blog');
    await expect(page.locator('.year').first()).toHaveText(/^[۰-۹]{4}$/);
  });
});

test.describe('pagination and Persian post heading', () => {
  test('blog index pages with ?page= and clamps bad values', async ({ page }) => {
    await page.goto('/blog');
    const first = await page.locator('.card').count();
    expect(first).toBeLessThanOrEqual(12);
    await page.goto('/blog?page=999');
    expect(await page.locator('.card').count()).toBeGreaterThan(0);
    await page.goto('/blog?page=abc');
    expect(await page.locator('.card').count()).toBe(first);
  });

  test('a Persian post on the English site puts its heading on the right', async ({ page }) => {
    await page.goto('/blog/hello-bilingual?lang=fa');
    const h = await page.locator('.post-head h1').boundingBox();
    const w = page.viewportSize()?.width ?? 0;
    expect(h && h.x + h.width).toBeGreaterThan(w - 140); // spans to the right edge, text starts there
    await expect(page.locator('.post-head h1')).toHaveCSS('text-align', /right|start/);
  });
});

test('blog page: featured collage on top, then 3-up recent posts without duplicates', async ({
  page,
}) => {
  await page.goto('/blog');
  const featured = page.locator('.cards:not(.cards-all) .card');
  const n = await featured.count();
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(5);
  const recent = page.locator('.cards-all .card');
  const featuredTitles = await featured.locator('h3').allTextContents();
  const recentTitles = await recent.locator('h3').allTextContents();
  for (const t of featuredTitles) expect(recentTitles).not.toContain(t);
  const tops = await recent.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().top)),
  );
  expect(tops.filter((t) => t === tops[0]).length).toBe(3);
  await page.goto('/blog?tag=DevOps');
  await expect(page.locator('.cards:not(.cards-all)')).toHaveCount(0); // filters show plain results
});

test('shared UI kit: no native checkboxes or default selects/file inputs are visible in the back office', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('dev-admin@example.com');
  await page.getByLabel(/password/i).fill('dev-admin-password-1');
  await page.locator('form button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  await page.goto('/admin#/posts/new');
  const sw = page.getByRole('switch', { name: /featured section/i });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(await page.locator('.adm input[type=checkbox]').count()).toBe(0);
  // the cover file input is hidden behind our picker
  await expect(page.locator('.ui-file button')).toBeVisible();
  await expect(page.locator('.ui-file input[type=file]')).toBeHidden();
  await page.goto('/admin#/posts');
  await expect(page.locator('.ui-select select').first()).toBeVisible();
  expect(
    await page
      .locator('.ui-select select')
      .first()
      .evaluate((e) => getComputedStyle(e).appearance),
  ).toBe('none');
});

test.describe('cv page', () => {
  test('shows the PDF of the site language, lets you switch version and download', async ({
    page,
    request,
  }) => {
    await page.goto('/cv');
    await expect(page.locator('[data-cv-frame]')).toHaveAttribute(
      'data',
      /amir-zouerami-cv-en\.pdf/,
    );
    await page.locator('[data-cv-lang="fa"]').click();
    await page.waitForURL('**/cv?lang=fa');
    await expect(page.locator('[data-cv-frame]')).toHaveAttribute(
      'data',
      /amir-zouerami-cv-fa\.pdf/,
    );
    await expect(page.locator('[data-cv-download]')).toHaveAttribute('href', /cv-fa\.pdf$/);
    const pdf = await request.get('/cv/amir-zouerami-cv-fa.pdf');
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('pdf');
    await page.goto('/fa/cv');
    await expect(page.locator('[data-cv-frame]')).toHaveAttribute('data', /cv-fa\.pdf/);
  });
});
