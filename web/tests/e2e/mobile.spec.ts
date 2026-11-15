import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 360, height: 780 }, hasTouch: true });

for (const path of [
  '/',
  '/blog',
  '/blog/hello-bilingual',
  '/work',
  '/about',
  '/fa',
  '/fa/blog/hello-bilingual',
]) {
  test(`phone: ${path} does not scroll sideways`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll('main *, header *')]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.right > innerWidth + 1 &&
            !e.closest('.marq, .lanyard, svg, .pre, pre, .term')
          );
        })
        .map((e) => `${e.tagName}.${e.className}`)
        .slice(0, 5),
    );
    expect(wide).toEqual([]);
  });
}

test('phone: post shows like, save and share', async ({ page }) => {
  await page.goto('/blog/hello-bilingual');
  const acts = page.locator('.side .acts');
  await expect(acts).toBeVisible();
  await expect(acts.locator('button')).toHaveCount(3);
});

test('phone: reading progress reaches 100% at the bottom', async ({ page }) => {
  await page.goto('/blog/hello-bilingual');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('#rpill-num')).toHaveText('100');
});
