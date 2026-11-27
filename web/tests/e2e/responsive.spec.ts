import { expect, test } from '@playwright/test';

/** Visible things that stick out of the screen (not counting what scrolls inside its own box). */
const outside = () => {
  const W = document.documentElement.clientWidth;
  return [
    ...document.querySelectorAll(
      'main :is(input, button, kbd, figure, .mermaid-block, .tl-card, .prose > p, article, aside)',
    ),
  ]
    .filter((el) => !el.closest('.hp, [hidden], .lanyard, .prose table, pre'))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 2 && (r.left < -1 || r.right > W + 1);
    })
    .map((el) => `${el.tagName}.${el.className}`);
};

for (const width of [320, 390, 768]) {
  test(`nothing sticks out of a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const url of [
      '/',
      '/fa',
      '/blog',
      '/fa/blog',
      '/blog/diagrams-demo',
      '/blog/hello-bilingual',
      '/work/lumen',
      '/fa/work/lumen',
      '/about',
      '/fa/about',
    ]) {
      await page.goto(url);
      expect(await page.evaluate(outside), url).toEqual([]);
    }
  });
}

test('posts and projects share one text column, and phones keep a margin at the sides', async ({
  page,
}) => {
  const column = async (url: string, width: number) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    const box = await page.locator('article .prose').boundingBox();
    return { x: Math.round(box?.x ?? 0), width: Math.round(box?.width ?? 0) };
  };
  for (const width of [390, 768, 1280, 1440, 1920]) {
    const post = await column('/blog/hello-bilingual', width);
    expect(await column('/work/lumen', width), `${width}px`).toEqual(post);
    if (width === 390) expect(post.width / width).toBeGreaterThan(0.9);
    if (width === 390) expect(post.x).toBeGreaterThanOrEqual(16);
    if (width >= 1280) expect(post.width).toBe(880);
  }
});

test('on a phone every column of an admin table can be reached', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/login');
  await page.getByLabel('Email').fill('dev-admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('dev-admin-password-1');
  await page.locator('.auth-form button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.includes('login'));
  await page.goto('/admin#/projects');
  const down = page.getByRole('button', { name: /^Move .* down$/ }).first();
  await down.scrollIntoViewIfNeeded();
  await expect(down).toBeInViewport({ ratio: 1 });
  const table = await page.locator('.adm-table').boundingBox();
  expect((table?.x ?? 0) + (table?.width ?? 999)).toBeLessThanOrEqual(390);
});

test('code boxes sit centred on the text column', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/blog/hello-bilingual');
    const text = await page.locator('article .prose').boundingBox();
    const code = await page.locator('.prose .term').first().boundingBox();
    const left = (text?.x ?? 0) - (code?.x ?? 0);
    const right = (code?.x ?? 0) + (code?.width ?? 0) - ((text?.x ?? 0) + (text?.width ?? 0));
    expect(Math.abs(left - right), `${width}px`).toBeLessThan(2);
  }
});
