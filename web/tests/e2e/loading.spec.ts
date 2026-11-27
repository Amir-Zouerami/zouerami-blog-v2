import { expect, type Page, test } from '@playwright/test';

/** Holds requests to `url` until released, so the waiting state can be looked at. */
async function hold(page: Page, url: string, reply?: { status: number; code: string }) {
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route(url, async (route) => {
    await gate;
    if (!reply) return route.continue();
    await route.fulfill({
      status: reply.status,
      contentType: 'application/json',
      body: JSON.stringify({ meta: { code: reply.code }, data: null, traceId: 'e2e-trace' }),
    });
  });
  return () => release();
}

test('subscribing shows a spinner, blocks a second send, then says how it went', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  let sent = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/subscribe')) sent++;
  });
  const release = await hold(page, '**/api/subscribe', { status: 200, code: 'ok' });
  const button = page.locator('#sub button');
  const email = page.locator('#sub input[name=email]');
  const width = (await button.boundingBox())?.width;
  await email.fill('loading@example.com');
  await button.click();
  await expect(button).toHaveAttribute('data-busy', '');
  await expect(button).toBeDisabled();
  await expect(email).toHaveAttribute('readonly', '');
  expect((await button.boundingBox())?.width).toBe(width); // the spinner does not move anything
  await email.press('Enter');
  release();
  await expect(page.locator('#sub-msg')).toHaveAttribute('data-kind', 'ok');
  await expect(button).toBeEnabled();
  await expect(button).not.toHaveAttribute('data-busy', '');
  await expect(email).toHaveValue('');
  expect(sent).toBe(1);
});

test('a failed subscription releases the form and keeps the address', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const release = await hold(page, '**/api/subscribe', { status: 500, code: 'upstream_error' });
  await page.locator('#sub input[name=email]').fill('loading@example.com');
  await page.locator('#sub button').click();
  release();
  await expect(page.locator('#sub-msg')).toHaveAttribute('data-kind', 'err');
  await expect(page.locator('#sub button')).toBeEnabled();
  await expect(page.locator('#sub input[name=email]')).toHaveValue('loading@example.com');
  await expect(page.locator('#sub input[name=email]')).not.toHaveAttribute('readonly', '');
});

test('signing in shows a spinner while it waits', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  const release = await hold(page, '**/api/auth/login', {
    status: 401,
    code: 'invalid_credentials',
  });
  await page.getByLabel('Email').fill('someone@example.com');
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  const button = page.locator('.auth-form button[type=submit]');
  await button.click();
  await expect(button).toHaveAttribute('data-busy', '');
  await expect(button).toBeDisabled();
  release();
  await expect(page.locator('.auth-form [data-msg]')).toHaveAttribute('data-kind', 'err');
  await expect(button).toBeEnabled();
});

test('the search palette shows that it is searching, not that nothing was found', async ({
  page,
}) => {
  await page.goto('/blog');
  await page.waitForLoadState('networkidle');
  const release = await hold(page, '**/api/search**');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('zzqqxx');
  await expect(page.locator('.pal-searching .ui-spin')).toBeVisible();
  release();
  await expect(page.locator('.pal-searching')).toHaveCount(0);
});
