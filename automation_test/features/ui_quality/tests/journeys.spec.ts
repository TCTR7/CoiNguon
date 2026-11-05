import { DemoPage } from '../pages/DemoPage';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../../common_setup/fixtures';

const publicRoutes = ['/', '/gia-pha', '/lich-gio', '/thanh-vien', '/dong-ho'];

test('welcome overview has no static demo family profiles and navigates to workspace sections', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gìn giữ cội nguồn');
  await expect(page.getByText('Trần Văn An')).toHaveCount(0);
  await page.locator('a[href="/gia-pha"]:visible').first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gia phả dòng họ' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tiếp tục với Google/ })).toBeVisible();
});

test('primary screens fit narrow displays and support larger text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await new DemoPage(page).enableLargeText();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('primary screens have no automated WCAG AA violations', async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations, route).toEqual([]);
  }
});

test('text enlarged to 200% reflows without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      route,
    ).toBe(true);
  }
});
