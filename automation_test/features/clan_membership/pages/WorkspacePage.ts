import { expect, type Page } from '@playwright/test';
export class WorkspacePage {
  constructor(readonly page: Page) {}
  async createClan(name: string) {
    const page = this.page;
    await page.getByText('Tạo dòng họ mới', { exact: true }).click();
    await page.getByLabel('Tên dòng họ', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Tạo dòng họ', exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
}
