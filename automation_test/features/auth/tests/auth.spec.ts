import { test, expect } from '../../../common_setup/fixtures';
test('register, reject an incorrect password, then log back in to the existing private clan', async ({
  page,
  authPage,
  workspacePage,
}) => {
  const email = await authPage.register('Người thử đăng nhập');
  const clan = 'Gia phả kiểm tra đăng nhập ' + crypto.randomUUID().slice(0, 6);
  await workspacePage.createClan(clan);
  await authPage.logout();
  await authPage.login(email, 'wrong-password-123');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: clan, exact: true })).toHaveCount(0);
  await authPage.login(email);
  await expect(page.getByRole('heading', { name: clan, exact: true })).toBeVisible();
  await authPage.logout();
});
