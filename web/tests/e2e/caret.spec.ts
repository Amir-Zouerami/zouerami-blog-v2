import { expect, test } from '@playwright/test';
import PocketBase from 'pocketbase';

// Real scroll bars take room from the editor. Headless Chromium hides them unless told not to.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const stamp = Date.now();
let su: PocketBase;
const made: string[] = [];

test.beforeAll(async () => {
  su = new PocketBase(process.env.PB_TEST_URL ?? 'http://127.0.0.1:8090');
  su.autoCancellation(false);
  await su
    .collection('_superusers')
    .authWithPassword(
      process.env.PB_SUPERUSER_EMAIL ?? '',
      process.env.PB_SUPERUSER_PASSWORD ?? '',
    );
});
test.beforeEach(async ({ page }) => {
  await page.request.post('/api/auth/login', {
    data: { email: 'dev-admin@example.com', password: 'dev-admin-password-1' },
  });
});
test.afterAll(async () => {
  for (const id of made) await su.collection('posts').delete(id);
});

async function post(lang: 'en' | 'fa', line: (i: number) => string): Promise<string> {
  const p = await su.collection('posts').create({
    slug: `e2e-caret-${lang}-${stamp}`,
    date: '2030-10-10 00:00:00.000Z',
    status: 'draft',
    tags: [],
  });
  made.push(p.id);
  await su.collection('post_translations').create({
    post: p.id,
    lang,
    title: 'Caret',
    summary: '',
    body_md: Array.from({ length: 80 }, (_, i) => line(i + 1)).join('\n'),
  });
  return p.id;
}

/** The drawn caret and the letter just typed, on the last line (the editor scrolls, so it has a scroll bar). */
async function caretAndLastLetter(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const sc = document.querySelector('.cm-scroller') as HTMLElement;
    const lines = document.querySelectorAll('.cm-line');
    const last = lines[lines.length - 1] as HTMLElement;
    const walker = document.createTreeWalker(last, NodeFilter.SHOW_TEXT);
    let text: Text | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) text = n as Text;
    const r = document.createRange();
    r.setStart(text as Text, (text as Text).length - 1);
    r.setEnd(text as Text, (text as Text).length);
    const letter = r.getBoundingClientRect();
    const caret = (document.querySelector('.cm-cursor') as HTMLElement).getBoundingClientRect();
    return {
      bar: sc.offsetWidth - sc.clientWidth,
      caret: caret.left,
      letterLeft: letter.left,
      letterRight: letter.right,
    };
  });
}

test.describe('the caret is where the next letter goes, even when the editor scrolls', () => {
  test('Persian (right to left)', async ({ page }) => {
    const id = await post('fa', (i) => `خط شماره ${i} این یک متن فارسی است`);
    await page.goto(`/admin#/posts/${id}`);
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(' تست');
    await expect(page.locator('.cm-cursor').first()).toBeVisible();
    const m = await caretAndLastLetter(page);
    expect(m.bar).toBeGreaterThan(0); // there is a scroll bar
    // new letters appear to the left of the last one: the caret sits on its left edge
    expect(Math.abs(m.caret - m.letterLeft)).toBeLessThan(3);
  });

  test('English (left to right)', async ({ page }) => {
    const id = await post('en', (i) => `line number ${i} of some english text`);
    await page.goto(`/admin#/posts/${id}`);
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(' end');
    await expect(page.locator('.cm-cursor').first()).toBeVisible();
    const m = await caretAndLastLetter(page);
    expect(m.bar).toBeGreaterThan(0);
    expect(Math.abs(m.caret - m.letterRight)).toBeLessThan(3);
  });
});
