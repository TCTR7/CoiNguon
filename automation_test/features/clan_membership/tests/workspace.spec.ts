import { AuthPage } from '../../auth/pages/AuthPage';

import { WorkspacePage } from '../pages/WorkspacePage';
import { test, expect } from '../../../common_setup/fixtures';
import AxeBuilder from '@axe-core/playwright';

test('two accounts join, switch clans, change roles and revoke access live', async ({
  page,
  browser,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const owner = 'Người tạo ' + suffix,
    relative = 'Người thân ' + suffix,
    clan = 'Gia đình ' + suffix;
  await new AuthPage(page).register(owner, { invite: '' });
  await new WorkspacePage(page).createClan(clan);
  await page.getByRole('button', { name: 'Tạo link mời', exact: true }).click();
  const link = await page.getByLabel('Link mời vừa tạo').inputValue();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await new AuthPage(guest).register(relative, { invite: new URL(link).search });
    await guest.getByRole('button', { name: 'Đồng ý tham gia' }).click();
    await page.bringToFront();
    await page
      .locator('.join-request')
      .filter({ hasText: 'Yêu cầu tham gia từ lời mời riêng' })
      .getByRole('button', { name: 'Duyệt tham gia', exact: true })
      .click();
    await expect(guest.getByRole('heading', { name: clan, exact: true })).toBeVisible();
    const row = page.locator('.member-item').filter({ hasText: relative });
    await expect(row).toBeVisible();
    await row.getByLabel('Vai trò của ' + relative).selectOption('admin');
    await expect(guest.getByRole('heading', { name: 'Mời người thân', exact: true })).toBeVisible();
    await row.getByLabel('Vai trò của ' + relative).selectOption('member');
    await expect(
      guest.getByRole('heading', { name: 'Mời người thân', exact: true }),
    ).not.toBeVisible();
    await expect(
      guest.getByText('Chỉ quản trị viên có thể mời người thân và thay đổi vai trò.'),
    ).toBeVisible();
    await row.getByRole('button', { name: 'Gỡ ' + relative, exact: true }).click();
    await page.getByRole('button', { name: 'Đồng ý gỡ' }).click();
    await expect(guest.getByRole('heading', { name: 'Chưa tham gia dòng họ nào' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: clan, exact: true })).not.toBeVisible();
    await guest.reload();
    await expect(guest.getByRole('heading', { name: 'Chưa tham gia dòng họ nào' })).toBeVisible();
  } finally {
    await guestContext.close();
  }
  await new WorkspacePage(page).createClan(clan + ' thứ hai');
  await page.getByLabel('Dòng họ đang xem').selectOption({ label: clan + ' · Quản trị viên' });
  await expect(page.getByRole('heading', { name: clan, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: clan, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await expect(page.getByText(owner, { exact: true })).not.toBeVisible();
});
test('revoked invitation is rejected and offline writes are not queued', async ({
  page,
  context,
  browser,
}) => {
  const clan = 'Nhánh thử ' + crypto.randomUUID().slice(0, 8);
  await new AuthPage(page).register('Người thử', { invite: '' });
  await new WorkspacePage(page).createClan(clan);
  await page.getByRole('button', { name: 'Tạo link mời', exact: true }).click();
  const link = await page.getByLabel('Link mời vừa tạo').inputValue();
  await page.getByRole('button', { name: /Thu hồi lời mời/ }).click();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await new AuthPage(guest).register('Khách thử', { invite: new URL(link).search });
    await expect(guest.getByRole('alert')).toContainText(
      'Lời mời đã dùng, hết hạn hoặc được thu hồi',
    );
    await expect(guest.getByRole('button', { name: 'Đồng ý tham gia' })).toBeDisabled();
  } finally {
    await guestContext.close();
  }
  await page.getByText('Tạo dòng họ mới', { exact: true }).click();
  await page.getByLabel('Tên dòng họ', { exact: true }).fill('Không được lưu khi offline');
  await context.setOffline(true);
  await expect(page.getByText('Đang ngoại tuyến — chỉ đọc', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo dòng họ', exact: true })).not.toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByLabel('Dòng họ đang xem')).not.toContainText('Không được lưu khi offline');
});
test('workspace forms and member management remain accessible at 320px and enlarged text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/dong-ho');
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await new AuthPage(page).register('Người dùng thử', { invite: '' });
  await new WorkspacePage(page).createClan('Gia đình kiểm tra giao diện');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.addStyleTag({ content: ':root {font-size:200% !important}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('creator hands off admin, confirms self-demotion, then leaves without deleting the genealogy', async ({
  page,
  browser,
  context,
}) => {
  const owner = 'Người tạo bàn giao',
    successor = 'Người tiếp quản',
    clan = 'Gia phả bàn giao ' + crypto.randomUUID().slice(0, 8);
  await new AuthPage(page).register(owner, { invite: '' });
  await new WorkspacePage(page).createClan(clan);
  const self = page.locator('.member-item').filter({ hasText: owner });
  await expect(self.getByLabel('Vai trò của ' + owner)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Rời gia phả', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Hồ sơ giữ sau bàn giao');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo link mời', exact: true }).click();
  const link = await page.getByLabel('Link mời vừa tạo').inputValue();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await new AuthPage(guest).register(successor, { invite: new URL(link).search });
    await guest.getByRole('button', { name: 'Đồng ý tham gia' }).click();
    await page.bringToFront();
    await page
      .locator('.join-request')
      .filter({ hasText: 'Yêu cầu tham gia từ lời mời riêng' })
      .getByRole('button', { name: 'Duyệt tham gia', exact: true })
      .click();
    await page
      .locator('.member-item')
      .filter({ hasText: successor })
      .getByLabel('Vai trò của ' + successor)
      .selectOption('admin');
    await expect(guest.getByRole('heading', { name: 'Mời người thân', exact: true })).toBeVisible();
    await self.getByLabel('Vai trò của ' + owner).selectOption('editor');
    const confirm = page.getByRole('region', { name: 'Xác nhận hạ quyền của bạn' });
    await expect(confirm).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await context.setOffline(true);
    await expect(page.getByText('Đang ngoại tuyến — chỉ đọc', { exact: true })).toBeVisible();
    await expect(confirm).not.toBeVisible();
    await context.setOffline(false);
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Đồng ý hạ quyền', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mời người thân', exact: true })).toHaveCount(0);
    await expect(self).toContainText('Biên tập viên');
    await expect(self).toContainText('Người tạo dòng họ');
    await expect(self.getByRole('combobox')).toHaveCount(0);
    await expect(page.locator('.genealogy-list')).toContainText('Hồ sơ giữ sau bàn giao');
    await page.getByRole('button', { name: 'Rời gia phả', exact: true }).click();
    await page.getByRole('button', { name: 'Đồng ý rời gia phả', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Chưa tham gia dòng họ nào' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: clan, exact: true })).toHaveCount(0);
    await expect(guest.locator('.genealogy-list')).toContainText('Hồ sơ giữ sau bàn giao');
    await expect(guest.getByRole('button', { name: 'Rời gia phả', exact: true })).toBeDisabled();
    await expect(
      guest.getByRole('status').filter({ hasText: 'Bạn là quản trị viên cuối cùng' }),
    ).toBeVisible();
  } finally {
    await guestContext.close();
  }
});

test('creator can leave as admin after granting another admin; the successor keeps management access', async ({
  page,
  browser,
}) => {
  const owner = 'Người tạo rời đi',
    successor = 'Admin ở lại',
    clan = 'Gia phả giữ quản trị ' + crypto.randomUUID().slice(0, 8);
  await new AuthPage(page).register(owner, { invite: '' });
  await new WorkspacePage(page).createClan(clan);
  await page.getByRole('button', { name: 'Tạo link mời', exact: true }).click();
  const link = await page.getByLabel('Link mời vừa tạo').inputValue();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await new AuthPage(guest).register(successor, { invite: new URL(link).search });
    await guest.getByRole('button', { name: 'Đồng ý tham gia' }).click();
    await page.bringToFront();
    await page
      .locator('.join-request')
      .filter({ hasText: 'Yêu cầu tham gia từ lời mời riêng' })
      .getByRole('button', { name: 'Duyệt tham gia', exact: true })
      .click();
    await page
      .locator('.member-item')
      .filter({ hasText: successor })
      .getByLabel('Vai trò của ' + successor)
      .selectOption('admin');
    await expect(page.getByRole('button', { name: 'Rời gia phả', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Rời gia phả', exact: true }).click();
    await page.getByRole('button', { name: 'Ở lại gia phả', exact: true }).click();
    await expect(page.getByRole('heading', { name: clan, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Rời gia phả', exact: true }).click();
    await page.getByRole('button', { name: 'Đồng ý rời gia phả', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Chưa tham gia dòng họ nào' })).toBeVisible();
    await guest.reload();
    await expect(guest.getByRole('heading', { name: clan, exact: true })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Mời người thân', exact: true })).toBeVisible();
    await expect(guest.locator('.member-item').filter({ hasText: owner })).toHaveCount(0);
    await expect(
      guest.locator('.member-item').filter({ hasText: successor }).getByRole('combobox'),
    ).toBeDisabled();
  } finally {
    await guestContext.close();
  }
});
