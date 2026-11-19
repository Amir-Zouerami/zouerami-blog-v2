import { expect, test } from '@playwright/test';

// A draft with a preview link (see scripts/seed-data.ts): lets the references be tried without changing the public lists.
const EN = '/blog/references-demo?token=dev-preview-token-0002';
const FA = '/fa/blog/references-demo?token=dev-preview-token-0002';

test.describe('references: the text', () => {
  test('citations become numbered markers, phrases are highlighted, nothing is left raw', async ({
    page,
  }) => {
    await page.goto(EN);
    const prose = page.locator('.prose');
    await expect(prose.locator('a.ref-cite').first()).toHaveText('1');
    expect(await prose.locator('a.ref-cite').count()).toBe(9);
    expect(await prose.locator('.ref-claim').count()).toBeGreaterThan(3);
    await expect(prose.locator('.ref-claim').first()).toContainText('slowest one percent');
    expect(await prose.innerText()).not.toContain('[@');
    // the same source cited twice keeps its number
    const nums = await prose
      .locator('a.ref-cite')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-n')));
    expect(nums.filter((n) => n === '1')).toHaveLength(2);
  });

  test('the box lists each source once, in order of first citation, with the right kinds', async ({
    page,
  }) => {
    await page.goto(EN);
    const tiles = page.locator('.ref-tile');
    await expect(tiles).toHaveCount(7);
    expect(await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-type')))).toEqual([
      'paper',
      'benchmark',
      'code',
      'benchmark',
      'post',
      'docs',
      'video',
    ]);
    await expect(tiles.first().locator('.ref-title')).toHaveText('The Tail at Scale');
    await expect(tiles.nth(1).locator('.ref-fig strong')).toHaveText('1.8×');
    // the post of this blog is filled in by the site
    await expect(tiles.nth(4).locator('.ref-title')).toHaveText('Why I rebuilt my blog (again)');
  });

  test('"Open source" is a real link that opens a new tab', async ({ page, context }) => {
    await page.goto(EN);
    const link = page.locator('.ref-tile a.ref-open').first();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    expect(popup.url()).toContain('cacm.acm.org');
    await popup.close();
  });
});

test.describe('references: wide screen', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('margin cards sit beside the text, on the side without the contents', async ({ page }) => {
    await page.goto(EN);
    await expect(page.locator('.ref-rail')).toBeVisible();
    const art = await page.locator('.art > article').boundingBox();
    const card = await page.locator('.ref-card').first().boundingBox();
    expect(card && art && card.x).toBeGreaterThan((art?.x ?? 0) + (art?.width ?? 0));
  });

  test('clicking a marker scrolls to its source and flashes it for about two seconds', async ({
    page,
  }) => {
    await page.goto(EN);
    await page.waitForLoadState('networkidle');
    await page.locator('a.ref-cite[data-ref="pool"]').scrollIntoViewIfNeeded();
    await page.locator('a.ref-cite[data-ref="pool"]').click();
    const tile = page.locator('.ref-tile[data-ref="pool"]');
    await expect(tile).toHaveClass(/flash/);
    const box = await tile.boundingBox();
    expect(box && box.y >= 0 && box.y + box.height <= 900).toBe(true); // it arrived on screen, then flashed
    await expect(tile).not.toHaveClass(/flash/, { timeout: 4000 }); // and the flash ends
  });

  test('a margin card and a "cited in" dot jump too', async ({ page }) => {
    await page.goto(EN);
    await page.waitForLoadState('networkidle');
    await page.locator('.ref-card[data-ref="bench"]').first().click();
    await expect(page.locator('.ref-tile[data-ref="bench"]')).toHaveClass(/flash/);
    await page.locator('.ref-tile[data-ref="tail"] .ref-dot').last().click();
    await expect(page.locator('.ref-claim.ping, .ref-claim').last()).toBeVisible();
  });

  test('hovering a source lights its passages and draws threads', async ({ page }) => {
    await page.goto(EN);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() =>
      document.querySelector('#references')?.scrollIntoView({ block: 'start' }),
    );
    await page.locator('.ref-tile[data-ref="tail"]').hover();
    await expect(page.locator('.prose a.ref-cite[data-ref="tail"]').first()).toHaveClass(/on/);
    await expect(page.locator('.ref-tile[data-ref="tail"]')).toHaveClass(/hot/);
  });

  test('filters hide other kinds and "All" brings them back', async ({ page }) => {
    await page.goto(EN);
    await page.getByRole('button', { name: /^Benchmark/ }).click();
    await expect(page.locator('.ref-tile:visible')).toHaveCount(2);
    await page.getByRole('button', { name: /^All/ }).click();
    await expect(page.locator('.ref-tile:visible')).toHaveCount(7);
  });

  test('the reading map has one dot per citation', async ({ page }) => {
    await page.goto(EN);
    await expect(page.locator('.ref-tick')).toHaveCount(9);
  });
});

test.describe('references: Persian', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the box stays English; text written inside a source keeps its Persian typography', async ({
    page,
  }) => {
    await page.goto(FA);
    await expect(page.locator('.ref-box h2')).toContainText('References');
    await expect(page.locator('.ref-box')).toHaveAttribute('dir', 'ltr');
    const note = page.locator('.ref-note[lang="fa"]').first();
    await expect(note).toBeVisible();
    const s = await note.evaluate((e) => {
      const c = getComputedStyle(e);
      return { font: c.fontFamily, spacing: c.letterSpacing, dir: c.direction };
    });
    expect(s.font).toContain('Vazirmatn');
    expect(['normal', '0px']).toContain(s.spacing);
    expect(s.dir).toBe('rtl');
    // the text uses the whole tile (not a narrow column)
    const tile = await note.locator('xpath=ancestor::article').boundingBox();
    const text = await note.boundingBox();
    expect((text?.width ?? 0) / (tile?.width ?? 1)).toBeGreaterThan(0.85);
  });

  test('on a Persian page the margin cards are on the left, away from the contents', async ({
    page,
  }) => {
    await page.goto(FA);
    await expect(page.locator('.ref-rail')).toBeVisible();
    const art = await page.locator('.art > article').boundingBox();
    const card = await page.locator('.ref-card').first().boundingBox();
    expect((card?.x ?? 0) + (card?.width ?? 0)).toBeLessThan(art?.x ?? 0);
  });
});

test.describe('references: phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('no sideways scroll; a first tap opens a card, the box is one column', async ({ page }) => {
    await page.goto(EN);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await expect(page.locator('.ref-rail')).toBeHidden();
    await page.locator('a.ref-cite').first().scrollIntoViewIfNeeded();
    await page.locator('a.ref-cite').first().tap();
    await expect(page.locator('.ref-pop.show')).toBeVisible();
    const cols = await page
      .locator('.ref-grid')
      .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(1);
  });
});

test('without any citation there is no box and no margin', async ({ page }) => {
  await page.goto('/blog/diagrams-demo');
  await expect(page.locator('.ref-box')).toHaveCount(0);
  await expect(page.locator('.ref-rail')).toHaveCount(0);
});
