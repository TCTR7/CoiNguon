import { GenealogyPage } from '../pages/GenealogyPage';
import { test, expect } from '../../../common_setup/fixtures';

test('quick add relatives in every direction from a profile and tree', async ({ page }) => {
  const genealogy = new GenealogyPage(page);
  await genealogy.setup();
  await genealogy.addPerson('Người gốc mẫu');
  for (const [kind, name, label] of [
    ['parent', 'Cha mẹ mẫu', 'Con'],
    ['spouse', 'Bạn đời mẫu', 'Vợ/chồng'],
    ['child', 'Con mẫu', 'Cha/mẹ'],
  ] as const) {
    await page.locator('.genealogy-list button').filter({ hasText: 'Người gốc mẫu' }).click();
    await page.locator('.family-person-detail').getByTestId(`quick-add-${kind}`).click();
    await expect(page.getByLabel('Tên hiển thị', { exact: true })).toBeInViewport();
    await expect(page.getByTestId('person-details')).not.toHaveAttribute('open');
    await expect(page.getByLabel('Mối quan hệ', { exact: true })).toHaveValue(kind);
    await expect(
      page.getByLabel('Người liên kết', { exact: true }).locator('option:checked'),
    ).toHaveText('Người gốc mẫu');
    await page.getByLabel('Tên hiển thị', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    await expect(page.locator('.family-person-detail h3').first()).toHaveText(name);
    await expect(page.locator('.relationship-list')).toContainText(label);
    await expect(page.locator('.relationship-list')).toContainText('Người gốc mẫu');
  }
  await page.getByRole('button', { name: 'Sơ đồ nhánh', exact: true }).click();
  const tree = page.getByRole('region', { name: 'Cây gia phả tương tác', exact: true });
  await tree.getByTestId('quick-add-child').click();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Cháu mẫu');
  await page.getByLabel('Người liên kết', { exact: true }).selectOption({ label: 'Cha mẹ mẫu' });
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await expect(page.locator('.family-person-detail h3').first()).toHaveText('Cháu mẫu');
  await expect(page.locator('.relationship-list')).toContainText('Cha mẹ mẫu');
  await expect(page.locator('.relationship-list')).not.toContainText('Con mẫu');
});
