import { deflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import PocketBase from 'pocketbase';

const stamp = Date.now();
const SLUG = `e2e-work-${stamp}`;
let su: PocketBase;

/** A 4×4 grey PNG. */
function png(): Buffer {
  const crc = (b: Buffer) => {
    let c = ~0;
    for (const byte of b) {
      c ^= byte;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const head = Buffer.from([0, 0, 0, 4, 0, 0, 0, 4, 8, 0, 0, 0, 0]);
  const rows = Buffer.from(Array.from({ length: 4 }, () => [0, 128, 128, 128, 128]).flat());
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

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
test.afterAll(async () => {
  for (const p of await su.collection('projects').getFullList({ filter: `slug = "${SLUG}"` }))
    await su.collection('projects').delete(p.id);
});

test('writing a project: draft preview, technology chips, cover, then publishing', async ({
  page,
  request,
}) => {
  // the seeded admin used by the other admin tests
  await page.goto('/login');
  await page.getByLabel('Email').fill('dev-admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('dev-admin-password-1');
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'));

  await page.goto('/admin#/projects/new');
  await page.getByLabel('Name').fill(`E2E Work ${stamp}`);
  await page.getByLabel('Slug (URL)').fill(SLUG);
  await page.getByLabel('Technologies (comma separated)').fill('Rust, Astro');
  await page.getByLabel('Card description (EN)').fill('A fixture project');
  await page.getByRole('button', { name: 'Stars icon' }).click();
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: png(),
  });
  await page.getByRole('button', { name: /^Save/ }).click();
  await page.waitForURL(/#\/projects\/[a-z0-9]{15}$/);
  await expect(page.locator('.adm-status')).toContainText('Draft');
  // saving again updates the same translation instead of creating a second one
  await page.getByLabel('Card description (EN)').fill('A fixture project, edited');
  await page.getByRole('button', { name: /^Save/ }).click();
  await expect(page.getByText('Unsaved changes')).toHaveCount(0);

  await page.locator('.adm-field button', { hasText: /^generate$/i }).click();
  const open = page.locator('.adm-field a', { hasText: /^Open$/ });
  await expect(open).toBeVisible();
  const link = (await open.getAttribute('href')) ?? '';
  expect((await request.get(`/work/${SLUG}`)).status()).toBe(404);
  expect((await request.get(`/work/${SLUG}?token=wrong`)).status()).toBe(404);
  const res = await request.get(link);
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('no-store');
  const html = await res.text();
  expect(html).toContain('A fixture project, edited');
  expect(html).toContain('Rust / Astro');
  expect(html).toContain('noindex');
  expect(html).toMatch(/\/pb\/api\/files\/projects\/[a-z0-9]{15}\/cover/);
  expect(html).not.toContain('class="nums"'); // no highlight number: no big zero

  // a highlight number, with the chosen icon beside it
  await page.getByLabel('Highlight number (optional)').fill('1200');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.locator('.adm-status')).toContainText('Published');
  await page.goto(`/work/${SLUG}`);
  await expect(page.locator('.nums b')).toHaveText('1,200');
  await expect(page.locator('.nums b svg path')).toHaveCount(1);
});

test('a project page uses the same cover frame as a post', async ({ page }) => {
  const frame = async (url: string, width: number) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    return page.locator('.post-cover-frame').evaluate((el) => {
      const r = el.getBoundingClientRect();
      const title = getComputedStyle(document.querySelector('.post-head h1') as Element);
      return {
        titleSize: title.fontSize,
        width: Math.round(r.width),
        ratio: Math.round((r.width / r.height) * 100) / 100,
        radius: getComputedStyle(el).borderRadius,
      };
    });
  };
  for (const [width, ratio] of [
    [1920, 2],
    [390, 1.78],
  ] as const) {
    const post = await frame('/blog/hello-bilingual', width);
    const project = await frame('/work/lumen', width);
    expect(project).toEqual(post);
    expect(project.ratio).toBeCloseTo(ratio, 1);
    expect(project.width).toBeLessThanOrEqual(1280);
  }
});
