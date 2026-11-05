import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Home,
  Leaf,
  Users,
  X,
} from 'lucide-react';
import { auth } from '../shared/firebase/client';
import { PwaBanner } from '../features/preparedness/PwaBanner';
import { InstallApp } from '../features/preparedness/InstallApp';
import HomePage from '../features/home/HomePage';

const GuestInvitationPage = lazy(() => import('../features/invitations/GuestInvitationPage'));
const JoinPage = lazy(() => import('../features/joining/JoinPage'));
const OfflinePage = lazy(() => import('../features/preparedness/OfflinePage'));
const WorkspacePage = lazy(() => import('../features/workspace/WorkspacePage'));

const navigation = [
  { path: '/', label: 'Tổng quan', icon: Home },
  { path: '/gia-pha', label: 'Gia phả', icon: BookOpen },
  { path: '/lich-gio', label: 'Lịch giỗ', icon: CalendarDays },
  { path: '/thanh-vien', label: 'Thành viên', icon: Users },
];

export default function App() {
  const location = useLocation();
  const guest = location.pathname === '/loi-moi';
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  const dialog = useRef<HTMLDialogElement>(null);
  const [largeText, setLargeText] = useState(false);
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      window.scrollTo(0, 0);
      main.current?.focus();
    }
  }, [location.pathname]);

  return (
    <div className={largeText ? 'app large-text' : 'app'}>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Đến nội dung chính
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Cội Nguồn — Trang chủ">
            <span className="brand-symbol">
              <Leaf size={27} strokeWidth={1.4} />
            </span>
            <span>
              Cội Nguồn<small>GÌN GIỮ ĐỂ TIẾP NỐI</small>
            </span>
          </Link>
          {!guest && (
            <nav className="desktop-nav" aria-label="Điều hướng chính">
              {navigation.map((n) => (
                <NavLink key={n.path} to={n.path} end={n.path === '/'}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          <InstallApp />
          <button
            className="account-button"
            onClick={() => dialog.current?.showModal()}
            aria-label="Mở cài đặt hiển thị"
          >
            <span className="account-avatar">Aa</span>
            <span>Cài đặt</span>
            <ChevronDown size={15} />
          </button>
        </div>
      </header>
      <div className="page-shell">
        {!guest && (
          <div className="context-bar">
            <span>
              <span className="status-dot" />{' '}
              {user ? user.displayName || user.email : 'Không gian gia phả riêng tư'}{' '}
              <span className="context-divider">/</span>{' '}
              {user ? 'Đã đăng nhập' : 'Dành cho mọi gia đình'}
            </span>
            <Link className="demo-label workspace-entry" to="/dong-ho">
              {user ? 'Dòng họ của tôi →' : 'Đăng nhập / Tạo dòng họ →'}
            </Link>
          </div>
        )}
        <main id="main-content" tabIndex={-1} ref={main}>
          <PwaBanner />
          <Routes>
            <Route
              path="/ngoai-tuyen"
              element={
                <Suspense fallback={<p role="status">Đang mở bản tải…</p>}>
                  <OfflinePage />
                </Suspense>
              }
            />
            <Route path="/" element={<HomePage />} />
            <Route
              path="/dong-ho"
              element={
                <Suspense fallback={<p role="status">Đang mở dòng họ…</p>}>
                  <WorkspacePage section="all" />
                </Suspense>
              }
            />
            <Route
              path="/gia-pha"
              element={
                <Suspense fallback={<p role="status">Đang mở gia phả…</p>}>
                  <WorkspacePage section="genealogy" />
                </Suspense>
              }
            />
            <Route
              path="/lich-gio"
              element={
                <Suspense fallback={<p role="status">Đang mở lịch giỗ…</p>}>
                  <WorkspacePage section="calendar" />
                </Suspense>
              }
            />
            <Route
              path="/thanh-vien"
              element={
                <Suspense fallback={<p role="status">Đang mở thành viên…</p>}>
                  <WorkspacePage section="members" />
                </Suspense>
              }
            />
            <Route
              path="/tham-gia"
              element={
                <Suspense fallback={<p role="status">Đang mở đăng ký…</p>}>
                  <JoinPage />
                </Suspense>
              }
            />
            <Route
              path="/loi-moi"
              element={
                <Suspense fallback={<p role="status">Đang mở thiệp…</p>}>
                  <GuestInvitationPage />
                </Suspense>
              }
            />
            <Route
              path="*"
              element={
                <section className="empty-state">
                  <h1>Trang này chưa có</h1>
                  <Link className="button primary" to="/">
                    Về trang chủ
                  </Link>
                </section>
              }
            />
          </Routes>
        </main>
        <footer className="site-footer">
          <span className="footer-brand">
            <Leaf size={17} /> Cội Nguồn
          </span>
          <span>Gìn giữ hôm nay, trao lại ngày mai.</span>
          {!guest && (
            <Link to="/dong-ho">
              Vào dòng họ của tôi <ArrowUpRight size={15} />
            </Link>
          )}
        </footer>
      </div>
      {!guest && (
        <nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">
          {navigation.map((n) => (
            <NavLink key={n.path} to={n.path} end={n.path === '/'}>
              <n.icon size={22} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
      <dialog ref={dialog} className="settings-dialog">
        <div className="dialog-heading">
          <h2>Cài đặt hiển thị</h2>
          <button
            className="icon-button"
            aria-label="Đóng cài đặt"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <p>Điều chỉnh để đọc thoải mái hơn.</p>
        <label className="text-setting">
          <span>Tăng cỡ chữ nội dung</span>
          <input
            type="checkbox"
            checked={largeText}
            onChange={(e) => setLargeText(e.target.checked)}
          />
        </label>
        <p className="subtle">
          Các thay đổi hiển thị chỉ áp dụng trong phiên hiện tại.
        </p>
        <button className="button primary full-width" onClick={() => dialog.current?.close()}>
          Xong
        </button>
      </dialog>
    </div>
  );
}
