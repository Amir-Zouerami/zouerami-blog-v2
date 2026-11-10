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
