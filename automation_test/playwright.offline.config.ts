import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';
import { repoRoot } from './common_setup/paths.ts';
export default defineConfig({
  ...base,
  testMatch: '**/offline_backup/tests/*.spec.ts',
  timeout: 90000,
  workers: 1,
  webServer: {
    command: 'npm run preview:workspace',
    cwd: repoRoot,
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
  },
});
