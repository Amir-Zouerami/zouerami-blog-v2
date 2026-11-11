import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const compose = (cmd: string) =>
  execSync(`docker compose -f compose.yaml -f compose.dev.yaml ${cmd}`, {
    cwd: '..',
    stdio: 'pipe',
  });

async function pbBack() {
  for (let i = 0; i < 60; i++) {
    const ok = await fetch('http://127.0.0.1:8090/api/health')
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('PocketBase did not come back');
}

test.describe('layout and theme', () => {
  test('SSR html has lang/dir, nav links, one h1 and footer with JS disabled', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Amir Zouerami');
    for (const l of ['Home', 'Blog', 'Work', 'About'])
      await expect(page.locator('nav.nav').getByText(l, { exact: false })).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await ctx.close();
  });

  test('stored light theme is applied before first paint and toggle persists', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('sig-theme', 'light');
      }
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('blocked localStorage does not break the page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await page.locator('[data-theme-toggle]').click();
    expect(errors).toEqual([]);
  });

  test('no third-party font requests', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (r) => hosts.add(new URL(r.url()).hostname));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect([...hosts].filter((h) => h !== 'localhost')).toEqual([]);
  });

  test('theme survives client-router navigation', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sig-theme', 'light'));
    await page.goto('/');
    await page.locator('nav.nav a', { hasText: 'About' }).click();
    await page.waitForURL('**/about');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('wipe transition', () => {
  test('covers then clears; URL changes', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav.nav a', { hasText: 'Blog' }).click();
    await expect(page.locator('#wipe.on')).toHaveCount(1, { timeout: 2000 });
    await expect(page.locator('#wipe')).toBeHidden({ timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe('/blog');
  });

  test('reduced motion: no overlay at all', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    let sawOn = false;
    await page.exposeFunction('sawOn', () => {
      sawOn = true;
    });
    await page.evaluate(() => {
      new MutationObserver(() => {
        if (document.getElementById('wipe')?.classList.contains('on'))
          (window as never as { sawOn: () => void }).sawOn();
      }).observe(document.documentElement, { subtree: true, attributes: true });
    });
    await page.locator('nav.nav a', { hasText: 'About' }).click();
    await page.waitForURL('**/about');
    expect(sawOn).toBe(false);
    await ctx.close();
  });

  test('navigating to a missing page never leaves the screen covered', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '/blog/missing-page';
      a.id = 'lnk';
      a.textContent = 'x';
      document.body.append(a);
    });
    await page.locator('#lnk').click();
    await expect(page.locator('#wipe')).toBeHidden({ timeout: 6000 });
  });

  test('touch devices get no custom cursor styles', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto('/');
    expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).not.toContain('url(');
    await ctx.close();
  });

  test('desktop gets the pixel cursor', async ({ page }) => {
    await page.goto('/');
    const cursor = () => page.evaluate(() => getComputedStyle(document.body).cursor);
    expect(await cursor()).toContain('url(');
    // it must survive client-side navigation (it used to vanish after leaving the home page)
    for (const link of ['Blog', 'Work', 'About']) {
      await page.locator('nav.nav a', { hasText: link }).click();
      await page.waitForURL(`**/${link.toLowerCase()}`);
      expect(await cursor(), link).toContain('url(');
    }
    await page.goto('/fa/about');
    expect(await cursor()).toContain('url(');
    await page.goto('/admin');
    expect(await cursor()).toContain('url(');
  });
});

test.describe('command palette', () => {
  test('opens with Ctrl+K, filters, navigates with Enter, restores focus on Escape', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('[data-palette-open]').focus();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-palette-open]')).toBeFocused();

    await page.keyboard.press('Control+k');
    await page.keyboard.type('about');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/about');
  });

  test('Tab stays inside the dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+k');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('dialog').locator('input')).toBeFocused();
  });

  test('search finds a published post', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('rebuilt');
    await expect(page.getByRole('dialog').locator('li', { hasText: 'post' }).first()).toBeVisible();
  });

  test('with PocketBase down, static commands still work and search shows an error row', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    compose('stop pocketbase');
    try {
      await page.keyboard.press('Control+k');
      await page.keyboard.type('bl');
      await expect(page.getByText('Search unavailable')).toBeVisible({ timeout: 8000 });
      await expect(page.getByRole('dialog').locator('li', { hasText: 'Blog' })).toBeVisible();
    } finally {
      compose('start pocketbase');
      await pbBack();
    }
  });
});

test.describe('home and 404', () => {
  test('home has sections, published posts, no drafts, projects', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Latest writing')).toBeVisible();
    await expect(page.getByText('Selected work')).toBeVisible();
    await expect(page.locator('.row').first()).toBeVisible();
    await expect(page.locator('.tile').first()).toBeVisible();
    expect(await page.content()).not.toContain('An unfinished draft');
  });

  test('404 is a real 404 with escaped path echo', async ({ request, page }) => {
    const res = await request.get('/nope');
    expect(res.status()).toBe(404);
    await page.goto('/%3Cscript%3Ealert(1)%3C/script%3E');
    await expect(page.locator('.tty')).toContainText('cd /<script>alert(1)</script>');
    await expect(page.locator('main script')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Home' }).last()).toBeVisible();
  });
});

test.describe('visual regressions found in review', () => {
  test('Persian home keeps the Latin hero name left-to-right (not reversed)', async ({ page }) => {
    await page.goto('/fa');
    const h1 = page.locator('h1#heroName');
    await expect(h1).toHaveAttribute('dir', 'ltr');
    const letters = await h1.locator('.ch').allTextContents();
    expect(letters.join('')).toBe('AmirZouerami');
    // visually: the "A" of Amir is left of the "r" that ends it
    const first = await h1.locator('.ch').first().boundingBox();
    const fourth = await h1.locator('.ch').nth(3).boundingBox();
    expect((first?.x ?? 0) < (fourth?.x ?? 0)).toBe(true);
  });

  test('on a phone the nav sits at the bottom and does not cover the brand or tools', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('/');
    const nav = await page.locator('nav.nav').boundingBox();
    const brand = await page.locator('.brand').boundingBox();
    const theme = await page.locator('[data-theme-toggle]').boundingBox();
    expect((nav?.y ?? 0) > 600).toBe(true);
    expect(brand && brand.y < 64 && brand.width > 20).toBe(true);
    expect(theme && theme.y < 64).toBe(true);
    await ctx.close();
  });
});
