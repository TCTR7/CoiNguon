import { expect, type Page } from '@playwright/test';
export class PreparednessPage {
  constructor(readonly page: Page) {}
  async download() {
    const page = this.page;
    await page.getByLabel('Đây là thiết bị riêng tôi tin cậy.', { exact: false }).check();
    await page.getByRole('button', { name: 'Tải dữ liệu để đọc ngoại tuyến', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã tải hồ sơ chữ' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  }

  async logout() {
    await this.page
      .getByRole('button', { name: 'Đăng xuất và xóa dữ liệu đã tải', exact: true })
      .click();
    await expect(
      this.page.getByText('Cần tài khoản đã đăng nhập trên thiết bị tin cậy.', { exact: false }),
    ).toBeVisible();
  }
}
