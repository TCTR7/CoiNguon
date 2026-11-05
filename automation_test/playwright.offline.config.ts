import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';
import { repoRoot } from './common_setup/paths.ts';

const isAiAgent = process.env.AI_AGENT === '1';

export default defineConfig({
  ...base,
  ...(isAiAgent
    ? {
        maxFailures: 1,
        reporter: [['line']],
        use: {
          ...base.use,
          screenshot: 'off',
          video: 'off',
          trace: 'off',
        },
      }
    : {}),
  testMatch: '**/offline_backup/tests/*.spec.ts',
  timeout: 90000,
  workers: 1,
  webServer: {
    env: base.webServer && !Array.isArray(base.webServer) ? base.webServer.env : {},
    command: 'node scripts/check-local-build.mjs && npm run preview:workspace',
    cwd: repoRoot,
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
  },
});
