import { expect, type Page, test } from '@playwright/test';
import PocketBase from 'pocketbase';

const PB = process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090';
const stamp = Date.now();
const ADMIN = { email: 'dev-admin@example.com', password: 'dev-admin-password-1' };
let su: PocketBase;

test.beforeAll(async () => {
  su = new PocketBase(PB);
  su.autoCancellation(false);
  await su
    .collection('_superusers')
    .authWithPassword(
      process.env.PB_SUPERUSER_EMAIL ?? '',
      process.env.PB_SUPERUSER_PASSWORD ?? '',
    );
});
test.afterAll(async () => {
  for (const p of await su.collection('posts').getFullList({ filter: `slug ~ "${stamp}"` }))
    await su.collection('posts').delete(p.id);
});

test.describe('public reading', () => {
  test('heading levels 3–6 are visibly styled, not body text', async ({ page }) => {
    await page.goto('/blog/diagrams-demo');
    const size = (sel: string) =>
      page
        .locator(sel)
        .first()
        .evaluate((e) => Number.parseFloat(getComputedStyle(e).fontSize));
    const body = await page
      .locator('.prose > p')
      .first()
      .evaluate((e) => Number.parseFloat(getComputedStyle(e).fontSize));
    const [h2, h3, h4] = [
      await size('.prose h2'),
      await size('.prose h3'),
      await size('.prose h4'),
    ];
    expect(h3).toBeGreaterThan(body + 3);
    expect(h4).toBeGreaterThan(body);
    expect(h2).toBeGreaterThan(h3);
    expect(h3).toBeGreaterThan(h4);
    for (const t of ['h5', 'h6']) {
      const weight = await page
        .locator(`.prose ${t}`)
        .first()
        .evaluate((e) => Number(getComputedStyle(e).fontWeight));
      expect(weight, t).toBeGreaterThanOrEqual(600);
    }
  });

  test('code blocks use the GitHub Dark colours', async ({ page }) => {
    await page.goto('/blog/diagrams-demo');
    const bg = await page
      .locator('.prose .term')
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg).toBe('rgb(13, 17, 23)'); // #0d1117
    expect(await page.locator('.prose .term pre').first().getAttribute('style')).toContain(
      '--shiki-dark-bg:#0d1117',
    );
  });

  test('Persian: heading numbers sit on the same (right) side as the heading, in Persian digits', async ({
    page,
  }) => {
    await page.goto('/fa/blog/diagrams-demo');
    const h2 = page.locator('.prose h2').first();
    await expect(h2.locator('span')).toHaveText('/۰۱');
    const [h, s] = await Promise.all([
      h2.boundingBox(),
      h2.locator('span').evaluate((e) => (e as HTMLElement).getBoundingClientRect().toJSON()),
    ]);
    expect((s.right as number) > (h?.x ?? 0) + (h?.width ?? 0) - 60).toBe(true); // flush with the right edge
    expect(await h2.locator('span').evaluate((e) => getComputedStyle(e).textAlign)).toBe('right');
  });

  test('Persian typography: Vazirmatn, no letter-spacing or uppercasing on Persian text', async ({
    page,
  }) => {
    await page.goto('/fa/blog/hello-bilingual');
    const style = (sel: string) =>
      page
        .locator(sel)
        .first()
        .evaluate((e) => {
          const c = getComputedStyle(e);
          return { font: c.fontFamily, spacing: c.letterSpacing, transform: c.textTransform };
        });
    for (const sel of ['nav.nav a', '.meta-grid .mono', '.row h3, .nextprev h3']) {
      const s = await style(sel);
      expect(s.font, sel).toContain('Vazirmatn');
      expect(['normal', '0px'], sel).toContain(s.spacing);
      expect(s.transform, sel).toBe('none');
    }
    // navigation numbers are Persian digits too
    await expect(page.locator('nav.nav a').first().locator('em')).toHaveText(/[۰-۹]{2}/);
    // the Latin brand keeps its own look
    expect(await page.locator('.brand').evaluate((e) => getComputedStyle(e).fontFamily)).toContain(
      'Bricolage',
    );
    expect(
      await page.locator('.post-head h1').evaluate((e) => getComputedStyle(e).fontFamily),
    ).toContain('Vazirmatn');
  });

  test('on the Persian site posts default to Persian (titles in lists, links, prev/next)', async ({
    page,
  }) => {
    await page.goto('/fa/blog');
    await expect(
      page.locator('.row h3', { hasText: 'چرا دوباره وبلاگم را از نو ساختم' }),
    ).toBeVisible();
    await expect(page.locator('.row h3', { hasText: 'Why I rebuilt my blog' })).toHaveCount(0);
    await page.goto('/fa');
    await expect(page.locator('.card h3', { hasText: 'چرا دوباره' })).toBeVisible();
    await page.locator('.card', { hasText: 'چرا دوباره' }).click();
    await page.waitForURL('**/fa/blog/hello-bilingual');
    await expect(page.locator('h1')).toHaveText('چرا دوباره وبلاگم را از نو ساختم');
    await expect(page.locator('.prose')).toHaveAttribute('lang', 'fa');
  });

  test('the language switch sits next to the content, not in the header, with no stuck label', async ({
    page,
  }) => {
    await page.goto('/blog/hello-bilingual');
    await expect(page.locator('.post-head .langseg')).toHaveCount(0);
    const bar = page.locator('article .langbar .langseg');
    await expect(bar).toBeVisible();
    const [bb, prose] = await Promise.all([
      bar.boundingBox(),
      page.locator('.prose').boundingBox(),
    ]);
    expect((prose?.y ?? 0) - ((bb?.y ?? 0) + (bb?.height ?? 0))).toBeGreaterThanOrEqual(20); // breathing room above the text
    await expect(page.locator('.meta-grid')).not.toContainText('Language');
  });
});

