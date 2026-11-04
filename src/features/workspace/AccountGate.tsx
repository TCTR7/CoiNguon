import { useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { useConnectivity } from '../../shared/offline/useOnline';
import { workspaceApi, googleReauthenticate, type Account } from './accountService';
import { friendlyError, logout } from './service';
import { normalizePhone } from '../../shared/domain/phone';

export function AccountGate({ user, children }: { user: User; children: ReactNode }) {
  const { online, generation } = useConnectivity();
  const [account, setAccount] = useState<Account | null | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    if (online)
      void workspaceApi('account', { action: 'get' })
        .then((data) => {
          if (current) {
            setAccount(data.account);
            setError('');
          }
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [user.uid, online, generation, retry]);
  return (
    <>
      <details className="paper-panel" hidden={!online} open={!account}>
        <summary>{account ? 'Tài khoản và số điện thoại' : 'Hoàn tất tài khoản'}</summary>
        <p>Đăng nhập: {user.email}. Chỉ dùng dữ liệu giả trong môi trường thử.</p>
        <p className="subtle">
          Số điện thoại bắt buộc để nhận lời mời. Số tự khai, chưa xác minh quyền sở hữu; không gửi
          SMS.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {account === undefined ? (
          <>
            <p role="status">Đang tải tài khoản…</p>
            <button className="button secondary" onClick={() => setRetry((v) => v + 1)}>
              Thử lại
            </button>
          </>
        ) : (
          <form
            key={account?.version ?? 'new'}
            className="workspace-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              setError('');
              try {
                const phone = String(form.get('phone'));
                if (account && normalizePhone(phone) !== account.phone)
                  await googleReauthenticate();
                const result = await workspaceApi('account', {
                  action: 'save',
                  phone,
                  displayName: String(form.get('displayName')),
                  version: account?.version ?? null,
                });
                setAccount(result.account);
              } catch (e) {
                setError(friendlyError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Tên tài khoản
              <input
                name="displayName"
                required
                minLength={2}
                maxLength={80}
                defaultValue={account?.displayName || user.displayName || ''}
              />
            </label>
            <label>
              Số điện thoại tài khoản
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                maxLength={24}
                placeholder="Ví dụ: 0901234567"
                defaultValue={account?.phone || ''}
              />
            </label>
            <p className="subtle">
              Số di động Việt Nam, đầu 0 hoặc +84. Nếu số đã được tài khoản khác khai, kiểm tra lại
              hoặc liên hệ người vận hành.
            </p>
            <button className="button primary" disabled={busy}>
              {busy ? 'Đang lưu…' : account ? 'Lưu tài khoản' : 'Hoàn tất tài khoản'}
            </button>
            {account && <p role="status">Số điện thoại chưa xác minh</p>}
          </form>
        )}
        {!account && (
          <button
            className="text-link"
            onClick={() => void logout().catch((e) => setError(e.message))}
          >
            Đăng xuất
          </button>
        )}
      </details>
      {(account || !online) && children}
    </>
  );
}
