import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests (tests/), run in Chromium against the production build served with its real
 * headers: `npm run build`, then `npm test`. No retries: a failure is a real failure.
 */
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 10 * 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:8788',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npx wrangler dev --config tests/wrangler.jsonc --port 8788 --ip 127.0.0.1',
    url: 'http://127.0.0.1:8788/',
    reuseExistingServer: !process.env.CI,
    env: { CI: '1', WRANGLER_SEND_METRICS: 'false' },
    timeout: 120_000,
  },
});
