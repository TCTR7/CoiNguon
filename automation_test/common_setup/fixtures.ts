import { test as base } from '@playwright/test';
import { AuthPage } from '../features/auth/pages/AuthPage';
import { WorkspacePage } from '../features/clan_membership/pages/WorkspacePage';
export const test = base.extend<{ authPage: AuthPage; workspacePage: WorkspacePage }>({
  authPage: async ({ page }, provide) => {
    await provide(new AuthPage(page));
  },
  workspacePage: async ({ page }, provide) => {
    await provide(new WorkspacePage(page));
  },
});
export { expect } from '@playwright/test';
