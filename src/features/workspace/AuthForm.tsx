import { useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { login, friendlyError } from './service';
import { googleLogin } from './accountService';
import { useFirebaseEmulators } from '../../shared/firebase/client';
export default function AuthForm() {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await login(
        String(data.get('email')),
        String(data.get('password')),
        register ? String(data.get('name')) : undefined,
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <article className="paper-panel">
        <span className="icon-circle">
          <ShieldCheck size={25} />
        </span>
        <h2>
          Gia đình mình,
          <br />
          không gian của mình.
        </h2>
        <p>
          Đăng nhập để tạo dòng họ hoặc nhận lời mời. Mỗi dòng họ có danh sách thành viên và quyền
          truy cập riêng.
        </p>
        {useFirebaseEmulators && (
          <p className="subtle">
            Để thử local: khởi động <code>npm run emulators</code> ở terminal khác. Đăng nhập pilot
            sẽ dùng Google giả lập; Google thật cần cấu hình project riêng.
          </p>
        )}
      </article>
      <form className="paper-panel workspace-form" onSubmit={submit}>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await googleLogin();
            } catch (e) {
              setError(friendlyError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {useFirebaseEmulators ? 'Tiếp tục với Google (giả lập)' : 'Tiếp tục với Google'}
        </button>
        {useFirebaseEmulators && (
          <>
            <p className="subtle">
              Màn Google giả lập trên máy này; không nhập tài khoản Google thật. Form email bên dưới
              dành cho kiểm thử local.
            </p>
            <h2>{register ? 'Tạo tài khoản thử' : 'Đăng nhập local'}</h2>
            {register && (
              <label>
                Tên hiển thị giả
                <input
                  name="name"
                  autoComplete="nickname"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Ví dụ: Minh Khôi"
                />
              </label>
            )}
            <label>
              Email giả
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                placeholder="khoi@gia-dinh.test"
                aria-describedby="email-help"
              />
            </label>
            <p id="email-help" className="subtle">
              Dùng đuôi .test; không nhập email thật.
            </p>
            <label>
              Mật khẩu thử
              <input
                name="password"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {useFirebaseEmulators && (
          <>
            <button className="button primary full-width" disabled={busy}>
              {busy ? 'Đang kết nối…' : register ? 'Tạo tài khoản thử' : 'Đăng nhập'}
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Tạo tài khoản thử'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
