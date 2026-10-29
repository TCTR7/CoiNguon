import { JoinPage } from '../pages/JoinPage';
import { test, expect } from '../../../common_setup/fixtures';
import AxeBuilder from '@axe-core/playwright';

test('a shared link admits multiple people only after individual admin approval', async ({
  page,
  browser,
}) => {
  const link = await new JoinPage(page).createLink();
  const contextA = await browser.newContext(),
    contextB = await browser.newContext();
  try {
    const a = await contextA.newPage(),
      b = await contextB.newPage();
    await new JoinPage(a).apply(link, 'Người đăng ký một');
    await new JoinPage(b).apply(link, 'Người đăng ký hai');
    await a.goto('/dong-ho');
    await expect(a.getByRole('heading', { name: 'Chưa tham gia dòng họ nào' })).toBeVisible();
    await expect(a.getByRole('region', { name: 'Yêu cầu tham gia đã gửi' })).toContainText(
      'Gia phả đăng ký mẫu',
    );
    await expect(a.getByText('Người thân riêng tư mẫu', { exact: true })).toHaveCount(0);
    const first = page.getByRole('article', { name: 'Yêu cầu của Người đăng ký một' });
    await first.getByRole('button', { name: 'Duyệt tham gia', exact: true }).click();
    await expect(
      a.getByRole('heading', { name: 'Gia phả đăng ký mẫu', exact: true }),
    ).toBeVisible();
    await expect(a.locator('.genealogy-list')).toContainText('Người thân riêng tư mẫu');
    await expect(b.getByRole('button', { name: 'Vào gia phả', exact: true })).toHaveCount(0);
    await page
      .getByRole('article', { name: 'Yêu cầu của Người đăng ký hai' })
      .getByRole('button', { name: 'Duyệt tham gia', exact: true })
      .click();
    await b.getByRole('button', { name: 'Vào gia phả', exact: true }).click();
    await expect(b.locator('.genealogy-list')).toContainText('Người thân riêng tư mẫu');
    await expect(
      page.locator('.member-item').filter({ hasText: 'Người đăng ký một' }),
    ).toContainText('Thành viên');
    await b.reload();
    await expect(
      b.getByRole('heading', { name: 'Gia phả đăng ký mẫu', exact: true }),
    ).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
test('a revoked link blocks pending approval; a replacement lets the applicant resubmit', async ({
  page,
  browser,
}) => {
  const link = await new JoinPage(page).createLink();
  const context = await browser.newContext();
  try {
    const applicant = await context.newPage();
    await new JoinPage(applicant).apply(link, 'Người cần link mới');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Thu hồi link đăng ký', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Duyệt tham gia', exact: true })).toBeDisabled();
    await applicant.reload();
    await expect(applicant.getByRole('alert')).toContainText('Link đăng ký không còn hiệu lực');
    await page.getByRole('button', { name: 'Tạo link đăng ký', exact: true }).click();
    const replacement = await page.getByLabel('Link đăng ký dùng chung').inputValue();
    await applicant.goto(replacement);
    await applicant
      .getByLabel('Tên để người thân nhận ra bạn', { exact: true })
      .fill('Người cần link mới');
    await applicant
      .getByLabel('Bạn có quan hệ thế nào với gia đình?', { exact: true })
      .fill('Đăng ký lại theo link mới của gia đình');
    await applicant.getByRole('button', { name: 'Gửi yêu cầu tham gia', exact: true }).click();
    await page.getByRole('button', { name: 'Duyệt tham gia', exact: true }).click();
    await expect(applicant.getByRole('button', { name: 'Vào gia phả', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
test('join landing and application are accessible at 320px and enlarged text', async ({
  page,
  browser,
}) => {
  const link = await new JoinPage(page).createLink();
  const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
  try {
    const applicant = await context.newPage();
    await applicant.goto(link);
    await expect(
      applicant.getByRole('button', { name: 'Đăng ký tham gia gia phả', exact: true }),
    ).toBeVisible();
    await applicant.keyboard.press('Tab');
    await applicant.getByRole('link', { name: 'Đến nội dung chính' }).press('Enter');
    await expect(applicant).toHaveURL(link);
    await expect(applicant.locator('#main-content')).toBeFocused();
    expect(
      (
        await new AxeBuilder({ page: applicant })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await applicant.getByRole('button', { name: 'Đăng ký tham gia gia phả', exact: true }).click();
    await new JoinPage(applicant).signup('Người thử giao diện');
    await expect(
      applicant.getByRole('button', { name: 'Gửi yêu cầu tham gia', exact: true }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page: applicant })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await applicant.addStyleTag({ content: ':root{font-size:200% !important}' });
    expect(await applicant.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
});
