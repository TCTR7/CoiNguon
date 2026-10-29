import { AuthPage } from '../../auth/pages/AuthPage';

import { WorkspacePage } from '../../clan_membership/pages/WorkspacePage';
import { PreparednessPage } from '../pages/PreparednessPage';
import { test, expect } from '../../../common_setup/fixtures';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { portableFixture } from '../../../common_setup/fixtures/portable';

test('exports/restores separately, reloads offline read-only and clears private data on offline logout', async ({
  page,
  context,
}) => {
  await new AuthPage(page).register('Người thử PWA', { invite: '' });
  const clan = 'Gia phả PWA ' + crypto.randomUUID().slice(0, 6);
  await new WorkspacePage(page).createClan(clan);
  await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Người mẫu ngoại tuyến');
  await page.getByLabel('Năm sinh', { exact: true }).fill('1932');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await expect(page.locator('.genealogy-list')).toContainText('Người mẫu ngoại tuyến');
  const dataPanel = page.getByRole('region', { name: 'Dữ liệu và thiết bị' });
  await expect(
    dataPanel.getByRole('button', { name: 'Tải dữ liệu để đọc ngoại tuyến', exact: true }),
  ).toBeDisabled();
  await dataPanel.getByText('Xuất bản sao & khôi phục thử', { exact: true }).click();
  const save = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất bản sao JSON', exact: true }).click();
  const file = await save,
    path = await file.path();
  expect(path).toBeTruthy();
  const raw = await readFile(path!);
  const json = JSON.parse(raw.toString());
  expect(json.people[0]).toMatchObject({
    name: 'Người mẫu ngoại tuyến',
    birth: { year: 1932, month: null, day: null },
  });
  expect(json).not.toHaveProperty('memberships');
  await page
    .getByLabel('Tệp JSON cần kiểm tra')
    .setInputFiles({ name: 'ban-sao.json', mimeType: 'application/json', buffer: raw });
  await page.getByRole('button', { name: 'Kiểm tra tệp trước khi khôi phục', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 hồ sơ, 0 quan hệ' })).toBeVisible();
  await page
    .getByLabel('Tôi hiểu dữ liệu được khôi phục vào gia phả thử mới', { exact: false })
    .check();
  await page.getByRole('button', { name: 'Khôi phục sang gia phả thử mới', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã khôi phục sang gia phả thử mới' }),
  ).toBeVisible();
  await new PreparednessPage(page).download();
  await context.setOffline(true);
  await expect(page.getByText('Đang ngoại tuyến — chỉ đọc', { exact: true })).toBeVisible();
  await page.goto('/ngoai-tuyen');
  await expect(page.getByRole('heading', { name: clan, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Người mẫu ngoại tuyến/ })).toBeVisible();
  await page.getByRole('button', { name: /Người mẫu ngoại tuyến/ }).click();
  await expect(page.getByRole('article', { name: 'Hồ sơ ngoại tuyến' })).toContainText('?/?/1932');
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toHaveCount(0);
  await expect(page.getByText('Đồng bộ lần cuối:', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.addStyleTag({ content: ':root {font-size:200% !important}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await new PreparednessPage(page).logout();
  await expect(
    page.getByText('Cần tài khoản đã đăng nhập trên thiết bị tin cậy.', { exact: false }),
  ).toBeVisible();
  const remaining = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const q = indexedDB.open('coinguon-private-v1');
        q.onerror = () => reject(q.error);
        q.onsuccess = () => {
          const db = q.result;
          const tx = db.transaction('snapshots');
          const r = tx.objectStore('snapshots').count();
          r.onsuccess = () => {
            resolve(r.result);
            db.close();
          };
        };
      }),
  );
  expect(remaining).toBe(0);
  const response = await page.goto('/loi-moi#synthetic-token');
  expect(response?.status()).toBe(503);
  await expect(page.locator('body')).toContainText('Cần kết nối mạng');
  await context.setOffline(false);
  await page.goto('/dong-ho');
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  const cached = await page.evaluate(async () => {
    const result: string[] = [];
    for (const key of await caches.keys()) {
      for (const r of await (await caches.open(key)).keys()) result.push(r.url);
    }
    return result;
  });
  expect(
    cached.some(
      (u) =>
        /^\/(?:api(?:\/|$)|loi-moi(?:\/|$)|tham-gia(?:\/|$))/.test(new URL(u).pathname) ||
        !!new URL(u).search,
    ),
  ).toBe(false);
});
test('purges a revoked membership snapshot when reconnecting; another account cannot see it', async ({
  page,
  browser,
}) => {
  await new AuthPage(page).register('Admin thu hồi', { invite: '' });
  const clan = 'Gia phả thu hồi PWA ' + crypto.randomUUID().slice(0, 5);
  await new WorkspacePage(page).createClan(clan);
  await page.getByRole('button', { name: 'Tạo link mời', exact: true }).click();
  const link = await page.getByLabel('Link mời vừa tạo').inputValue();
  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    await new AuthPage(guest).register('Thành viên offline', { invite: new URL(link).search });
    await guest.getByRole('button', { name: 'Đồng ý tham gia', exact: true }).click();
    await expect(guest.getByRole('heading', { name: clan, exact: true })).toBeVisible();
    await new PreparednessPage(guest).download();
    await guest.goto('/ngoai-tuyen');
    await expect(guest.getByRole('heading', { name: clan, exact: true })).toBeVisible();
    await guestContext.setOffline(true);
    await expect(guest.getByText('Đang ngoại tuyến — chỉ đọc', { exact: true })).toBeVisible();
    await page
      .locator('.member-item')
      .filter({ hasText: 'Thành viên offline' })
      .getByRole('button', { name: 'Gỡ Thành viên offline', exact: true })
      .click();
    await page.getByRole('button', { name: 'Đồng ý gỡ', exact: true }).click();
    await expect(
      page.locator('.member-item').filter({ hasText: 'Thành viên offline' }),
    ).toHaveCount(0);
    await expect(guest.getByRole('heading', { name: clan, exact: true })).toBeVisible();
    await guestContext.setOffline(false);
    await expect(guest.getByRole('heading', { name: clan, exact: true })).toHaveCount(0);
    await expect(
      guest.getByRole('status').filter({ hasText: 'Chưa có dữ liệu tải xuống' }),
    ).toBeVisible();
    await new PreparednessPage(guest).logout();
    await new AuthPage(guest).register('Tài khoản khác', { invite: '' });
    expect(
      await guest.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith('firebase:authUser:')),
      ),
    ).toEqual([]);
    await guest.goto('/ngoai-tuyen');
    await expect(guest.getByRole('heading', { name: clan, exact: true })).toHaveCount(0);
  } finally {
    await guestContext.close();
  }
});
test('imports 1000 synthetic profiles, searches the downloaded copy and handles denied notifications without blocking calendar', async ({
  page,
  context,
}) => {
  await new AuthPage(page).register('Người thử PWA', { invite: '' });
  await new WorkspacePage(page).createClan('Nơi kiểm tra bản nhập');
  await page.getByText('Xuất bản sao & khôi phục thử', { exact: true }).click();
  await page.getByLabel('Tệp JSON cần kiểm tra').setInputFiles({
    name: '1000-mau.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(portableFixture(1000))),
  });
  await page.getByRole('button', { name: 'Kiểm tra tệp trước khi khôi phục', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '1000 hồ sơ, 999 quan hệ' }),
  ).toBeVisible();
  await page
    .getByLabel('Tôi hiểu dữ liệu được khôi phục vào gia phả thử mới', { exact: false })
    .check();
  await page.getByRole('button', { name: 'Khôi phục sang gia phả thử mới', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã khôi phục sang gia phả thử mới' }),
  ).toBeVisible();
  await page
    .getByLabel('Dòng họ đang xem')
    .selectOption({ label: 'Khôi phục thử — Gia phả dữ liệu giả · Quản trị viên' });
  await expect(
    page.getByRole('heading', { name: 'Khôi phục thử — Gia phả dữ liệu giả', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'denied', configurable: true });
    Notification.requestPermission = async () => 'denied';
  });
  await page.getByRole('button', { name: 'Bật và thử thông báo thiết bị', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Thông báo đang bị chặn' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Lịch giỗ & người gìn giữ', exact: true }),
  ).toBeVisible();
  await new PreparednessPage(page).download();
  await page.goto('/ngoai-tuyen');
  await context.setOffline(true);
  const start = Date.now();
  await page.getByLabel('Tìm người trong bản tải xuống').fill('nguoi mau 999');
  await expect(page.getByRole('button', { name: /Người Mẫu 999/ })).toBeVisible();
  await expect(page.locator('.offline-person')).toHaveCount(1);
  console.log('Offline 1000-profile search (simulated device): ' + (Date.now() - start) + ' ms');
});

