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