test.describe('diagrams', () => {
  test('mermaid renders an interactive diagram: zoom, reset, full screen, Esc', async ({
    page,
  }) => {
    await page.goto('/blog/diagrams-demo');
    const block = page.locator('.mermaid-block').first();
    await block.scrollIntoViewIfNeeded();
    await expect(block.locator('svg').first()).toBeVisible({ timeout: 20000 });
    await expect(block).toHaveAttribute('data-done', 'dark');
    const viewport = () =>
      block.locator('svg .svg-pan-zoom_viewport').first().getAttribute('transform');
    const before = await viewport();
    await block.hover();
    await block.getByRole('button', { name: 'Zoom in' }).click();
    await expect.poll(viewport).not.toBe(before);
    await block.getByRole('button', { name: 'Reset view' }).click();
    await block.getByRole('button', { name: 'Full screen' }).click();
    await expect(block).toHaveClass(/is-full/);
    const box = await block.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) - 1);
    await page.keyboard.press('Escape');
    await expect(block).not.toHaveClass(/is-full/);
    // drag pans
    const t0 = await viewport();
    const b = (await block.locator('.mm-view').boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 80, b.y + b.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    expect(await viewport()).not.toBe(t0);
  });

  test('Ctrl+wheel zooms, a plain wheel keeps scrolling the page', async ({ page }) => {
    await page.goto('/blog/diagrams-demo');
    const block = page.locator('.mermaid-block').first();
    await block.scrollIntoViewIfNeeded();
    await expect(block.locator('svg').first()).toBeVisible({ timeout: 20000 });
    const viewport = () =>
      block.locator('svg .svg-pan-zoom_viewport').first().getAttribute('transform');
    const before = await viewport();
    await block.hover();
    await page.mouse.wheel(0, 200);
    expect(await viewport()).toBe(before);
    await block.hover(); // the plain wheel scrolled the page, so find the diagram again
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -300);
    await page.keyboard.up('Control');
    await expect.poll(viewport).not.toBe(before);
  });

  test('changing the site theme re-renders diagrams in the matching colours', async ({ page }) => {
    await page.goto('/blog/diagrams-demo');
    const block = page.locator('.mermaid-block').first();
    await block.scrollIntoViewIfNeeded();
    await expect(block).toHaveAttribute('data-done', 'dark', { timeout: 20000 });
    await page.locator('[data-theme-toggle]').click();
    await expect(block).toHaveAttribute('data-done', 'light', { timeout: 20000 });
    await expect(block.locator('svg').first()).toBeVisible();
  });

  test('a broken diagram shows a clear message and keeps its source', async ({ page }) => {
    const slug = `e2e-mm-${stamp}`;
    const p = await su
      .collection('posts')
      .create({ slug, date: '2030-02-02 00:00:00.000Z', status: 'published', tags: [] });
    await su.collection('post_translations').create({
      post: p.id,
      lang: 'en',
      title: `Broken ${stamp}`,
      summary: '',
      body_md: '```mermaid\nflowchart LR\n  A --> [[[\n```\n\nafter',
    });
    await page.goto(`/blog/${slug}`);
    const block = page.locator('.mermaid-block');
    await expect(block).toHaveClass(/mm-error/, { timeout: 20000 });
    await expect(block.locator('.mm-errmsg')).toContainText('could not be rendered');
    await expect(block.locator('.mermaid-src')).toContainText('flowchart LR');
    await expect(page.locator('.prose')).toContainText('after');
  });

  test('without JavaScript the diagram source is still readable', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/blog/diagrams-demo');
    await expect(page.locator('.mermaid-block .mermaid-src').first()).toContainText('flowchart LR');
    await ctx.close();
  });
});

