import { test, expect } from '@playwright/test';

test('tree opens centered and fits, zooms, and resets on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gia-pha');
  await page.getByRole('button', { name: 'Sơ đồ', exact: true }).click();
  const viewport = page.locator('.demo-tree-viewport');
  const content = page.locator('.demo-tree-content');
  await expect
    .poll(async () => {
      const a = await viewport.boundingBox(),
        b = await content.boundingBox();
      return (
        !!a &&
        !!b &&
        b.x >= a.x &&
        b.y >= a.y &&
        b.x + b.width <= a.x + a.width + 1 &&
        b.y + b.height <= a.y + a.height + 1
      );
    })
    .toBe(true);
  const initial = await page.getByLabel('Mức phóng sơ đồ').textContent();
  await page.getByRole('button', { name: 'Phóng to sơ đồ', exact: true }).click();
  await expect(page.getByLabel('Mức phóng sơ đồ')).not.toHaveText(initial!);
  await page.getByRole('button', { name: 'Vừa màn hình', exact: true }).click();
  await expect(page.getByLabel('Mức phóng sơ đồ')).toHaveText(initial!);
  await expect(page.locator('#demo-tree-help')).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await viewport.scrollIntoViewIfNeeded();
  const box = (await viewport.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: x - 30, y, id: 1 },
      { x: x + 30, y, id: 2 },
    ],
  });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: x - 65, y, id: 1 },
      { x: x + 65, y, id: 2 },
    ],
  });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect
    .poll(async () => parseInt((await page.getByLabel('Mức phóng sơ đồ').textContent())!))
    .toBeGreaterThan(parseInt(initial!));
  const beforePan = await content.getAttribute('style');
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + 40, y: y + 20, id: 1 }],
  });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(content).not.toHaveAttribute('style', beforePan!);
  await touch.detach();
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
