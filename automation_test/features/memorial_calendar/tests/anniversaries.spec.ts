import { MemorialCalendarPage } from '../pages/MemorialCalendarPage';
import { test, expect } from '../../../common_setup/fixtures';
import AxeBuilder from '@axe-core/playwright';
test.use({ timezoneId: 'America/New_York' });

test('confirm, publish, reschedule and cancel a real annual event', async ({ page }) => {
  // The viewer timezone must not shift the Vietnamese civil anniversary date.
  await page.context().setDefaultTimeout(15000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const calendar = await new MemorialCalendarPage(page).setup();
  await calendar.getByRole('button', { name: 'Sửa sự kiện', exact: true }).click();
  const form = calendar.getByRole('region', { name: 'Chỉnh sửa buổi giỗ' });
  await expect(form.getByLabel('Ngày giỗ xác nhận (dương lịch)', { exact: true })).toHaveValue(
    '2026-02-17',
  );
  await form
    .getByLabel('Tôi đã đối chiếu và xác nhận ngày giỗ với gia đình', { exact: true })
    .check();
  await form.getByLabel('Ngày tổ chức', { exact: true }).fill('2026-02-21');
  await form.getByLabel('Giờ tổ chức', { exact: true }).fill('10:00');
  await form.getByLabel('Địa chỉ tổ chức', { exact: true }).fill('Nhà thờ họ mẫu');
  await form
    .getByLabel('Hạn phản hồi (giờ tại địa điểm)', { exact: true })
    .fill('2026-02-20T18:00');
  await form.getByRole('button', { name: 'Lưu buổi giỗ', exact: true }).click();
  await expect(form).not.toBeVisible();
  await calendar.getByRole('button', { name: 'Công bố trong dòng họ', exact: true }).click();
  await expect(calendar.locator('.memorial-card')).toContainText('Đã công bố');
  await calendar.getByRole('button', { name: 'Sửa sự kiện', exact: true }).click();
  await form.getByLabel('Ngày tổ chức', { exact: true }).fill('2026-02-22');
  await form.getByRole('button', { name: 'Lưu buổi giỗ', exact: true }).click();
  await expect(calendar.locator('.memorial-card')).toContainText('2026-02-22');
  await expect(calendar.locator('.date-origin')).toContainText('01/01/?');
  await expect(calendar.locator('.memorial-card')).toContainText('2026-02-17');
  page.once('dialog', (dialog) => dialog.accept());
  await calendar.getByRole('button', { name: 'Hủy sự kiện', exact: true }).click();
  await expect(calendar.locator('.memorial-card')).toContainText('Đã hủy');
  await calendar.getByRole('button', { name: 'Mở lại bản nháp', exact: true }).click();
  await expect(calendar.locator('.memorial-card')).toContainText('Cần xác nhận');
  await expect(calendar.getByRole('button', { name: 'Tạo bản nháp' })).toHaveCount(0);
});
test('calendar editing remains accessible at 320px and 200% text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const calendar = await new MemorialCalendarPage(page).setup();
  await calendar.getByRole('button', { name: 'Sửa sự kiện', exact: true }).click();
  await page.evaluate(() => document.fonts.ready.then(() => true));
  expect(
    (
      await new AxeBuilder({ page })
        .include('.calendar-workspace')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.addStyleTag({ content: ':root {font-size:200% !important}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('a recipient accepts permanent responsibility explicitly', async ({ page, context }) => {
  const calendar = await new MemorialCalendarPage(page).setup();
  await page.getByRole('button', { name: 'Tạo link mời', exact: true }).click();
  const invite = await page.getByLabel('Link mời vừa tạo', { exact: true }).inputValue();
  const second = await context.newPage();
  try {
    await new MemorialCalendarPage(second).register('Người nhận mẫu');
    await second.goto(invite);
    await second.getByRole('button', { name: 'Đồng ý tham gia', exact: true }).click();
    const secondCalendar = second.getByRole('region', { name: 'Lịch giỗ dòng họ' });
    await expect(secondCalendar.locator('.host-name')).toContainText('Chủ sự mẫu');
    await page.bringToFront();
    await calendar.locator('summary').filter({ hasText: 'Chuyển chủ sự lâu dài' }).click();
    const transfer = calendar
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: 'Chuyển chủ sự lâu dài' }) });
    await expect(transfer).toHaveJSProperty('open', true);
    await transfer
      .getByRole('combobox', { name: 'Người nhận trách nhiệm', exact: true })
      .selectOption({ label: 'Người nhận mẫu' });
    await transfer.getByRole('button', { name: 'Gửi đề nghị chuyển chủ sự', exact: true }).click();
    await expect(calendar.locator('.host-name')).toContainText('Chủ sự mẫu');
    await second.bringToFront();
    await secondCalendar
      .getByRole('button', { name: 'Đồng ý nhận trách nhiệm', exact: true })
      .click();
    await expect(secondCalendar.locator('.host-name')).toContainText('Người nhận mẫu');
    await expect(calendar.locator('.host-name')).toContainText('Người nhận mẫu');
    await expect(
      secondCalendar.locator('summary').filter({ hasText: 'Chuyển chủ sự lâu dài' }),
    ).toBeVisible();
    await second.reload();
    await expect(
      second.getByRole('region', { name: 'Lịch giỗ dòng họ' }).locator('.host-name'),
    ).toContainText('Người nhận mẫu', { timeout: 15000 });
  } finally {
    await second.close();
  }
});
