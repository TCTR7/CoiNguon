import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../../common_setup/fixtures';
import { AuthPage } from '../pages/AuthPage';
test('Google emulator login, required phone, private inbox and admin-confirmed person link', async ({
  page,
  browser,
  workspacePage,
  authPage,
}) => {
  test.setTimeout(120000);
  const suffix = crypto.randomUUID().slice(0, 8);
  const clan = 'Gia phả mời riêng ' + suffix;
  const number =
    '09' + String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, '0');
  await authPage.register('Admin thử mời ' + suffix);
  await workspacePage.createClan(clan);
  await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Người thân bí mật ' + suffix);
  await page.getByRole('combobox', { name: 'Tình trạng', exact: true }).selectOption('living');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  const personInvite = page.getByRole('region', { name: 'Mời tài khoản vào hồ sơ', exact: true });
  await personInvite.getByLabel('Số điện thoại người được mời').fill(number);
  await personInvite.getByRole('button', { name: 'Lưu số liên hệ', exact: true }).click();
  await expect(personInvite).toContainText('Chưa mời');
  await personInvite.getByRole('button', { name: 'Mời tham gia', exact: true }).click();
  await expect(personInvite).toContainText('Đã mời — chờ phản hồi');
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    // Emulator widget uses optional CDN decoration. Keep auth tests local and deterministic.
    await context.route(
      /https:\/\/(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
      (route) => route.abort(),
    );
    await guest.goto('/dong-ho', { waitUntil: 'domcontentloaded' });
    const [popup] = await Promise.all([
      guest.waitForEvent('popup', { timeout: 15000 }),
      guest.getByRole('button', { name: 'Tiếp tục với Google (giả lập)' }).click(),
    ]);
    await popup.waitForLoadState('domcontentloaded');
    await popup.getByRole('button', { name: 'Add new account' }).click();
    await popup.locator('#email-input').fill('google-' + crypto.randomUUID() + '@family.test');
    await popup.locator('#display-name-input').fill('Người nhận Google ' + suffix);
    await popup.getByRole('button', { name: /Sign in with/ }).click();
    await expect(guest.getByLabel('Số điện thoại tài khoản')).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Lời mời của tôi', exact: true })).toHaveCount(
      0,
    );
    await guest.getByLabel('Số điện thoại tài khoản').fill(number);
    await guest.getByRole('button', { name: 'Hoàn tất tài khoản', exact: true }).click();
    const inbox = guest.getByRole('region', { name: 'Lời mời của tôi', exact: true });
    await expect(inbox).toContainText('Đã mời — chờ phản hồi');
    await expect(guest.getByText('Người thân bí mật ' + suffix, { exact: true })).toHaveCount(0);
    await expect(guest.getByRole('heading', { name: clan, exact: true })).toHaveCount(0);
    await inbox.getByRole('button', { name: 'Đây là tôi — yêu cầu tham gia', exact: true }).click();
    await expect(inbox).toContainText('Chờ admin xác nhận');
    const manage = page.getByRole('region', { name: 'Quản lý lời mời theo số', exact: true });
    await manage.getByRole('button', { name: 'Tải lại lời mời', exact: true }).click();
    await expect(manage).toContainText('Người nhận Google ' + suffix);
    await expect(
      manage.getByRole('button', { name: 'Xác nhận và cấp quyền', exact: true }),
    ).toBeDisabled();
    await manage
      .getByRole('checkbox', { name: 'Tôi đã đối chiếu đúng người thân qua kênh đã biết' })
      .check();
    await manage.getByRole('button', { name: 'Xác nhận và cấp quyền', exact: true }).click();
    await expect(guest.getByRole('heading', { name: clan, exact: true })).toBeVisible();
    await expect(guest.locator('.genealogy-list')).toContainText('Người thân bí mật ' + suffix);
    expect(
      (await new AxeBuilder({ page: guest }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await guest.setViewportSize({ width: 320, height: 740 });
    await guest.addStyleTag({ content: 'html { font-size: 200%; }' });
    expect(
      await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await new AuthPage(guest).logout();
    await expect(guest.getByRole('region', { name: 'Lời mời của tôi', exact: true })).toHaveCount(
      0,
    );
  } finally {
    await context.close();
  }
});
