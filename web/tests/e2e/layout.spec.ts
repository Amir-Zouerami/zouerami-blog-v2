import { expect, type Page, test } from '@playwright/test';
import PocketBase from 'pocketbase';

const stamp = Date.now();
const ADMIN = { email: 'dev-admin@example.com', password: 'dev-admin-password-1' };
let su: PocketBase;
const slugs = ['a', 'b', 'c', 'd'].map((x) => `e2e-lay-${x}-${stamp}`);
const ids: string[] = [];
/** Posts that were marked featured before these tests (the layout page changes the marks; they are put back). */
let featuredBefore: string[] = [];

test.beforeAll(async () => {
  su = new PocketBase(process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090');
  su.autoCancellation(false);
  await su
    .collection('_superusers')
    .authWithPassword(
      process.env.PB_SUPERUSER_EMAIL ?? '',
      process.env.PB_SUPERUSER_PASSWORD ?? '',
    );
  featuredBefore = (await su.collection('posts').getFullList({ filter: 'featured = true' })).map(
    (p) => p.id,
  );
  // newer than anything seeded: the automatic homepage shows D, C, B, A first
  for (const [i, slug] of slugs.entries()) {
    const p = await su.collection('posts').create({
      slug,
      date: `2031-01-0${i + 1} 00:00:00.000Z`,
      status: 'published',
      tags: [],
    });
    ids.push(p.id);
    await su.collection('post_translations').create({
      post: p.id,
      lang: 'en',
      title: `Layout ${'ABCD'[i]} ${stamp}`,
      summary: 's',
      body_md: 'Body',
    });
  }
});
test.afterAll(async () => {
  for (const id of ids) await su.collection('posts').delete(id);
  for (const l of await su.collection('layouts').getFullList())
    await su.collection('layouts').delete(l.id);
  // the layout page changes which posts are marked featured: put the marks back as they were
  for (const p of await su.collection('posts').getFullList()) {
    const was = featuredBefore.includes(p.id);
    if (p.featured !== was) await su.collection('posts').update(p.id, { featured: was });
  }
});
test.beforeEach(async ({ page }) => {
  for (const l of await su.collection('layouts').getFullList())
    await su.collection('layouts').delete(l.id);
  await page.request.post('/api/auth/login', { data: ADMIN });
});

/** The posts of the tiles on a public page, in order (`.ptiles` of the homepage / the featured collage). */
async function tiles(page: Page, path: string): Promise<string[]> {
  await page.goto(path);
  const hrefs = await page
    .locator('.ptiles')
    .first()
    .locator('a.ptile')
    .evaluateAll((a) => a.map((x) => (x as HTMLAnchorElement).getAttribute('href') ?? ''));
  return hrefs.map((h) => h.split('/').pop() ?? '');
}

test.describe('layout page', () => {
  test('the homepage follows the order chosen by drag and drop, and goes back to the newest five', async ({
    page,
  }) => {
    // before: automatic = the newest five, newest first
    expect((await tiles(page, '/')).slice(0, 4)).toEqual([slugs[3], slugs[2], slugs[1], slugs[0]]);

    await page.goto('/admin#/layout');
    const home = page.locator('[data-board="home"]');
    await expect(home.locator('[data-slot]')).toHaveCount(5);
    await expect(home.getByText('Automatic', { exact: true })).toBeVisible();
    // drag the first tile onto the fourth: they swap
    await home.locator('[data-slot="0"]').dragTo(home.locator('[data-slot="3"]'));
    await expect(home.getByText('Unsaved changes')).toBeVisible();
    await home.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    // slot 1 was D (newest): after the swap A is first and D fourth
    expect((await tiles(page, '/')).slice(0, 4)).toEqual([slugs[0], slugs[2], slugs[1], slugs[3]]);

    // fewer posts = a different arrangement, only what was chosen
    await page.goto('/admin#/layout');
    await expect(home.locator('[data-slot]')).toHaveCount(5);
    for (let i = 0; i < 2; i++)
      await home
        .getByRole('button', { name: /^Remove / })
        .last()
        .click();
    await expect(home.locator('[data-slot]')).toHaveCount(3);
    await expect(home.locator('.lay-grid')).toHaveAttribute('data-count', '3');
    await home.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    expect(await tiles(page, '/')).toEqual([slugs[0], slugs[2], slugs[1]]);

    // back to automatic
    await page.goto('/admin#/layout');
    await home.getByRole('button', { name: 'Back to the newest five' }).click();
    await expect(page.getByText('Back to automatic')).toBeVisible();
    expect((await tiles(page, '/')).slice(0, 4)).toEqual([slugs[3], slugs[2], slugs[1], slugs[0]]);
  });

  test('a post can be dragged in from "Not shown" and chosen from a menu', async ({ page }) => {
    await page.goto('/admin#/layout');
    const home = page.locator('[data-board="home"]');
    await expect(home.locator('[data-slot]')).toHaveCount(5);
    // the 6th newest is not shown: put it on the first tile by drag
    const pool = home.locator('[data-chip]').first();
    const dragged = await pool.getAttribute('data-chip');
    await pool.dragTo(home.locator('[data-slot="0"]'));
    await home.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    expect((await tiles(page, '/'))[0]).toBe(dragged);
    // and with the menu of tile 2
    await page.goto('/admin#/layout');
    await home.getByLabel('Post in tile 2').selectOption(ids[0] as string);
    await home.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    expect((await tiles(page, '/'))[1]).toBe(slugs[0]);
  });

  test('the featured collage: choose posts and their order', async ({ page }) => {
    await page.goto('/admin#/layout');
    const feat = page.locator('[data-board="featured"]');
    await expect(feat).toBeVisible();
    // start from nothing
    while (await feat.getByRole('button', { name: /^Remove / }).count())
      await feat
        .getByRole('button', { name: /^Remove / })
        .first()
        .click();
    for (const letter of ['B', 'C', 'A']) {
      await feat.getByLabel('Add a post').selectOption({ label: `Layout ${letter} ${stamp}` });
    }
    await expect(feat.locator('[data-slot]')).toHaveCount(3);
    await feat.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    // marked as featured in the data, shown in the chosen order
    expect((await su.collection('posts').getOne(ids[0] as string)).featured).toBe(true);
    expect((await su.collection('posts').getOne(ids[3] as string)).featured).toBe(false);
    expect(await tiles(page, '/blog')).toEqual([slugs[1], slugs[2], slugs[0]]);
    // swap the first and the last
    await page.goto('/admin#/layout');
    await feat.locator('[data-slot="0"]').dragTo(feat.locator('[data-slot="2"]'));
    await feat.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    expect(await tiles(page, '/blog')).toEqual([slugs[0], slugs[2], slugs[1]]);
  });
});
