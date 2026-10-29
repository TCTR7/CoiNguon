import { DemoPage } from '../pages/DemoPage';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../../common_setup/fixtures';
test('browse a family profile and replace the sample invitation response', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gìn giữ cội nguồn');
  await new DemoPage(page).browseProfile('tran van an', 'Trần Văn An 1932');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trần Văn An');
  await page.getByRole('link', { name: /Xem lễ giỗ sắp tới/ }).click();
  await new DemoPage(page).respond(4);
  await expect(page.getByRole('status')).toContainText('4 người lớn');
  await page.getByRole('button', { name: 'Sửa phản hồi' }).click();
  await new DemoPage(page).respond(3);
  await expect(page.getByRole('status')).toContainText('3 người lớn');
});
test('sample screens fit narrow displays and support larger text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const route of [
    '/',
    '/gia-pha',
    '/gia-pha/tran-van-an',
    '/lich-gio',
    '/thiep-moi',
    '/thanh-vien',
  ]) {
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

test('sample screens have no automated WCAG AA violations', async ({ page }) => {
  for (const route of ['/', '/gia-pha', '/gia-pha/tran-van-an', '/thiep-moi']) {
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
  for (const route of [
    '/',
    '/gia-pha',
    '/gia-pha/tran-van-an',
    '/lich-gio',
    '/thiep-moi',
    '/thanh-vien',
  ]) {
    await page.goto(route);
    await page.addStyleTag({ content: ':root {font-size:200% !important}' });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      route,
    ).toBe(true);
  }
});