test('device notifications are generic, deduplicated and disabled on logout', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications']);
  await new AuthPage(page).register('Người thử PWA', { invite: '' });
  await new WorkspacePage(page).createClan('Gia phả kín cho thử nhắc');
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('button', { name: 'Bật và thử thông báo thiết bị', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã bật thông báo thử' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await (await navigator.serviceWorker.getRegistration())!.getNotifications()).length,
      ),
    )
    .toBeGreaterThan(0);
  const content = await page.evaluate(async () => {
    const reg = (await navigator.serviceWorker.getRegistration())!;
    return (await reg.getNotifications()).map((n) => ({ title: n.title, body: n.body }));
  });
  expect(
    content.every(
      (n) => n.title === 'Cội Nguồn' && n.body === 'Bạn có lời nhắc mới. Mở ứng dụng để xem.',
    ),
  ).toBe(true);
  const uid = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const q = indexedDB.open('coinguon-private-v1');
        q.onerror = () => reject(q.error);
        q.onsuccess = () => {
          const db = q.result,
            r = db.transaction('settings').objectStore('settings').get('active');
          r.onsuccess = () => {
            resolve(r.result.value);
            db.close();
          };
        };
      }),
  );
  async function post(id: string) {
    await page.evaluate(
      async ({ uid, id }) => {
        const reg = (await navigator.serviceWorker.getRegistration())!;
        await new Promise<void>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => resolve();
          reg.active!.postMessage({ type: 'LOCAL_REMINDER', uid, id }, [channel.port2]);
        });
      },
      { uid, id },
    );
  }
  await page.evaluate(async () => {
    for (const n of await (await navigator.serviceWorker.getRegistration())!.getNotifications())
      n.close();
  });
  await post('dedup-test');
  await post('dedup-test');
  expect(
    await page.evaluate(
      async () =>
        (
          await (await navigator.serviceWorker.getRegistration())!.getNotifications({
            tag: 'cn-dedup-test',
          })
        ).length,
    ),
  ).toBe(1);
  await page.getByRole('button', { name: 'Tắt thông báo thiết bị', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã tắt thông báo' })).toBeVisible();
  await post('disabled-test');
  expect(
    await page.evaluate(
      async () =>
        (await (await navigator.serviceWorker.getRegistration())!.getNotifications()).length,
    ),
  ).toBe(0);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await post('old-account');
  expect(
    await page.evaluate(
      async () =>
        (await (await navigator.serviceWorker.getRegistration())!.getNotifications()).length,
    ),
  ).toBe(0);
});
