import { expect, type Locator, type Page, test } from '@playwright/test';
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

const home = (page: Page) => page.locator('[data-board="home"]');
const featured = (page: Page) => page.locator('[data-board="featured"]');
const save = async (page: Page, board: Locator) => {
  await board.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
};
/** Opens a tile's "Change" dialog, searches, and chooses the post with that slug. */
async function change(page: Page, board: Locator, tile: number, slug: string) {
  await board.getByRole('button', { name: `Change post in tile ${tile}` }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Search posts' }).fill(slug);
  await dialog.locator(`[data-result="${slug}"]`).click();
  await expect(dialog).toHaveCount(0);
}

test.describe('layout page', () => {
  test('the homepage follows the order chosen by drag and drop, and goes back to the newest five', async ({
    page,
  }) => {
    // before: automatic = the newest five, newest first
    expect((await tiles(page, '/')).slice(0, 4)).toEqual([slugs[3], slugs[2], slugs[1], slugs[0]]);

    await page.goto('/admin#/layout');
    const board = home(page);
    await expect(board.locator('[data-slot]')).toHaveCount(5);
    await expect(board.getByText(/^Automatic/)).toBeVisible();
    // no native dropdown anywhere on the page
    await expect(page.locator('.adm-main select')).toHaveCount(0);
    // drag the first tile onto the fourth: they swap
    await board.locator('[data-slot="0"]').dragTo(board.locator('[data-slot="3"]'));
    await expect(board.getByText('Unsaved changes')).toBeVisible();
    await save(page, board);
    expect((await tiles(page, '/')).slice(0, 4)).toEqual([slugs[0], slugs[2], slugs[1], slugs[3]]);

    // fewer posts = a different arrangement, only what was chosen
    await page.goto('/admin#/layout');
    await expect(board.locator('[data-slot]')).toHaveCount(5);
    for (let i = 0; i < 2; i++)
      await board
        .getByRole('button', { name: /^Remove / })
        .last()
        .click();
    await expect(board.locator('[data-slot]')).toHaveCount(3);
    await expect(board.locator('.lay-grid')).toHaveAttribute('data-count', '3');
    await expect(board.locator('[data-add]')).toBeVisible(); // the dashed tile after the three
    await save(page, board);
    expect(await tiles(page, '/')).toEqual([slugs[0], slugs[2], slugs[1]]);

    // back to automatic
    await page.goto('/admin#/layout');
    await board.getByRole('button', { name: 'Back to automatic' }).click();
    await expect(board.getByText(/^Automatic/)).toBeVisible();
    expect((await tiles(page, '/')).slice(0, 4)).toEqual([slugs[3], slugs[2], slugs[1], slugs[0]]);
  });

  test('"Change" opens a search over all posts; choosing one puts it in that tile', async ({
    page,
  }) => {
    await page.goto('/admin#/layout');
    const board = home(page);
    await expect(board.locator('[data-slot]')).toHaveCount(5);
    await board.getByRole('button', { name: 'Change post in tile 2' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = dialog.getByRole('combobox', { name: 'Search posts' });
    // searching narrows the list (by title)
    await box.fill(`Layout B ${stamp}`);
    await expect(dialog.locator('[data-result]')).toHaveCount(1);
    await expect(dialog.locator(`[data-result="${slugs[1]}"]`)).toBeVisible();
    // and by address
    await box.fill(`e2e-lay-c-${stamp}`);
    await expect(dialog.locator('[data-result]')).toHaveCount(1);
    // nothing found says so
    await box.fill(`no-such-post-${stamp}`);
    await expect(dialog.getByText(/No post matches/)).toBeVisible();
    // Escape closes without changing anything
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(board.getByText('Unsaved changes')).toHaveCount(0);

    // a post that is not in the layout replaces the one in the tile
    await board.getByRole('button', { name: 'Change post in tile 2' }).click();
    await dialog.getByRole('combobox', { name: 'Search posts' }).fill('english-only');
    await dialog.locator('[data-result="english-only"]').click();
    await expect(board.getByText('Unsaved changes')).toBeVisible();
    // a post already in another tile is swapped with it (the dialog says so)
    await board.getByRole('button', { name: 'Change post in tile 1' }).click();
    await dialog.getByRole('combobox', { name: 'Search posts' }).fill(slugs[0] as string);
    await expect(dialog.locator('[data-result]')).toHaveCount(1);
    await expect(dialog.getByText(/In tile \d · swap/)).toBeVisible();
    await dialog.locator(`[data-result="${slugs[0]}"]`).click();
    await expect(board.locator('[data-slot="0"]')).toContainText(`Layout A ${stamp}`);
    await save(page, board);
    expect((await tiles(page, '/')).slice(0, 2)).toEqual([slugs[0], 'english-only']);
  });

  test('the dashed tile adds posts; the featured collage keeps their order', async ({ page }) => {
    await page.goto('/admin#/layout');
    const board = featured(page);
    await expect(board).toBeVisible();
    // start from nothing
    while (await board.getByRole('button', { name: /^Remove / }).count())
      await board
        .getByRole('button', { name: /^Remove / })
        .first()
        .click();
    await expect(board.locator('[data-slot]')).toHaveCount(0);
    for (const letter of ['b', 'c', 'a']) {
      await board.locator('[data-add]').click();
      await page.getByRole('combobox', { name: 'Search posts' }).fill(`e2e-lay-${letter}-${stamp}`);
      await page.locator(`[data-result="e2e-lay-${letter}-${stamp}"]`).click();
    }
    await expect(board.locator('[data-slot]')).toHaveCount(3);
    await save(page, board);
    // marked as featured in the data, shown in the chosen order
    expect((await su.collection('posts').getOne(ids[0] as string)).featured).toBe(true);
    expect((await su.collection('posts').getOne(ids[3] as string)).featured).toBe(false);
    expect(await tiles(page, '/blog')).toEqual([slugs[1], slugs[2], slugs[0]]);
    // swap the first and the last
    await page.goto('/admin#/layout');
    await board.locator('[data-slot="0"]').dragTo(board.locator('[data-slot="2"]'));
    await save(page, board);
    expect(await tiles(page, '/blog')).toEqual([slugs[0], slugs[2], slugs[1]]);
  });
});
