import { expect, type Page } from '@playwright/test';
import { AuthPage } from '../../auth/pages/AuthPage';
import { fakeEmail } from '../../../common_setup/test-data';
export class JoinPage {
  constructor(readonly page: Page) {}
  async signup(name: string) {
    return new AuthPage(this.page).createAccount(
      name,
      fakeEmail('join', 'family.test'),
      'local-join-12345',
    );
  }
  async createLink() {
    const page = this.page;
    await page.goto('/dong-ho');
    await this.signup('Quản trị gia phả mẫu');
    await page.getByText('Tạo dòng họ mới', { exact: true }).click();
    await page.getByLabel('Tên dòng họ', { exact: true }).fill('Gia phả đăng ký mẫu');
    await page.getByRole('button', { name: 'Tạo dòng họ', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
    await page.getByLabel('Tên hiển thị', { exact: true }).fill('Người thân riêng tư mẫu');
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    const manager = page.getByRole('region', { name: 'Đăng ký gia phả qua link chung' });
    await manager.getByRole('button', { name: 'Tạo link đăng ký', exact: true }).click();
    await expect(manager.getByLabel('Link đăng ký dùng chung')).toBeVisible({ timeout: 15000 });
    return manager.getByLabel('Link đăng ký dùng chung').inputValue();
  }
  async apply(link: string, name: string) {
    const page = this.page;
    await page.goto(link);
    await expect(
      page.getByRole('heading', { name: 'Gia phả đăng ký mẫu', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Người thân riêng tư mẫu', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Đăng ký tham gia gia phả', exact: true }).click();
    await this.signup(name);
    await page.getByLabel('Tên để người thân nhận ra bạn', { exact: true }).fill(name);
    await page
      .getByLabel('Bạn có quan hệ thế nào với gia đình?', { exact: true })
      .fill('Con của bác An trong gia đình mẫu');
    await page.getByRole('button', { name: 'Gửi yêu cầu tham gia', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Đang chờ quản trị viên duyệt', exact: true }),
    ).toBeVisible();
  }
}
