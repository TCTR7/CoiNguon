import { Suspense, lazy, useEffect, useRef, useState } from 'react';
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
import { PwaBanner } from '../features/preparedness/PwaBanner';
import HomePage from '../features/home/HomePage';
import PeoplePage from '../features/people/PeoplePage';
import ProfilePage from '../features/people/ProfilePage';
import CalendarPage from '../features/events/CalendarPage';
import InvitationPage from '../features/events/InvitationPage';
import MembersPage from '../features/members/MembersPage';
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
          <button
            className="account-button"
            onClick={() => dialog.current?.showModal()}
            aria-label="Mở cài đặt bản dùng thử"
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
              {['/dong-ho', '/tham-gia', '/ngoai-tuyen'].includes(location.pathname)
                ? 'Môi trường thử local'
                : 'Gia đình họ Trần · Mẫu'}{' '}
              <span className="context-divider">/</span> Nhà của chúng ta
            </span>
            <Link className="demo-label workspace-entry" to="/dong-ho">
              Vào dòng họ của tôi →
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
                  <WorkspacePage />
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
            <Route path="/gia-pha" element={<PeoplePage />} />
            <Route path="/gia-pha/:personId" element={<ProfilePage />} />
            <Route path="/lich-gio" element={<CalendarPage />} />
            <Route path="/thiep-moi" element={<InvitationPage />} />
            <Route path="/thanh-vien" element={<MembersPage />} />
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
            <Link to="/gia-pha">
              Về với gia đình <ArrowUpRight size={15} />
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
          Bản mẫu dùng dữ liệu giả. Các thay đổi hiển thị chỉ áp dụng trong phiên hiện tại.
        </p>
        <button className="button primary full-width" onClick={() => dialog.current?.close()}>
          Xong
        </button>
      </dialog>
    </div>
  );
}
