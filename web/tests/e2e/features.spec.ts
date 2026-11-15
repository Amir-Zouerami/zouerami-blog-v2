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
    expect(await page.locator('.ptiles .ptile').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('.ptile-big')).toHaveCount(1);
    // the bento has no empty gap: the tiles' union reaches the bottom of the grid
    const gap = await page.locator('.ptiles').evaluate((g) => {
      const box = g.getBoundingClientRect();
      const bottoms = [...g.querySelectorAll('.ptile')].map(
        (t) => t.getBoundingClientRect().bottom,
      );
      return box.bottom - Math.max(...bottoms);
    });
    expect(gap).toBeLessThan(60);
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
  const featured = page.locator('.ptiles .ptile');
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
  await expect(page.locator('.ptiles')).toHaveCount(0); // filters show plain results
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

test.describe('home hero and CV upload', () => {
  test('the hero has no huge gap, the lanyard sits opposite the name, and dragging it moves the card', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const name = await page.locator('#heroName').boundingBox();
    const top = await page.locator('.hero-top').boundingBox();
    expect((name?.y ?? 0) - ((top?.y ?? 0) + (top?.height ?? 0))).toBeLessThan(160);
    const card = page.locator('.lanyard-card.live');
    await expect(card).toBeVisible();
    await page.waitForTimeout(3200); // the strap is lowered in from the top first; let it settle
    const box = (await card.boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    expect(box.x).toBeGreaterThan((name?.x ?? 0) + (name?.width ?? 0) - 40); // to the right of the English name
    await expect(card.locator('img')).toHaveAttribute('src', '/me.jpg');
    await page.mouse.move(box.x + 100, box.y + 150);
    await page.mouse.down();
    await page.mouse.move(box.x - 120, box.y + 150, { steps: 10 });
    await page.waitForTimeout(200);
    const dragged = (await card.boundingBox()) as { x: number };
    expect(dragged.x).toBeLessThan(box.x - 50);
    await page.mouse.up();
    // Persian: mirrored, the card moves to the left of the name
    await page.goto('/fa');
    const fa = (await page.locator('.lanyard-card').boundingBox()) as { x: number };
    expect(fa.x).toBeLessThan(720);
  });

  test('an uploaded CV PDF shows on /cv and can be removed again', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('dev-admin@example.com');
    await page.getByLabel(/password/i).fill('dev-admin-password-1');
    await page.locator('form button[type=submit]').click();
    await page.waitForURL((u) => !u.pathname.endsWith('/login'));
    await page.goto('/admin#/cv');
    const slot = page.locator('[data-cv-slot="en"]');
    await slot.locator('input[type=file]').setInputFiles('public/cv/amir-zouerami-cv-en.pdf');
    await slot.getByRole('button', { name: /Upload|Replace/ }).click();
    await expect(slot.getByText('Live now:')).toBeVisible();
    await page.goto('/cv');
    await expect(page.locator('[data-cv-frame]')).toHaveAttribute(
      'data',
      /\/pb\/api\/files\/cv_files\//,
    );
    await page.goto('/admin#/cv');
    page.once('dialog', (d) => d.accept());
    await page.locator('[data-cv-slot="en"]').getByRole('button', { name: 'Delete' }).click();
    await expect(
      page.locator('[data-cv-slot="en"]').getByText('Nothing uploaded yet'),
    ).toBeVisible();
    await page.goto('/cv');
    await expect(page.locator('[data-cv-frame]')).toHaveAttribute(
      'data',
      /\/cv\/amir-zouerami-cv-en\.pdf/,
    );
  });
});

test('hero marquee lists backend tech, not site-stack words', async ({ page }) => {
  await page.goto('/');
  const words = await page.locator('.marq span').allTextContents();
  for (const w of [
    'RabbitMQ',
    'Kafka',
    'Bun',
    'Node.js',
    'PostgreSQL',
    'Redis',
    'C#',
    'ASP.NET',
    'API Gateway',
    'Observability',
    'CI/CD',
  ])
    expect(words).toContain(w);
  for (const w of ['Go', 'PocketBase', 'Astro']) expect(words).not.toContain(w);
});

test('marquee loops seamlessly: the second half of the strip is identical to the first, for any word count', async ({
  page,
}) => {
  for (const url of ['/', '/fa']) {
    await page.goto(url);
    const items = await page
      .locator('.marq span')
      .evaluateAll((els) => els.map((e) => `${e.textContent}|${e.className}`));
    const half = items.length / 2;
    expect(items.length % 4).toBe(0);
    expect(items.slice(0, half)).toEqual(items.slice(half));
    const anim = await page.locator('.marq div').evaluate((e) => getComputedStyle(e).animationName);
    expect(anim).toBe(url === '/fa' ? 'marq-rtl' : 'marq');
  }
});

test('card covers use resized thumbnails that actually load', async ({ page, request }) => {
  await page.goto('/blog');
  const img = page.locator('.card-img img').first();
  if (!(await img.count())) test.skip(true, 'no post with an uploaded cover in the seed data');
  const src = (await img.getAttribute('src')) as string;
  expect(src).toMatch(/\?thumb=\d+x0$/);
  const res = await request.get(src);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image');
});

test('the lanyard is hidden until it has loaded, then drops in from above the page', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'commit' });
  const lanyard = page.locator('.lanyard');
  await expect(lanyard).toHaveClass(/live/, { timeout: 8000 });
  await page.waitForTimeout(3200);
  const top = await page.locator('.lanyard-card').evaluate((e) => e.getBoundingClientRect().top);
  expect(top).toBeGreaterThan(0); // arrived below the header
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('.lanyard.ready')).toBeVisible(); // reduced motion: shown still, never hidden
});

test('reading progress pill: hidden at the top, follows the scroll, and takes you back up', async ({
  page,
}) => {
  await page.goto('/blog/diagrams-demo');
  const pill = page.locator('#rpill');
  await expect(pill).not.toHaveClass(/show/);
  await page.evaluate(() =>
    window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.5),
  );
  await expect(pill).toHaveClass(/show/);
  const mid = Number(await page.locator('#rpill-num').textContent());
  expect(mid).toBeGreaterThan(30);
  expect(mid).toBeLessThan(70);
  await expect(page.locator('#rpill-left')).toContainText(/min left/);
  await expect
    .poll(async () => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      return pill.evaluate((e) => e.classList.contains('done'));
    })
    .toBe(true);
  await expect(page.locator('#rpill-left')).toHaveText('Done reading');
  await pill.locator('[data-to-top]').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
  await expect(page.locator('.ring')).toHaveCount(0); // the old ring is gone
});

test('admin dashboard stat cards spread across the full width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('dev-admin@example.com');
  await page.getByLabel(/password/i).fill('dev-admin-password-1');
  await page.locator('form button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  await page.goto('/admin#/');
  const grid = page.locator('.adm-cards').first();
  await expect(grid.locator('.adm-card').first()).toBeVisible();
  const main = (await page.locator('.adm-main').boundingBox()) as { width: number };
  const box = (await grid.boundingBox()) as { width: number };
  expect(box.width).toBeGreaterThan(main.width * 0.85);
  const lefts = await grid
    .locator('.adm-card')
    .evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
  expect(lefts).toBeGreaterThan(2); // several columns, not one stacked block
});
