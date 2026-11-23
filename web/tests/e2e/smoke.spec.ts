import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const compose = (cmd: string) =>
  execSync(`docker compose -f compose.yaml -f compose.dev.yaml ${cmd}`, {
    cwd: '..',
    stdio: 'pipe',
  });

test('index lists published posts and hides drafts', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('Why I rebuilt my blog (again)');
  expect(html).toContain('PocketBase in production');
  expect(html).toContain('تایپوگرافی فارسی در وب');
  expect(html).not.toContain('An unfinished draft');
});

test('PocketBase is reachable through nginx under /pb', async ({ request }) => {
  const res = await request.get('/pb/api/health');
  expect(res.status()).toBe(200);
});

test('the PocketBase admin dashboard is not exposed through the public proxy', async ({
  request,
}) => {
  const res = await request.get('/pb/_/', { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test('index answers 503 with a friendly message when PocketBase is down', async ({ request }) => {
  compose('stop pocketbase');
  try {
    const res = await request.get('/');
    expect(res.status()).toBe(503);
    const html = await res.text();
    expect(html).toContain('temporarily unavailable');
    expect(html).not.toMatch(/UpstreamError|node_modules|\bat .*\.(js|ts):\d+/);
  } finally {
    compose('start pocketbase');
    execSync('until curl -sf http://127.0.0.1:8090/api/health >/dev/null; do sleep 1; done', {
      shell: '/bin/bash',
      timeout: 60000,
    });
  }
});

test('only the public PocketBase endpoints are reachable through nginx (no bot-guard bypass)', async ({
  request,
}) => {
  for (const path of [
    '/pb/api/collections/users/records',
    '/pb/api/collections/posts/records',
    '/pb/api/collections/comments/records',
    '/pb/api/settings',
    '/pb/api/admins/auth-with-password',
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
    expect((await request.post(path, { data: {} })).status(), path).toBe(404);
  }
  expect((await request.get('/pb/api/health')).status()).toBe(200);
});

test.describe('search engines', () => {
  test('a trailing slash redirects permanently to the one canonical URL', async ({ request }) => {
    const res = await request.get('/blog/', { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toBe('/blog');
    const q = await request.get('/fa/blog/?tag=Design', { maxRedirects: 0 });
    expect(q.headers().location).toBe('/fa/blog?tag=Design');
  });

  test('robots.txt, manifest, icons and security.txt are served', async ({ request }) => {
    expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /pb/');
    const manifest = (await (await request.get('/site.webmanifest')).json()) as {
      icons: unknown[];
    };
    expect(manifest.icons.length).toBeGreaterThan(1);
    for (const path of ['/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'])
      expect((await request.get(path)).status()).toBe(200);
    expect(await (await request.get('/.well-known/security.txt')).text()).toContain('Contact:');
  });

  test('pages are indexable with a canonical URL, theme colour and large image previews', async ({
    page,
  }) => {
    await page.goto('/blog/hello-bilingual');
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
      'href',
      /\/blog\/hello-bilingual$/,
    );
    await expect(page.locator('meta[name=robots]')).toHaveAttribute(
      'content',
      /max-image-preview:large/,
    );
    await expect(page.locator('meta[name=theme-color]').first()).toHaveAttribute('content', /#/);
    await expect(page.locator('time[datetime]')).toHaveCount(1);
  });
});

test('fonts are real files, never base64 text inside the CSS (the CSP only allows font-src self)', async ({
  request,
}) => {
  const html = await (await request.get('/')).text();
  const sheets = [...html.matchAll(/href="([^"]+\.css)"/g)].map((m) => m[1] as string);
  expect(sheets.length).toBeGreaterThan(0);
  for (const href of sheets) {
    const css = await (await request.get(href)).text();
    expect(css).not.toContain('data:font');
  }
});
