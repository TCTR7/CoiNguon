import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { repoRoot } from './common_setup/paths.ts';
export default defineConfig({
  testDir: resolve(repoRoot, 'automation_test/features'),
  testMatch: '**/ui_quality/tests/*.spec.ts',
  outputDir: resolve(repoRoot, 'automation_test/artifacts/test-results'),
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: {
    env: {
      APP_ENV: 'local',
      APP_ROLE: 'api',
      VITE_APP_ENV: 'local',
      VITE_FIREBASE_PROJECT_ID: 'demo-coinguon',
      VITE_API_BASE_URL: 'http://127.0.0.1:8787/api',
    },
    command: 'npm run dev -- --port 5173 --strictPort',
    cwd: repoRoot,
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'msedge' } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'msedge' },
    },
  ],
});
