import { expect, type Page } from '@playwright/test';
import { fakeEmail, testPassword } from '../../../common_setup/test-data';
export class AuthPage {
  constructor(readonly page: Page) {}
  async createAccount(name: string, email = fakeEmail(), password = testPassword) {
    await this.page.getByRole('button', { name: 'Chưa có tài khoản? Tạo tài khoản thử' }).click();
    await this.page.getByLabel('Tên hiển thị giả').fill(name);
    await this.page.getByLabel('Email giả', { exact: true }).fill(email);
    await this.page.getByLabel('Mật khẩu thử').fill(password);
    await this.page.getByRole('button', { name: 'Tạo tài khoản thử', exact: true }).click();
    return email;
  }
  async register(
    name: string,
    options: { email?: string; password?: string; invite?: string } = {},
  ) {
    await this.page.goto('/dong-ho' + (options.invite || ''));
    const email = await this.createAccount(name, options.email, options.password);
    await expect(this.page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
    return email;
  }
  async login(email: string, password = testPassword) {
    await this.page.getByLabel('Email giả', { exact: true }).fill(email);
    await this.page.getByLabel('Mật khẩu thử').fill(password);
    await this.page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  }
  async logout() {
    await this.page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(this.page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  }
}
