import { useEffect, useState } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import {
  joinMutation,
  watchJoinRequests,
  watchJoinSettings,
  type JoinRequest,
  type JoinSettings,
} from './service';
import './joining.css';
export function JoinManager({ clanId }: { clanId: string }) {
  const [settings, setSettings] = useState<JoinSettings | null | undefined>(undefined);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const a = watchJoinSettings(clanId, setSettings, (e) => {
      setSettings(undefined);
      setError(e.message);
    });
    const b = watchJoinRequests('clanId', clanId, setRequests, (e) => {
      setRequests([]);
      setError(e.message);
    });
    return () => {
      a();
      b();
    };
  }, [clanId]);
  const available = !!settings && !settings.revoked && settings.expiresAtMs > now;
  const link = available ? window.location.origin + '/tham-gia#' + settings.token : '';
  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await joinMutation(action, { clanId, ...payload });
      setNotice('Đã lưu thay đổi.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = requests.filter((r) => r.status === 'pending');
  return (
    <section className="paper-panel join-manager" aria-label="Đăng ký gia phả qua link chung">
      <p className="eyebrow">MỞ CỬA ĐÓN NGƯỜI THÂN</p>
      <h2>Link đăng ký vào gia phả</h2>
      <p>
        Chia sẻ cùng một link lên nhóm Zalo để nhiều người đăng ký. Bạn duyệt từng người trước khi
        họ được xem gia phả.
      </p>
      <p className="subtle">
        Người có link chỉ thấy tên gia phả và trang đăng ký. Link dùng trong 30 ngày; thu hồi hoặc
        đổi link sẽ ngăn duyệt những yêu cầu từ link cũ.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {settings === undefined ? (
        <p role="status">Đang tải link đăng ký…</p>
      ) : (
        <>
          {link ? (
            <div className="invite-link">
              <label>
                Link đăng ký dùng chung
                <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              </label>
              <button
                className="button secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setNotice('Đã sao chép. Bạn có thể dán link vào nhóm Zalo.');
                  } catch {
                    setError('Hãy chọn và sao chép link trong ô.');
                  }
                }}
              >
                <Copy size={18} /> Sao chép link đăng ký
              </button>
              <p>Hết hạn: {new Date(settings!.expiresAtMs).toLocaleDateString('vi-VN')}</p>
            </div>
          ) : (
            <p className="notice">
              {settings ? 'Link đã hết hạn hoặc được thu hồi.' : 'Chưa có link đăng ký dùng chung.'}
            </p>
          )}
          <div className="button-row">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                if (
                  !available ||
                  window.confirm(
                    'Đổi link đăng ký? Link cũ và yêu cầu chưa duyệt từ link đó sẽ mất hiệu lực.',
                  )
                )
                  void act('createLink', { version: settings?.version ?? null });
              }}
            >
              <UserPlus size={18} />
              {available ? 'Đổi link đăng ký' : 'Tạo link đăng ký'}
            </button>
            {available && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Thu hồi link đăng ký? Người thân cần link mới để đăng ký hoặc được duyệt.',
                    )
                  )
                    void act('revokeLink', { version: settings!.version });
                }}
              >
                Thu hồi link đăng ký
              </button>
            )}
          </div>
        </>
      )}
      <h3>Yêu cầu tham gia · {pending.length} đang chờ</h3>
      {!pending.length && <p className="subtle">Chưa có yêu cầu cần duyệt.</p>}
      <div className="join-request-list">
        {pending.map((r) => {
          const valid = available && r.linkVersion === settings?.version && r.linkExpiresAtMs > now;
          return (
            <article
              className="join-request"
              key={r.id}
              aria-label={'Yêu cầu của ' + r.displayName}
            >
              <h4>{r.displayName}</h4>
              <p className="join-message">{r.message}</p>
              {!valid && (
                <p className="notice">
                  Link đã hết hiệu lực. Người này cần đăng ký lại bằng link mới.
                </p>
              )}
              <p className="subtle">
                Khi duyệt, người này nhận quyền thành viên xem thông tin. Bạn có thể cấp quyền sửa
                hoặc admin riêng sau đó.
              </p>
              <div className="button-row">
                <button
                  className="button primary"
                  disabled={busy || !valid}
                  onClick={() =>
                    void act('review', { uid: r.uid, version: r.version, decision: 'approve' })
                  }
                >
                  Duyệt tham gia
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void act('review', { uid: r.uid, version: r.version, decision: 'reject' })
                  }
                >
                  Từ chối yêu cầu
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
