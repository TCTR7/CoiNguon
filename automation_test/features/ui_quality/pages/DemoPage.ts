import { type Page } from '@playwright/test';

export class DemoPage {
  constructor(readonly page: Page) {}

  async enableLargeText() {
    await this.page.getByRole('button', { name: 'Mở cài đặt hiển thị' }).click();
    await this.page.getByRole('checkbox', { name: 'Tăng cỡ chữ nội dung' }).check();
    await this.page.getByRole('button', { name: 'Xong', exact: true }).click();
  }
}
