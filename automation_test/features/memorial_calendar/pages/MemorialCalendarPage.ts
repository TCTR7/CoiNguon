import { expect, type Page } from '@playwright/test';
import { AuthPage } from '../../auth/pages/AuthPage';
import { fakeEmail } from '../../../common_setup/test-data';
export class MemorialCalendarPage {
  constructor(readonly page: Page) {}
  async register(name = 'Chủ sự mẫu') {
    return new AuthPage(this.page).register(name, {
      email: fakeEmail('calendar', 'family.test'),
      password: 'calendar-local-123',
    });
  }
  async setup() {
    const page = this.page;
    await this.register();
    await page.getByText('Tạo dòng họ mới', { exact: true }).click();
    await page.getByLabel('Tên dòng họ', { exact: true }).fill('Gia đình ngày sum họp');
    await page.getByRole('button', { name: 'Tạo dòng họ', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
    await page.getByLabel('Tên hiển thị', { exact: true }).fill('Cụ Mẫu Ngày Giỗ');
    await page.getByRole('combobox', { name: 'Tình trạng', exact: true }).selectOption('deceased');
    await page.getByText('Thêm thông tin chi tiết', { exact: true }).click();
    await page.getByRole('combobox', { name: 'Lịch ngày mất', exact: true }).selectOption('lunar');
    await page.getByLabel('Ngày mất', { exact: true }).fill('1');
    await page.getByLabel('Tháng mất', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    const calendar = page.getByRole('region', { name: 'Lịch giỗ dòng họ' });
    await expect(calendar.getByRole('heading', { name: 'Chủ sự lâu dài' })).toBeVisible();
    await calendar.getByRole('spinbutton', { name: 'Năm lịch giỗ', exact: true }).fill('2026');
    await calendar.getByText('Thiết lập quy tắc', { exact: true }).click();
    await calendar.getByRole('button', { name: 'Lưu quy tắc', exact: true }).click();
    await expect(calendar.getByText('Ngày gợi ý (dương lịch):')).toContainText('2026-02-17');
    await calendar
      .getByRole('combobox', { name: 'Phân công chủ sự', exact: true })
      .selectOption({ label: 'Chủ sự mẫu' });
    await calendar.getByRole('button', { name: 'Lưu phân công', exact: true }).click();
    await expect(
      calendar.locator('summary').filter({ hasText: 'Chuyển chủ sự lâu dài' }),
    ).toBeVisible();
    await calendar.getByRole('button', { name: 'Tạo bản nháp', exact: false }).click();
    await expect(calendar.locator('.memorial-card')).toContainText('Cần xác nhận');
    return calendar;
  }
}
