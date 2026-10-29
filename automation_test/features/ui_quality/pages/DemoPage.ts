import { type Page } from '@playwright/test';
export class DemoPage {
  constructor(readonly page: Page) {}
  async browseProfile(query: string, linkLabel: string) {
    await this.page.getByRole('link', { name: /Khám phá gia phả/ }).click();
    await this.page.getByRole('textbox', { name: 'Tìm người trong gia phả' }).fill(query);
    await this.page.getByRole('link', { name: linkLabel }).click();
  }
  async respond(adults: number) {
    await this.page.getByRole('spinbutton', { name: 'Người lớn' }).fill(String(adults));
    await this.page.getByRole('button', { name: 'Xác nhận bản thử' }).click();
  }
  async enableLargeText() {
    await this.page.getByRole('button', { name: 'Mở cài đặt bản dùng thử' }).click();
    await this.page.getByRole('checkbox', { name: 'Tăng cỡ chữ nội dung' }).check();
    await this.page.getByRole('button', { name: 'Xong', exact: true }).click();
  }
}
