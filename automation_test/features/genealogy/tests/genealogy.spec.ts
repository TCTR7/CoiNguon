import { GenealogyPage } from '../pages/GenealogyPage';
import { test, expect } from '../../../common_setup/fixtures';
import AxeBuilder from '@axe-core/playwright';

test('show the person form in the viewport immediately after adding', async ({ page }) => {
  await new GenealogyPage(page).setup();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
    const name = page.getByLabel('Tên hiển thị', { exact: true });
    await expect(name).toBeFocused();
    await expect(name).toBeInViewport();
    await expect(
      page.getByRole('heading', { name: 'Thêm một người thân', exact: true }),
    ).toBeInViewport();
    await page.getByRole('button', { name: 'Hủy chỉnh sửa', exact: true }).click();
    await expect(name).toHaveCount(0);
  }
});

test('store partial dates, connect real family records and archive without cascading', async ({
  page,
}) => {
  await new GenealogyPage(page).setup();
  await new GenealogyPage(page).addPerson('Ông Mẫu', '1932');
  await expect(page.locator('.family-person-detail')).toContainText('?/?/1932');
  await new GenealogyPage(page).addPerson('Cháu Mẫu', '1962');
  await page.getByText('Thêm quan hệ gia đình', { exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Người được liên kết', exact: true })
    .selectOption({ label: 'Ông Mẫu' });
  await page
    .getByRole('combobox', { name: 'Mối quan hệ với Cháu Mẫu', exact: true })
    .selectOption('child');
  await page
    .getByRole('combobox', { name: 'Loại quan hệ cha/mẹ — con', exact: true })
    .selectOption('adoptive');
  await page.getByLabel('Nguồn quan hệ', { exact: true }).fill('Gia phả mẫu');
  await page.getByLabel('Quan hệ đã được gia đình xác minh', { exact: true }).check();
  await page.getByRole('button', { name: 'Ghi quan hệ', exact: true }).click();
  await expect(page.locator('.relationship-list')).toContainText('Cha/mẹ (nuôi)');
  await page.getByRole('button', { name: 'Sơ đồ nhánh', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Gốc nhánh đang xem', exact: true })
    .selectOption({ label: 'Ông Mẫu' });
  await expect(page.locator('.family-tree-card').filter({ hasText: 'Cháu Mẫu' })).toContainText(
    'Thế hệ tương đối 2',
  );
  await page.getByRole('button', { name: 'Đưa hồ sơ vào lưu trữ', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận lưu trữ hồ sơ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Hồ sơ còn quan hệ gia đình');
  await page.getByRole('button', { name: 'Gỡ quan hệ với Cháu Mẫu', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận gỡ quan hệ', exact: true }).click();
  await expect(page.locator('.relationship-list')).toContainText('Đã gỡ');
  await page.getByRole('button', { name: 'Đưa hồ sơ vào lưu trữ', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận lưu trữ hồ sơ', exact: true }).click();
  await expect(page.locator('.family-person-detail')).toContainText('ĐANG LƯU TRỮ');
  await page.getByRole('button', { name: 'Khôi phục hồ sơ', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận khôi phục hồ sơ', exact: true }).click();
  await expect(page.locator('.family-person-detail')).not.toContainText('ĐANG LƯU TRỮ');
  await page.getByRole('button', { name: 'Danh sách hồ sơ', exact: true }).click();
  await page.getByLabel('Tìm hồ sơ trong dòng họ').fill('chau mau');
  await expect(page.locator('.genealogy-list button')).toHaveCount(1);
  await expect(page.locator('.genealogy-list')).toContainText('Cháu Mẫu');
  await page.reload();
  await expect(page.locator('.genealogy-list button')).toHaveCount(2);
});
test('keep the draft when another tab edits the same person', async ({ page, context }) => {
  const email = await new GenealogyPage(page).setup();
  await new GenealogyPage(page).addPerson('Người mẫu trùng sửa');
  await page.getByRole('button', { name: 'Sửa hồ sơ', exact: true }).click();
  await expect(page.getByTestId('person-details')).toHaveAttribute('open');
  await page.getByLabel('Tên khác / tên thường gọi', { exact: true }).fill('Thay đổi đang nhập');
  const second = await context.newPage();
  try {
    await second.goto('/dong-ho');
    await second.getByLabel('Email giả', { exact: true }).fill(email);
    await second.getByLabel('Mật khẩu thử').fill('local-test-12345');
    await second.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await second
      .locator('.genealogy-list button')
      .filter({ hasText: 'Người mẫu trùng sửa' })
      .click();
    await second.getByRole('button', { name: 'Sửa hồ sơ', exact: true }).click();
    await expect(second.getByTestId('person-details')).toHaveAttribute('open');
    await second
      .getByLabel('Tên khác / tên thường gọi', { exact: true })
      .fill('Tên vừa được cập nhật');
    await second.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    await expect(second.locator('.family-person-detail')).toContainText('Tên vừa được cập nhật');
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Thông tin đã được người khác thay đổi');
    await expect(page.getByLabel('Tên khác / tên thường gọi', { exact: true })).toHaveValue(
      'Thay đổi đang nhập',
    );
    await page
      .getByRole('button', { name: 'Tải bản mới — bỏ thay đổi đang nhập', exact: true })
      .click();
    await expect(page.getByLabel('Tên khác / tên thường gọi', { exact: true })).toHaveValue(
      'Tên vừa được cập nhật',
    );
  } finally {
    await second.close();
  }
});
test('profile forms are accessible and reflow on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await new GenealogyPage(page).setup();
  await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Người thân mẫu có tên dài');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.addStyleTag({ content: ':root {font-size:200% !important}' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('request a profile link and a correction with explicit admin review', async ({ page }) => {
  await new GenealogyPage(page).setup();
  await new GenealogyPage(page).addPerson('Hồ sơ để liên kết');
  await page.getByText('Đề nghị sửa hoặc nhận hồ sơ', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Loại đề nghị', exact: true }).selectOption('claim');
  await page.getByLabel('Nội dung đề nghị', { exact: true }).fill('Đây là hồ sơ mẫu của tôi');
  await page.getByRole('button', { name: 'Gửi đề nghị', exact: true }).click();
  await page.locator('.requests-panel summary').click();
  await page
    .getByLabel('Kết quả xử lý cho Hồ sơ để liên kết', { exact: true })
    .fill('Đã đối chiếu dữ liệu mẫu');
  await page.getByRole('button', { name: 'Duyệt liên kết', exact: true }).click();
  await expect(
    page.getByText('Hồ sơ đã liên kết với tài khoản của bạn.', { exact: true }),
  ).toBeVisible();
  await page.getByText('Đề nghị sửa hoặc nhận hồ sơ', { exact: true }).click();
  await page
    .getByLabel('Nội dung đề nghị', { exact: true })
    .fill('Đề nghị ghi thêm tên thường gọi');
  await page.getByRole('button', { name: 'Gửi đề nghị', exact: true }).click();
  await page
    .getByLabel('Kết quả xử lý cho Hồ sơ để liên kết', { exact: true })
    .fill('Đã xem xét nội dung góp ý');
  await page.getByRole('button', { name: 'Đánh dấu đã xử lý', exact: true }).click();
  await expect(page.locator('.requests-panel')).toContainText('Đã xử lý');
});

test('quick add presets all relative directions and ordinary creation can link immediately', async ({
  page,
}) => {
  const genealogy = new GenealogyPage(page);
  await genealogy.setup();
  await genealogy.addPerson('Người gốc mẫu');
  for (const [role, name] of [
    ['parent', 'Cha mẹ mẫu'],
    ['spouse', 'Bạn đời mẫu'],
    ['child', 'Con mẫu'],
  ] as const) {
    await page.locator('.genealogy-list button').filter({ hasText: 'Người gốc mẫu' }).click();
    await page
      .locator('.family-person-detail')
      .getByTestId('quick-add-' + role)
      .click();
    await expect(page.getByLabel('Mối quan hệ', { exact: true })).toHaveValue(role);
    await expect(
      page.getByLabel('Người liên kết', { exact: true }).locator('option:checked'),
    ).toHaveText('Người gốc mẫu');
    await page.getByLabel('Tên hiển thị', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    await expect(
      page.locator('.family-person-detail').getByRole('heading', { name, exact: true }),
    ).toBeVisible();
    await expect(page.locator('.relationship-list')).toContainText('Người gốc mẫu');
    await expect(page.locator('.relationship-list')).toContainText(
      role === 'parent' ? 'Con' : role === 'child' ? 'Cha/mẹ' : 'Vợ/chồng',
    );
  }
  await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
  await expect(page.getByText('Liên kết quan hệ ngay (không bắt buộc)')).toBeVisible();
  await page.getByLabel('Người liên kết', { exact: true }).selectOption({ label: 'Người gốc mẫu' });
  await page.getByLabel('Mối quan hệ', { exact: true }).selectOption('child');
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Con thêm mẫu');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await expect(
    page
      .locator('.family-person-detail')
      .getByRole('heading', { name: 'Con thêm mẫu', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.relationship-list')).toContainText('Cha/mẹ');
  await expect(page.locator('.relationship-list')).toContainText('Người gốc mẫu');
});
