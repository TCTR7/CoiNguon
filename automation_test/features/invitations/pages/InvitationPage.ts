import { expect, type Page, type Locator } from '@playwright/test';
import { AuthPage } from '../../auth/pages/AuthPage';
import { fakeEmail } from '../../../common_setup/test-data';
export class InvitationPage {
  constructor(readonly page: Page) {}
  async setup() {
    const page = this.page;
    await new AuthPage(page).register('Chủ sự thiệp mẫu', {
      email: fakeEmail('invitation', 'family.test'),
      password: 'invitation-local-123',
    });
    await page.getByText('Tạo dòng họ mới', { exact: true }).click();
    await page.getByLabel('Tên dòng họ', { exact: true }).fill('Gia phả riêng không công bố');
    await page.getByRole('button', { name: 'Tạo dòng họ', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm người thân', exact: true }).click();
    await page.getByLabel('Tên hiển thị', { exact: true }).fill('Hồ sơ riêng không công bố');
    await page.getByRole('combobox', { name: 'Tình trạng', exact: true }).selectOption('deceased');
    await page.getByRole('combobox', { name: 'Lịch ngày mất', exact: true }).selectOption('solar');
    await page.getByLabel('Ngày mất', { exact: true }).fill('1');
    await page.getByLabel('Tháng mất', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    const calendar = page.getByRole('region', { name: 'Lịch giỗ dòng họ' });
    await calendar.getByRole('spinbutton', { name: 'Năm lịch giỗ', exact: true }).fill('2090');
    await calendar.getByText('Thiết lập quy tắc', { exact: true }).click();
    await calendar.getByRole('button', { name: 'Lưu quy tắc', exact: true }).click();
    await calendar
      .getByRole('combobox', { name: 'Phân công chủ sự', exact: true })
      .selectOption({ label: 'Chủ sự thiệp mẫu' });
    await calendar.getByRole('button', { name: 'Lưu phân công', exact: true }).click();
    await calendar.getByRole('button', { name: 'Tạo bản nháp', exact: false }).click();
    await calendar.getByRole('button', { name: 'Sửa sự kiện', exact: true }).click();
    const form = calendar.getByRole('region', { name: 'Chỉnh sửa buổi giỗ' });
    await form
      .getByLabel('Tôi đã đối chiếu và xác nhận ngày giỗ với gia đình', { exact: true })
      .check();
    await form.getByLabel('Ngày tổ chức', { exact: true }).fill('2090-01-02');
    await form.getByLabel('Giờ tổ chức', { exact: true }).fill('10:00');
    await form.getByLabel('Địa chỉ tổ chức', { exact: true }).fill('Nhà sum họp mẫu');
    await form
      .getByLabel('Hạn phản hồi (giờ tại địa điểm)', { exact: true })
      .fill('2089-12-31T18:00');
    await form.getByRole('button', { name: 'Lưu buổi giỗ', exact: true }).click();
    await calendar.getByRole('button', { name: 'Công bố trong dòng họ', exact: true }).click();
    await expect(calendar.locator('.memorial-card')).toContainText('Đã công bố');
    await calendar.getByText('Thiệp mời & phản hồi theo hộ', { exact: true }).click();
    const manager = calendar.getByRole('region', {
      name: 'Quản lý thiệp Hồ sơ riêng không công bố',
    });
    await manager.getByRole('button', { name: 'Soạn thiệp khách', exact: true }).click();
    await manager.getByLabel('Tiêu đề thiệp', { exact: true }).fill('Ngày về sum họp');
    await manager
      .getByLabel('Lời mời gửi người thân', { exact: true })
      .fill('Mời gia đình cùng về tưởng nhớ và sum họp.');
    await manager
      .getByLabel('Liên hệ được phép công bố (tùy chọn)', { exact: true })
      .fill('Ban tổ chức mẫu');
    await manager.getByRole('button', { name: 'Xem trước thiệp', exact: true }).click();
    await manager.getByLabel(/Tôi đồng ý cho người có link xem các nội dung trên/).check();
    await manager.getByRole('button', { name: 'Công bố thiệp khách', exact: true }).click();
    await expect(manager.getByLabel('Link xem thiệp chung', { exact: true })).toBeVisible();
    return {
      calendar,
      manager,
      publicLink: await manager.getByLabel('Link xem thiệp chung', { exact: true }).inputValue(),
    };
  }
  static async addGroup(manager: Locator, label: string) {
    await manager.getByLabel('Tên hộ/nhóm được mời', { exact: true }).fill(label);
    await manager.getByRole('button', { name: 'Tạo link riêng cho nhóm', exact: true }).click();
    const row = manager.getByRole('article', { name: 'Nhóm khách ' + label, exact: true });
    await expect(row).toBeVisible();
    return {
      row,
      link: await row.getByLabel('Link riêng của ' + label, { exact: true }).inputValue(),
    };
  }
  async answer(adults: number, children: number) {
    const page = this.page;
    await page.getByRole('radio', { name: 'Có tham dự', exact: true }).check();
    await page.getByLabel('Số người lớn', { exact: true }).fill(String(adults));
    await page.getByLabel('Số trẻ em', { exact: true }).fill(String(children));
    await page
      .getByLabel('Tôi xác nhận thay cho nhóm này; đây là tổng số người của cả nhóm.', {
        exact: true,
      })
      .check();
    await page.getByRole('button', { name: 'Gửi xác nhận tham dự', exact: true }).click();
  }
  static people = (manager: Locator) =>
    manager
      .locator('.attendance-summary > div')
      .filter({ has: manager.page().locator('dt', { hasText: 'Tổng số người' }) })
      .locator('dd');
}
