import { defineConfig } from '@playwright/test';
import workspace from './playwright.workspace.config';

export default defineConfig({
  ...workspace,
  testMatch: [...(workspace.testMatch as string[]), '**/ui_quality/tests/*.spec.ts'],
  use: {
    ...workspace.use,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
});
