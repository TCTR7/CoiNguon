import { InvitationPage } from '../pages/InvitationPage';
import { test, expect } from '../../../common_setup/fixtures';
import AxeBuilder from '@axe-core/playwright';

test('public card and separate households support updates without double counting or revealing genealogy', async ({
  page,
  browser,
}) => {
  const { manager, publicLink } = await new InvitationPage(page).setup(),
    a = await InvitationPage.addGroup(manager, 'Gia đình bác An'),
    b = await InvitationPage.addGroup(manager, 'Gia đình bác Bình');
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    await guest.goto(publicLink);
    await expect(
      guest.getByRole('heading', { name: 'Ngày về sum họp', exact: true }),
    ).toBeVisible();
    await expect(guest.getByRole('form', { name: 'Xác nhận tham dự của gia đình' })).toHaveCount(0);
    await expect(guest.getByText('Gia phả riêng không công bố', { exact: true })).toHaveCount(0);
    await expect(guest.getByText('Hồ sơ riêng không công bố', { exact: true })).toHaveCount(0);
    await guest.goto(a.link);
    await expect(
      guest.getByRole('heading', { name: 'Gia đình bác An', exact: true }),
    ).toBeVisible();
    await expect(guest.getByText('Gia đình bác Bình', { exact: true })).toHaveCount(0);
    await new InvitationPage(guest).answer(3, 1);
    await expect(
      guest.getByRole('status').filter({ hasText: 'Đã lưu phản hồi của nhóm' }),
    ).toBeVisible();
    await manager.getByRole('button', { name: 'Cập nhật phản hồi', exact: true }).click();
    await expect(InvitationPage.people(manager)).toHaveText('4');
    await new InvitationPage(guest).answer(2, 1);
    await expect(
      guest.getByRole('status').filter({ hasText: 'Đã lưu phản hồi của nhóm' }),
    ).toBeVisible();
    await manager.getByRole('button', { name: 'Cập nhật phản hồi', exact: true }).click();
    await expect(InvitationPage.people(manager)).toHaveText('3');
    await guest.reload();
    await expect(guest.getByLabel('Số người lớn', { exact: true })).toHaveValue('2');
    await guest.goto(b.link);
    await guest.getByRole('radio', { name: 'Không tham dự', exact: true }).check();
    await guest
      .getByLabel('Tôi xác nhận thay cho nhóm này; đây là tổng số người của cả nhóm.', {
        exact: true,
      })
      .check();
    await guest.getByRole('button', { name: 'Gửi xác nhận tham dự', exact: true }).click();
    await expect(
      guest.getByRole('status').filter({ hasText: 'Đã lưu phản hồi của nhóm' }),
    ).toBeVisible();
    await manager.getByRole('button', { name: 'Cập nhật phản hồi', exact: true }).click();
    await expect(
      manager.getByText('1 nhóm tham dự · 1 nhóm không tham dự.', { exact: true }),
    ).toBeVisible();
    await expect(InvitationPage.people(manager)).toHaveText('3');
  } finally {
    await context.close();
  }
});

test('reissued links preserve the response; old schedule cannot accept a response and cancellation closes the card', async ({
  page,
  browser,
}) => {
  const { manager, calendar } = await new InvitationPage(page).setup(),
    a = await InvitationPage.addGroup(manager, 'Nhóm đổi lịch');
  const context = await browser.newContext();
  try {
    const guest = await context.newPage();
    await guest.goto(a.link);
    await new InvitationPage(guest).answer(1, 0);
    await expect(
      guest.getByRole('status').filter({ hasText: 'Đã lưu phản hồi của nhóm' }),
    ).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await a.row.getByRole('button', { name: 'Cấp lại link riêng', exact: true }).click();
    const input = a.row.getByLabel('Link riêng của Nhóm đổi lịch', { exact: true });
    await expect(input).not.toHaveValue(a.link);
    const replacement = await input.inputValue();
    await guest.reload();
    await expect(guest.getByRole('alert')).toContainText('Link thiệp không còn hiệu lực');
    await guest.goto(replacement);
    await expect(guest.getByLabel('Số người lớn', { exact: true })).toHaveValue('1');
    await calendar.getByRole('button', { name: 'Sửa sự kiện', exact: true }).click();
    const form = calendar.getByRole('region', { name: 'Chỉnh sửa buổi giỗ' });
    await form.getByLabel('Ngày tổ chức', { exact: true }).fill('2090-01-03');
    await form.getByRole('button', { name: 'Lưu buổi giỗ', exact: true }).click();
    await new InvitationPage(guest).answer(2, 0);
    await expect(
      guest.getByRole('alert').filter({ hasText: 'Nội dung thiệp hoặc lịch đã thay đổi.' }),
    ).toBeVisible();
    await expect(guest.getByRole('article', { name: 'Nội dung thiệp mời' })).toContainText(
      '03/01/2090',
    );
    await expect(guest.getByLabel('Số người lớn', { exact: true })).toHaveValue('2');
    await guest
      .getByRole('button', { name: 'Bỏ bản đang nhập và dùng phản hồi mới', exact: true })
      .click();
    await new InvitationPage(guest).answer(2, 0);
    await expect(
      guest.getByRole('status').filter({ hasText: 'Đã lưu phản hồi của nhóm' }),
    ).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await calendar.getByRole('button', { name: 'Hủy sự kiện', exact: true }).click();
    await guest.reload();
    await expect(
      guest.getByRole('heading', { name: 'Buổi giỗ đã hủy', exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByRole('button', { name: 'Gửi xác nhận tham dự', exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('card and response form stay accessible at 320px and 200% text; offline submission is explicit and never queued', async ({
  page,
  browser,
}) => {
  const { manager } = await new InvitationPage(page).setup(),
    a = await InvitationPage.addGroup(manager, 'Nhóm thử tiếp cận');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    (
      await new AxeBuilder({ page })
        .include('.invitation-management')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
  try {
    const guest = await context.newPage();
    await guest.goto(a.link);
    await expect(
      guest.getByRole('heading', { name: 'Ngày về sum họp', exact: true }),
    ).toBeVisible();
    await guest.keyboard.press('Tab');
    await guest.getByRole('link', { name: 'Đến nội dung chính' }).press('Enter');
    await expect(guest).toHaveURL(a.link);
    await expect(guest.locator('#main-content')).toBeFocused();
    expect(
      (await new AxeBuilder({ page: guest }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await guest.addStyleTag({ content: ':root{font-size:200% !important}' });
    const layout = await guest.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('body *')]
        .filter(
          (el) =>
            el.getBoundingClientRect().right > innerWidth + 1 &&
            el.getBoundingClientRect().width > 0,
        )
        .slice(0, 15)
        .map((el) => ({
          tag: el.tagName,
          cls: String(el.className),
          right: el.getBoundingClientRect().right,
          text: el.textContent?.slice(0, 70),
        })),
    }));
    expect(layout.scroll, JSON.stringify(layout.overflow)).toBeLessThanOrEqual(layout.width);
    await context.setOffline(true);
    await new InvitationPage(guest).answer(1, 0);
    await expect(guest.getByRole('alert').filter({ hasText: 'Đang ngoại tuyến' })).toBeVisible();
    await context.setOffline(false);
    await new InvitationPage(guest).answer(1, 0);
    await expect(
      guest.getByRole('status').filter({ hasText: 'Đã lưu phản hồi của nhóm' }),
    ).toBeVisible();
    await manager.getByRole('button', { name: 'Cập nhật phản hồi', exact: true }).click();
    await expect(InvitationPage.people(manager)).toHaveText('1');
  } finally {
    await context.close();
  }
});