test.describe('likes and comments UI', () => {
  const user = { email: `ui-${stamp}@example.com`, password: 'a-long-password-123' };
  let postId = '';

  test.beforeAll(async () => {
    await su
      .collection('users')
      .create({ ...user, passwordConfirm: user.password, name: 'Replier', verified: true });
    postId = (await su.collection('posts').getFirstListItem('slug = "diagrams-demo"')).id;
    const u = await su.collection('users').getFirstListItem(`email = "${user.email}"`);
    // a user's first comment is held by a hook, so approve it afterwards (updates bypass the hook)
    const held = await su.collection('comments').create({
      post: postId,
      user: u.id,
      body: `Parent comment ${stamp}`,
      author_name: 'Replier',
    });
    await su.collection('comments').update(held.id, { status: 'approved' });
  });
  test.afterAll(async () => {
    for (const u of await su.collection('users').getFullList({ filter: `email = "${user.email}"` }))
      await su.collection('users').delete(u.id);
  });

  async function open(page: Page) {
    await page.request.post('/api/auth/login', { data: user });
    await page.goto('/blog/diagrams-demo');
    await page.locator('.nextprev').scrollIntoViewIfNeeded();
  }

  test('replying shows which comment you answer: highlight, composer under it, accent line, quote, cancel', async ({
    page,
  }) => {
    await open(page);
    const parent = page.locator('.cmt', { hasText: `Parent comment ${stamp}` });
    await expect(parent).toBeVisible();
    await parent.getByRole('button', { name: 'Reply' }).click();
    await expect(parent).toHaveClass(/replying/);
    const composer = page.locator('form.reply-composer');
    await expect(composer).toBeVisible();
    await expect(composer.locator('.reply-head')).toContainText('Replying to');
    await expect(composer.locator('.reply-head')).toContainText('Replier');
    await expect(composer.locator('.reply-quote')).toContainText(`Parent comment ${stamp}`);
    await expect(composer.locator('textarea')).toBeFocused();
    // the composer hangs off the comment: directly below it, and the usual bottom box is gone
    const [pb, cb] = await Promise.all([parent.boundingBox(), composer.boundingBox()]);
    expect((cb?.y ?? 0) - ((pb?.y ?? 0) + (pb?.height ?? 0))).toBeLessThan(80);
    expect(await composer.evaluate((e) => getComputedStyle(e).borderInlineStartWidth)).toBe('3px');
    await expect(page.locator('form.auth-form')).toHaveCount(1);
    await composer.getByRole('button', { name: 'Cancel' }).click();
    await expect(parent).not.toHaveClass(/replying/);
    await expect(page.locator('form.reply-composer')).toHaveCount(0);
    await expect(page.locator('form.auth-form')).toHaveCount(1); // the normal box is back
  });

  test('posting the reply threads it under its parent', async ({ page }) => {
    await open(page);
    const parent = page.locator('.cmt', { hasText: `Parent comment ${stamp}` });
    await parent.getByRole('button', { name: 'Reply' }).click();
    await page.locator('form.reply-composer textarea').fill(`Threaded reply ${stamp}`);
    await page.locator('form.reply-composer').getByRole('button', { name: 'Reply' }).click();
    await expect(page.locator('.cmt.re', { hasText: `Threaded reply ${stamp}` })).toBeVisible();
    await expect(page.locator('form.reply-composer')).toHaveCount(0);
  });

  test('liking fires a big, multi-coloured confetti burst', async ({ page }) => {
    await open(page);
    await page.waitForResponse((r) => r.url().includes('/api/interactions/'));
    const like = page.locator('[data-like]');
    if ((await like.getAttribute('aria-pressed')) === 'true') await like.click(); // start from "not liked"
    await expect(like).toHaveAttribute('aria-pressed', 'false');
    await like.click();
    const canvas = page.locator('canvas').last();
    await expect(canvas).toBeAttached({ timeout: 5000 });
    // a full-viewport canvas above everything (the burst is large, not a small puff)
    const box = (await canvas.boundingBox()) as { width: number; height: number };
    expect(box.width).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) - 2);
    expect(await canvas.evaluate((c) => Number(getComputedStyle(c).zIndex))).toBeGreaterThanOrEqual(
      700,
    );
    await like.click(); // leave it unliked
  });
});

