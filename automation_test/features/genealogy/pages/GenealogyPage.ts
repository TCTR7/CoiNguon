import { expect, type Page } from '@playwright/test';
import { AuthPage } from '../../auth/pages/AuthPage';
export class GenealogyPage {
  constructor(readonly page: Page) {}
  async setup() {
    const page = this.page;
    const email = 'test-' + crypto.randomUUID() + '@family.test';
    await new AuthPage(page).register('Người quản lý mẫu', { email });
    await page.getByText('Tạo dòng họ mới', { exact: true }).click();
    await page
      .getByLabel('Tên dòng họ', { exact: true })
      .fill('Gia đình mẫu ' + crypto.randomUUID().slice(0, 6));
    await page.getByRole('button', { name: 'Tạo dòng họ', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Thêm người thân', exact: true })).toBeVisible();
    return email;
  }
  async addPerson(name: string, year = '') {
    const page = this.page;
    await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
    await page.getByLabel('Tên hiển thị', { exact: true }).fill(name);
    if (year) await page.getByLabel('Năm sinh', { exact: true }).fill(year);
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    await expect(
      page.locator('.family-person-detail').getByRole('heading', { name, exact: true }),
    ).toBeVisible();
  }
}
