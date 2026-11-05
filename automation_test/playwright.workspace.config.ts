import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';

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
  testMatch: [
    '**/auth/tests/*.spec.ts',
    '**/clan_membership/tests/*.spec.ts',
    '**/genealogy/tests/*.spec.ts',
    '**/memorial_calendar/tests/*.spec.ts',
    '**/clan_joining/tests/*.spec.ts',
    '**/invitations/tests/*.spec.ts',
  ],
  timeout: 60000,
  workers: 2,
});
