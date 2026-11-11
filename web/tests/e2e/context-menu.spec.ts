import { expect, type Page, test } from '@playwright/test';
import PocketBase from 'pocketbase';

const PB = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090';
const stamp = Date.now();
const menu = (page: Page) => page.getByRole('menu').first();
/** The highlighted row of the innermost open menu. */
const active = (page: Page) => page.getByRole('menu').last().locator('.ctx-item[data-active]');
const items = (page: Page) => page.getByRole('menu').last().getByRole('menuitem');

async function ready(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test.describe('public site menu', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('right-clicking a link offers open / new tab / copy, plus the page actions; Esc closes', async ({
    page,
  }) => {
    await ready(page, '/');
    await page.locator('nav.nav a', { hasText: 'Blog' }).click({ button: 'right' });
    await expect(menu(page)).toBeVisible();
    await expect(menu(page)).toHaveAttribute('aria-label', 'Page menu');
    const names = await items(page).allTextContents();
    expect(names.join('|')).toMatch(
      /Open link.*Open in new tab.*Copy link address.*Search.*Go to.*Toggle theme.*Language.*Copy page link.*Back.*Reload/,
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('copy link address puts the absolute URL on the clipboard and says so', async ({ page }) => {
    await ready(page, '/');
    await page.locator('nav.nav a', { hasText: 'Work' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Copy link address/ }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'http://localhost:8088/work',
    );
    await expect(page.locator('#toast.show')).toContainText('Copied');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('page menu: toggle theme, Go to submenu navigates, nothing highlighted until you move', async ({
    page,
  }) => {
    await ready(page, '/');
    await page.mouse.click(640, 700, { button: 'right' });
    await expect(menu(page)).toBeVisible();
    await expect(page.locator('.ctx-item[data-active]')).toHaveCount(0);
    await page.getByRole('menuitem', { name: /Toggle theme/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.mouse.click(300, 650, { button: 'right' });
    await page.getByRole('menuitem', { name: /Go to/ }).hover();
    const sub = page.getByRole('menu').last();
    await expect(sub.getByRole('menuitem', { name: 'About' })).toBeVisible();
    await sub.getByRole('menuitem', { name: 'About' }).click();
    await page.waitForURL('**/about');
  });

  test('keyboard: Shift+F10 opens it on the focused element; arrows, typeahead, Enter, Esc restores focus', async ({
    page,
  }) => {
    await ready(page, '/');
    const link = page.locator('nav.nav a', { hasText: 'Blog' });
    await link.focus();
    await page.keyboard.press('Shift+F10');
    await expect(menu(page)).toBeVisible();
    await expect(active(page)).toContainText('Open link'); // keyboard opens on the first item
    await page.keyboard.press('ArrowDown');
    await expect(active(page)).toContainText('Open in new tab');
    await page.keyboard.press('End');
    await expect(active(page)).toContainText('Reload');
    await page.keyboard.press('ArrowDown'); // wraps
    await expect(active(page)).toContainText('Open link');
    await page.keyboard.type('copy l');
    await expect(active(page)).toContainText('Copy link address');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(link).toBeFocused();

    await page.keyboard.press('ContextMenu'); // the dedicated menu key works too
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('keyboard submenus: Right opens, Left closes, Enter navigates', async ({ page }) => {
    await ready(page, '/');
    await page.locator('nav.nav a', { hasText: 'Home' }).focus();
    await page.keyboard.press('Shift+F10');
    await page.keyboard.type('go');
    await expect(active(page)).toContainText('Go to');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menu')).toHaveCount(2);
    await expect(active(page)).toContainText('Home');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('menu')).toHaveCount(1);
    await expect(active(page)).toContainText('Go to');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.type('blog');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/blog');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('the browser menu is kept for inputs, for Shift+right-click, and the page is not hijacked on <html> scrollbars', async ({
    page,
  }) => {
    await ready(page, '/blog');
    await page.locator('.search-in input').click({ button: 'right' });
    await expect(page.getByRole('menu')).toHaveCount(0);
    const prevented = await page.evaluate(() => {
      const el = document.querySelector('nav.nav a') as HTMLElement;
      const ev = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        shiftKey: true,
        clientX: 20,
        clientY: 20,
      });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('always fully on screen, even when opened in the bottom-right corner; one menu at a time', async ({
    page,
  }) => {
    await ready(page, '/');
    const vp = page.viewportSize() as { width: number; height: number };
    await page.mouse.click(vp.width - 2, vp.height - 2, { button: 'right' });
    await expect(menu(page)).toBeVisible();
    const box = (await menu(page).boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
    await page.mouse.click(100, 100, { button: 'right' });
    await expect(page.getByRole('menu')).toHaveCount(1);
  });

  test('closes on outside click, scroll and window resize', async ({ page }) => {
    await ready(page, '/');
    await page.mouse.click(400, 400, { button: 'right' });
    await expect(menu(page)).toBeVisible();
    await page.mouse.click(50, 300);
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.mouse.click(400, 400, { button: 'right' });
    await page.mouse.wheel(0, 300);
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.mouse.click(400, 400, { button: 'right' });
    await page.setViewportSize({ width: 900, height: 600 });
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('selected text offers Copy and "Search for …", which opens the palette prefilled', async ({
    page,
  }) => {
    await ready(page, '/blog/hello-bilingual');
    await page.locator('.prose p').first().scrollIntoViewIfNeeded();
    await page.locator('.prose p').first().selectText();
    await page
      .locator('.prose p')
      .first()
      .click({ button: 'right', position: { x: 20, y: 10 } });
    await expect(page.getByRole('menuitem', { name: /^Copy/ }).first()).toBeVisible();
    await page.getByRole('menuitem', { name: /Search for/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input')).not.toHaveValue('');
  });

  test('headings can copy a link to their section; images get open/copy', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await ready(page, '/blog/hello-bilingual');
    const h2 = page.locator('.prose h2[id]').first();
    await h2.scrollIntoViewIfNeeded();
    const id = await h2.getAttribute('id');
    await h2.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Copy link to this section' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `http://localhost:8088/blog/hello-bilingual#${id}`,
    );
    const img = page.locator('.prose figure img');
    await img.scrollIntoViewIfNeeded();
    await img.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Open image in new tab' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Copy image address' })).toBeVisible();
  });

  test('Persian pages: Persian labels, RTL mirroring, the Language submenu switches the page', async ({
    page,
  }) => {
    await ready(page, '/fa/about');
    await page.mouse.click(600, 400, { button: 'right' });
    await expect(menu(page)).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /جستجو/ })).toBeVisible();
    await expect(menu(page)).toHaveAttribute('aria-label', 'منوی صفحه');
    await page.getByRole('menuitem', { name: /زبان/ }).hover();
    await page.getByRole('menu').last().getByRole('menuitem', { name: 'English' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/about');
  });

  test('keyboard submenus mirror in RTL: Left opens, Right closes', async ({ page }) => {
    await ready(page, '/fa');
    await page.locator('nav.nav a').first().focus();
    await page.keyboard.press('Shift+F10');
    await page.getByRole('menuitem', { name: /رفتن به/ }).hover();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('menu')).toHaveCount(2);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menu')).toHaveCount(1);
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true });
    test('a long press opens it; moving the finger cancels', async ({ page }) => {
      await ready(page, '/');
      const press = (moved: boolean) =>
        page.evaluate(async (move) => {
          const el = document.querySelector('nav.nav a') as HTMLElement;
          const fire = (type: string, x: number, y: number) =>
            el.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                pointerType: 'touch',
                clientX: x,
                clientY: y,
                isPrimary: true,
              }),
            );
          fire('pointerdown', 100, 40);
          if (move) fire('pointermove', 160, 90);
          await new Promise((r) => setTimeout(r, 700));
          fire('pointerup', 100, 40);
        }, moved);
      await press(true);
      await expect(page.getByRole('menu')).toHaveCount(0);
      await press(false);
      await expect(menu(page)).toBeVisible();
    });
  });
});

test.describe('back office menus', () => {
  let su: PocketBase;
  const slug = `e2e-ctx-${stamp}`;
  let postId = '';

  test.beforeAll(async () => {
    su = new PocketBase(PB);
    su.autoCancellation(false);
    await su
      .collection('_superusers')
      .authWithPassword(
        process.env.PB_SUPERUSER_EMAIL ?? '',
        process.env.PB_SUPERUSER_PASSWORD ?? '',
      );
    const p = await su.collection('posts').create({
      slug,
      date: '2030-01-02 00:00:00.000Z',
      status: 'published',
      tags: [],
      preview_token: `tok${stamp}`,
    });
    postId = p.id;
    await su.collection('post_translations').create({
      post: p.id,
      lang: 'en',
      title: `Ctx post ${stamp}`,
      summary: '',
      body_md: 'Hello',
    });
  });
  test.afterAll(async () => {
    for (const p of await su.collection('posts').getFullList({ filter: `slug ~ "${stamp}"` }))
      await su.collection('posts').delete(p.id);
  });
  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/auth/login', {
      data: { email: 'dev-admin@example.com', password: 'dev-admin-password-1' },
    });
  });
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('post rows: edit, view, copy link, unpublish/publish, delete', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await page.goto('/admin#/posts');
    const row = page.locator('tr', { hasText: `Ctx post ${stamp}` });
    await expect(row).toBeVisible();
    await row.click({ button: 'right' });
    await expect(menu(page)).toHaveAttribute('aria-label', 'Post actions');
    await expect(page.getByRole('menuitem', { name: 'View on site' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Copy public link' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `http://localhost:8088/blog/${slug}`,
    );

    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Unpublish' }).click();
    await expect
      .poll(async () => (await su.collection('posts').getOne(postId)).status)
      .toBe('draft');
    await expect(row.locator('.adm-pill')).toHaveText('draft');

    await row.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'View on site' })).toHaveCount(0); // drafts have no public page
    await expect(page.getByRole('menuitem', { name: 'Copy preview link' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Publish' }).click();
    await expect
      .poll(async () => (await su.collection('posts').getOne(postId)).status)
      .toBe('published');

    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await page.waitForURL(new RegExp(`#/posts/${postId}$`));

    await page.goto('/admin#/posts');
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Delete/ }).click();
    await expect
      .poll(
        async () =>
          (await su.collection('posts').getFullList({ filter: `slug = "${slug}"` })).length,
      )
      .toBe(0);
  });

  test('keyboard: the menu key on a focused row link opens the row menu', async ({ page }) => {
    const slug2 = `e2e-ctx2-${stamp}`;
    const p = await su
      .collection('posts')
      .create({ slug: slug2, date: '2030-01-03 00:00:00.000Z', status: 'draft', tags: [] });
    await su.collection('post_translations').create({
      post: p.id,
      lang: 'en',
      title: `Ctx keyboard ${stamp}`,
      summary: '',
      body_md: 'x',
    });
    await page.goto('/admin#/posts');
    await page.getByRole('link', { name: `Ctx keyboard ${stamp}` }).focus();
    await page.keyboard.press('Shift+F10');
    await expect(active(page)).toContainText('Edit');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: `Ctx keyboard ${stamp}` })).toBeFocused();
  });

  test('editor: cut / copy / paste / select all and Format ▸ Bold on the selection', async ({
    page,
  }) => {
    await page.goto(`/admin#/posts/${postId}`);
    const cm = page.locator('.cm-content');
    await cm.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('alpha beta');
    await page.keyboard.press('Control+a');
    await cm.click({ button: 'right' });
    await expect(menu(page)).toHaveAttribute('aria-label', 'Editor');
    await page.getByRole('menuitem', { name: 'Format' }).hover();
    await page.getByRole('menu').last().getByRole('menuitem', { name: 'Bold' }).click();
    await expect(cm).toContainText('**alpha beta**');

    await page.keyboard.press('Control+a');
    await cm.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Copy', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('**alpha beta**');
    await cm.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Cut' }).click();
    await expect(cm).not.toContainText('alpha');
    await cm.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Paste' }).click();
    await expect(cm).toContainText('**alpha beta**');
    await cm.click({ button: 'right', modifiers: ['Shift'] });
    await expect(page.getByRole('menu')).toHaveCount(0); // Shift+right-click leaves the browser's menu
  });
});