test.describe('back office: nothing typed is lost', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post('/api/auth/login', { data: ADMIN });
  });

  test('Persian text without a Persian title is refused with a clear message and nothing is wiped', async ({
    page,
  }) => {
    const slug = `e2e-nolose-${stamp}`;
    await page.goto('/admin#/posts/new');
    await page.getByLabel('Slug (URL)').fill(slug);
    await page.locator('.adm-title').fill('English title');
    await page.getByRole('tab', { name: /فارسی/ }).click();
    await page.locator('.cm-content').click();
    await page.keyboard.type('متنی که نباید گم شود');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.adm-toast.err')).toContainText('Persian needs a title');
    await expect(page.getByRole('tab', { name: /فارسی/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.cm-content')).toContainText('متنی که نباید گم شود');
    expect((await su.collection('posts').getFullList({ filter: `slug = "${slug}"` })).length).toBe(
      0,
    ); // nothing submitted
    // give it a title → saves, and the text is still there afterwards
    await page.locator('.adm-title').fill('عنوان');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.adm-toast.ok', { hasText: 'Saved' })).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('متنی که نباید گم شود');
    const post = await su.collection('posts').getFirstListItem(`slug = "${slug}"`);
    const rows = await su
      .collection('post_translations')
      .getFullList({ filter: `post = "${post.id}"` });
    expect(rows.find((r) => r.lang === 'fa')?.body_md).toContain('متنی که نباید گم شود');
  });

  test('saving keeps the language tab and the cursor where they were (no reload of the editor)', async ({
    page,
  }) => {
    const slug = `e2e-stay-${stamp}`;
    await page.goto('/admin#/posts/new');
    await page.getByLabel('Slug (URL)').fill(slug);
    await page.locator('.adm-title').fill('Stay');
    await page.getByRole('tab', { name: /فارسی/ }).click();
    await page.locator('.adm-title').fill('بمان');
    await page.locator('.cm-content').click();
    await page.keyboard.type('line one\nline two\nline three');
    await page.keyboard.press('Control+Home');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.adm-toast.ok', { hasText: 'Saved' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /فارسی/ })).toHaveAttribute('aria-selected', 'true');
    expect(page.url()).toMatch(/#\/posts\/[a-z0-9]{15}$/);
    // still the same editor: typing continues at the cursor (start of the document)
    await page.locator('.cm-content').focus();
    await page.keyboard.type('X');
    await expect(page.locator('.cm-line').first()).toHaveText('Xline one');
    // second save, again in place
    await page.keyboard.press('Control+s');
    await expect(page.locator('.adm-toast.ok', { hasText: 'Saved' }).last()).toBeVisible();
    await expect(page.getByRole('tab', { name: /فارسی/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('unsaved writing survives a closed tab: it is offered back after reload', async ({
    page,
  }) => {
    const p = await su.collection('posts').create({
      slug: `e2e-draft-${stamp}`,
      date: '2030-03-03 00:00:00.000Z',
      status: 'draft',
      tags: [],
    });
    await su
      .collection('post_translations')
      .create({ post: p.id, lang: 'en', title: 'Saved title', summary: '', body_md: 'saved body' });
    await page.goto(`/admin#/posts/${p.id}`);
    await expect(page.locator('.adm-title')).toHaveValue('Saved title');
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' plus unsaved words');
    await page.waitForTimeout(900); // the local backup is debounced
    await page.goto('about:blank'); // "close" the tab without saving
    await page.goto(`/admin#/posts/${p.id}`);
    const banner = page.getByRole('alert').filter({ hasText: 'Unsaved writing found' });
    await expect(banner).toBeVisible();
    await expect(page.locator('.cm-content')).not.toContainText('unsaved words'); // the saved version is shown until you choose
    await banner.getByRole('button', { name: 'Restore it' }).click();
    await expect(page.locator('.cm-content')).toContainText('saved body plus unsaved words');
    await page.getByRole('button', { name: /^Save/ }).click();
    await expect(page.locator('.adm-toast.ok', { hasText: 'Saved' })).toBeVisible();
    await page.reload();
    await expect(banner).toHaveCount(0); // saving cleared the backup
    await expect(page.locator('.cm-content')).toContainText('plus unsaved words');
  });

  test('a recovered draft can be discarded', async ({ page }) => {
    const p = await su.collection('posts').create({
      slug: `e2e-disc-${stamp}`,
      date: '2030-03-04 00:00:00.000Z',
      status: 'draft',
      tags: [],
    });
    await su
      .collection('post_translations')
      .create({ post: p.id, lang: 'en', title: 'Keep me', summary: '', body_md: 'original' });
    await page.goto(`/admin#/posts/${p.id}`);
    await page.locator('.adm-title').fill('Keep me edited');
    await page.waitForTimeout(900);
    await page.goto('about:blank');
    await page.goto(`/admin#/posts/${p.id}`);
    const banner = page.getByRole('alert').filter({ hasText: 'Unsaved writing found' });
    await banner.getByRole('button', { name: 'Discard' }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.locator('.adm-title')).toHaveValue('Keep me');
    await page.goto('about:blank');
    await page.goto(`/admin#/posts/${p.id}`);
    await expect(banner).toHaveCount(0);
  });

  test('the editor preview renders diagrams too', async ({ page }) => {
    await page.goto('/admin#/posts/new');
    await page.locator('.cm-content').click();
    await page.keyboard.type('```mermaid\nflowchart LR\n  A --> B\n```');
    await expect(page.locator('.adm-pane.preview .mermaid-block svg').first()).toBeVisible({
      timeout: 20000,
    });
  });
});
