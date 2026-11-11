import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Superuser creds for test fixtures (CI copies .env.example to ../.env).
if (existsSync('../.env')) process.loadEnvFile('../.env');

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  reporter: 'list',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8088' },
});
