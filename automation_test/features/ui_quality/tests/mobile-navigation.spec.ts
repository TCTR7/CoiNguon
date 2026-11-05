import { test, expect } from '@playwright/test';

test('mobile bottom navigation switches workspace sections cleanly on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const mobileNav = page.getByRole('navigation', { name: 'Điều hướng trên điện thoại' });
  await expect(mobileNav).toBeVisible();

  await mobileNav.getByRole('link', { name: 'Gia phả', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gia phả dòng họ' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);

  await mobileNav.getByRole('link', { name: 'Lịch giỗ', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lịch giỗ & Sự kiện' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);

  await mobileNav.getByRole('link', { name: 'Thành viên', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Thành viên & Phân quyền' }),
  ).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});

test('install action provides guidance without a browser install event', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cài ứng dụng', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Messenger');
  await expect(dialog).toContainText('Safari');
  await page.getByRole('button', { name: 'Đã hiểu', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('install action invokes the native prompt once and disappears when installed', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.installCalls = String(
          Number(document.documentElement.dataset.installCalls || '0') + 1,
        );
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Cài ứng dụng', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-install-calls', '1');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('button', { name: 'Cài ứng dụng', exact: true })).toHaveCount(0);
});
