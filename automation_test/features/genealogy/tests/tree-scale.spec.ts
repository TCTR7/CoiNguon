import { test, expect } from '../../../common_setup/fixtures';
import { AuthPage } from '../../auth/pages/AuthPage';
import { adminAuth, store } from '../../../../backend/service';
import { FieldValue } from 'firebase-admin/firestore';
import { blankPerson } from '../../../../src/shared/domain/genealogy';
import { repoRoot } from '../../../common_setup/paths';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
test.use({ actionTimeout: 15_000 });

test('navigate 5000 synthetic profiles without rendering the entire tree or changing root on selection', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const email = await new AuthPage(page).register('Người thử cây lớn');
  await page.goto('/');
  const user = await adminAuth.getUserByEmail(email);
  const clanId = 'large-tree-' + crypto.randomUUID();
  // Seed before the first tree subscription. A previously opened empty-clan listener can
  // remain on an emulator WebChannel while navigation tears down its connection.
  const setup = store.batch();
  setup.set(store.doc('clans/' + clanId), {
    name: 'Gia phả 5.000 hồ sơ giả',
    ownerUid: user.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  setup.set(store.doc('memberships/' + clanId + '_' + user.uid), {
    clanId,
    uid: user.uid,
    displayName: 'Người thử cây lớn',
    role: 'admin',
    joinedAt: FieldValue.serverTimestamp(),
    invitationId: null,
  });
  await setup.commit();
  const writes: { path: string; data: object }[] = [];
  for (let i = 0; i < 5000; i++) {
    const personId = 'large' + String(i).padStart(5, '0');
    writes.push({
      path: 'people/' + personId,
      data: {
        ...blankPerson(),
        name: 'Người Mẫu ' + String(i).padStart(5, '0'),
        birth: { ...blankPerson().birth, year: 1900 + Math.floor(i / 100) },
        version: 1,
        archived: false,
      },
    });
    if (i)
      writes.push({
        path: 'relationships/r' + i,
        data: {
          from: 'large' + String(Math.floor((i - 1) / 8)).padStart(5, '0'),
          to: personId,
          kind: 'parent',
          parentType: i === 2 ? 'adoptive' : 'biological',
          status: 'current',
          verified: true,
          source: 'Dữ liệu giả kiểm thử',
          archived: false,
          version: 1,
        },
      });
  }
  // Small write batches seed the emulator; the actual browser reads through its normal rules.
  for (let start = 0; start < writes.length; start += 250) {
    const batch = store.batch();
    for (const row of writes.slice(start, start + 250))
      batch.set(store.doc('clans/' + clanId + '/' + row.path), row.data);
    await batch.commit();
  }
  expect(
    (
      await store
        .collection('clans/' + clanId + '/people')
        .count()
        .get()
    ).data().count,
  ).toBe(5000);
  await page.goto('/dong-ho');
  await expect(page.locator('.result-count')).toContainText('5000', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Sơ đồ nhánh', exact: true }).click();
  const viewport = page.getByRole('region', {
    name: 'Vùng sơ đồ gia phả, có thể kéo và phóng to',
    exact: true,
  });
  await viewport.scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('button', { name: 'Xem hồ sơ Người Mẫu 00000', exact: true }),
  ).toBeVisible();
  expect(await page.locator('.family-tree-card').count()).toBeLessThan(60);
  const rootBefore = await page.getByLabel('Gốc nhánh đang xem', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Thu nhánh Người Mẫu 00000', exact: true }).click();
  await expect(page.locator('.family-tree-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mở nhánh Người Mẫu 00000', exact: true }).click();
  await page.getByRole('button', { name: 'Thu nhỏ sơ đồ', exact: true }).click();
  await expect(page.getByLabel('Mức phóng sơ đồ', { exact: true })).toHaveText('80%');
  await expect(page.locator('.family-tree-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Phóng to sơ đồ', exact: true }).click();
  await expect(page.getByLabel('Mức phóng sơ đồ', { exact: true })).toHaveText('100%');
  await viewport.focus();
  const cardBefore = await page.locator('.family-tree-card').first().getAttribute('style');
  await viewport.press('ArrowRight');
  await expect(page.locator('.family-tree-card').first()).not.toHaveAttribute('style', cardBefore!);
  const box = (await viewport.boundingBox())!;
  const beforeDrag = await page.locator('.family-tree-card').first().getAttribute('style');
  await page.mouse.move(box.x + 15, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + 95, box.y + 45, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.family-tree-card').first()).not.toHaveAttribute('style', beforeDrag!);
  const beforeWheel = await page.locator('.family-tree-card').first().getAttribute('style');
  await page.mouse.wheel(30, 60);
  await expect(page.locator('.family-tree-card').first()).not.toHaveAttribute(
    'style',
    beforeWheel!,
  );
  await page.getByRole('button', { name: 'Vừa khung', exact: true }).click();
  await expect(page.getByLabel('Mức phóng sơ đồ', { exact: true })).not.toHaveText('100%');
  await page.getByRole('button', { name: 'Về người đang chọn', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm một thế hệ', exact: true }).click();
  expect(await page.locator('.family-tree-card').count()).toBeLessThan(60);
  await page.getByLabel('Tìm hồ sơ trong dòng họ', { exact: true }).fill('nguoi mau 04999');
  await page.getByRole('button', { name: 'Định vị Người Mẫu 04999', exact: true }).click();
  await expect(page.getByLabel('Gốc nhánh đang xem', { exact: true })).not.toHaveValue(rootBefore);
  await expect(
    page.getByRole('button', { name: 'Xem hồ sơ Người Mẫu 04999', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.family-person-detail')).toContainText('Người Mẫu 04999');
  await store
    .doc('clans/' + clanId + '/people/large04999')
    .update({ aliases: 'Đã cập nhật trực tiếp' });
  await expect(page.locator('.family-person-detail')).toContainText('Đã cập nhật trực tiếp');
  await page.getByRole('button', { name: 'Xem hồ sơ Người Mẫu 04999', exact: true }).click();
  await expect(page.getByLabel('Gốc nhánh đang xem', { exact: true })).toHaveValue('large04999');
  if (testInfo.project.name === 'desktop') {
    await page.getByLabel('Tìm hồ sơ trong dòng họ', { exact: true }).fill('');
    await page
      .getByLabel('Gốc nhánh đang xem', { exact: true })
      .selectOption({ label: 'Người Mẫu 00000' });
    await page.locator('.family-tree-workspace').screenshot({
      path: resolve(repoRoot, 'automation_test/artifacts/genealogy_large_desktop.png'),
    });
  }
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include('.family-tree-workspace')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.addStyleTag({ content: ':root {font-size:200% !important}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  console.log('Tree 5000 profiles: DOM nodes ' + (await page.locator('.family-tree-card').count()));
});
