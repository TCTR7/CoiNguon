import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
function open(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
describe('sample application journeys', () => {
  it('navigates from the overview to a profile through an accent-free search', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('link', { name: /Khám phá gia phả/ }));
    await user.type(
      screen.getByRole('textbox', { name: 'Tìm người trong gia phả' }),
      'tran van an',
    );
    expect(screen.getByRole('status')).toHaveTextContent('1 hồ sơ');
    await user.click(screen.getByRole('link', { name: /Trần Văn An 1932/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Trần Văn An' })).toBeInTheDocument();
  });
  it('offers a recoverable empty search', async () => {
    const user = userEvent.setup();
    open('/gia-pha');
    await user.type(screen.getByRole('textbox', { name: 'Tìm người trong gia phả' }), 'xyz');
    expect(screen.getByRole('heading', { name: 'Chưa tìm thấy người thân' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
    expect(screen.getByRole('status')).toHaveTextContent('7 hồ sơ');
  });
  it('validates counts and lets a household replace its sample response', async () => {
    const user = userEvent.setup();
    open('/thiep-moi');
    const adults = screen.getByRole('spinbutton', { name: 'Người lớn' });
    await user.clear(adults);
    await user.type(adults, '0');
    await user.click(screen.getByRole('button', { name: 'Xác nhận bản thử' }));
    expect(screen.getByRole('alert')).toHaveTextContent('tổng từ 1 đến 100');
    await user.clear(adults);
    await user.type(adults, '4');
    await user.click(screen.getByRole('button', { name: 'Xác nhận bản thử' }));
    expect(screen.getByRole('status')).toHaveTextContent('4 người lớn, 0 trẻ em');
    await user.click(screen.getByRole('button', { name: 'Sửa phản hồi' }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Người lớn' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Người lớn' }), '3');
    await user.click(screen.getByRole('button', { name: 'Xác nhận bản thử' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 người lớn, 0 trẻ em');
    expect(screen.getByRole('status')).not.toHaveTextContent('4 người lớn');
  });
  it('handles unknown profile IDs without a crash', () => {
    open('/gia-pha/missing');
    expect(screen.getByRole('heading', { name: 'Không tìm thấy hồ sơ' })).toBeInTheDocument();
  });
});
