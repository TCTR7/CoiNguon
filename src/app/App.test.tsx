import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../shared/firebase/client', () => ({
  auth: { currentUser: null },
  db: {},
  useFirebaseEmulators: true,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: null) => void) => {
    cb(null);
    return () => undefined;
  },
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  setPersistence: vi.fn(),
  browserSessionPersistence: {},
  browserLocalPersistence: {},
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
}));

import App from './App';

function open(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('application entry and workspace navigation', () => {
  it('shows the welcome overview without static demo family data and leads to sign-in', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Gìn giữ cội nguồn');
    expect(screen.queryByText(/Trần Văn An/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Đăng nhập \/ Tạo dòng họ$/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dòng họ của tôi' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Tiếp tục với Google/ })).toBeInTheDocument();
  });

  it('routes primary navigation tabs to their real workspace sections', async () => {
    const user = userEvent.setup();
    open('/gia-pha');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Gia phả dòng họ' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Tiếp tục với Google/ })).toBeInTheDocument();

    const mainNav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    await user.click(mainNav.querySelector('a[href="/lich-gio"]')!);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lịch giỗ & Sự kiện' }),
    ).toBeInTheDocument();

    await user.click(mainNav.querySelector('a[href="/thanh-vien"]')!);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Thành viên & Phân quyền' }),
    ).toBeInTheDocument();
  });

  it('toggles larger content text from display settings', async () => {
    const user = userEvent.setup();
    HTMLDialogElement.prototype.showModal ||= function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ||= function () {
      this.removeAttribute('open');
    };
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Mở cài đặt hiển thị' }));
    await user.click(screen.getByRole('checkbox', { name: 'Tăng cỡ chữ nội dung' }));
    expect(container.querySelector('.app')).toHaveClass('large-text');
  });

  it('handles unknown routes gracefully without crashing', () => {
    open('/trang-khong-ton-tai');
    expect(screen.getByRole('heading', { name: 'Trang này chưa có' })).toBeInTheDocument();
  });
});
