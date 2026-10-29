import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';
export default defineConfig({
  ...base,
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
