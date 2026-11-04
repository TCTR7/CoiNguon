import { useCallback, useEffect, useRef, useState } from 'react';
import { workspaceApi } from './accountService';
import { useConnectivity } from '../../shared/offline/useOnline';
interface Invite {
  id: string;
  status: string;
  version: number;
  personId?: string;
  personName?: string;
  phone?: string;
  recipient?: { name: string; email: string } | null;
}
const labels: Record<string, string> = {
  pending: 'Đã mời — chờ phản hồi',
  responded: 'Chờ admin xác nhận',
  approved: 'Đã tham gia',
  declined: 'Đã từ chối',
  rejected: 'Đã từ chối',
  revoked: 'Đã thu hồi',
  stale: 'Cần mời lại',
};
export function PhoneInvites({
  clanId,
  personId,
  canInvite = false,
}: {
  clanId?: string;
  personId?: string;
  canInvite?: boolean;
}) {
  const { online, generation } = useConnectivity();
  const [items, setItems] = useState<Invite[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const expandedPages = useRef(false);
  const load = useCallback(
    async (after?: string) => {
      const result = await workspaceApi('phone-invites', {
        action: clanId ? 'list' : 'inbox',
        clanId,
        personId,
        cursor: after,
      });
      return result as { items: Invite[]; cursor: string | null; contactPhone?: string };
    },
    [clanId, personId],
  );
  useEffect(() => {
    let current = true;
    async function refresh() {
      if (!online || document.hidden || expandedPages.current) return;
      try {
        const data = await load();
        if (current) {
          setItems(data.items);
          setContactPhone(data.contactPhone || '');
          setCursor(data.cursor);
          setReady(true);
          setError('');
        }
      } catch (e) {
        if (current) {
          setItems([]);
          setError((e as Error).message);
        }
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [load, online, generation]);
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await workspaceApi('phone-invites', body);
      const data = await load();
      setItems(data.items);
      setContactPhone(data.contactPhone || '');
      setCursor(data.cursor);
      setConfirmed([]);
      expandedPages.current = false;
      setNotice('Đã lưu thay đổi.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!online) return null;
  const selected = items.find((i) => i.personId === personId);
  return (
    <section
      className="paper-panel phone-invites"
      aria-label={
        clanId
          ? personId
            ? 'Mời tài khoản vào hồ sơ'
            : 'Quản lý lời mời theo số'
          : 'Lời mời của tôi'
      }
    >
      <h2>
        {clanId
          ? personId
            ? 'Mời tham gia từ hồ sơ này'
            : 'Lời mời theo số điện thoại'
          : 'Lời mời của tôi'}
      </h2>
      {!clanId && (
        <p>
          Số tự khai chưa xác minh. Chỉ mở gia phả sau khi bạn phản hồi và admin xác nhận đúng
          người.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <button
        className="text-link"
        disabled={busy}
        onClick={() => {
          expandedPages.current = false;
          setBusy(true);
          void load()
            .then((d) => {
              setItems(d.items);
              setContactPhone(d.contactPhone || '');
              setCursor(d.cursor);
              setReady(true);
              setError('');
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Tải lại lời mời
      </button>
      {personId && canInvite && (
        <form
          className="workspace-form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void act({
              action: 'create',
              clanId,
              personId,
              phone: String(data.get('phone')),
              version: selected?.version ?? null,
            });
          }}
        >
          <label>
            Số điện thoại người được mời
            <input
              type="tel"
              name="phone"
              required
              maxLength={24}
              key={contactPhone}
              defaultValue={contactPhone || selected?.phone || ''}
            />
          </label>
          <p className="subtle">Số liên hệ chỉ dành cho admin. Lưu số không tự gửi lời mời.</p>
          <div className="button-row">
            <button
              type="button"
              className="button secondary"
              disabled={busy || !ready}
              onClick={(e) => {
                const form = e.currentTarget.closest('form')!;
                if (form.reportValidity())
                  void act({
                    action: 'contact',
                    clanId,
                    personId,
                    phone: String(new FormData(form).get('phone')),
                  });
              }}
            >
              Lưu số liên hệ
            </button>
            <button className="button primary" disabled={busy || !ready}>
              Mời tham gia
            </button>
          </div>
        </form>
      )}
      {!ready && !error && <p role="status">Đang tải lời mời…</p>}
      {ready && !items.length && <p>{personId ? 'Chưa mời' : 'Chưa có lời mời.'}</p>}
      {items.map((i) => (
        <article key={i.id} className="join-request" aria-label={'Lời mời ' + i.id}>
          <p>Mã tham chiếu: {i.id.slice(-12)}</p>
          {clanId && (
            <p>
              Hồ sơ: {i.personName} · Số liên hệ: {i.phone}
            </p>
          )}
          <strong>{labels[i.status] || i.status}</strong>
          {clanId && i.recipient && (
            <p>
              Người phản hồi: {i.recipient.name} · {i.recipient.email}
            </p>
          )}
          {!clanId && i.status === 'pending' && (
            <div className="button-row">
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void act({ action: 'respond', id: i.id, version: i.version, decision: 'accept' })
                }
              >
                Đây là tôi — yêu cầu tham gia
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void act({ action: 'respond', id: i.id, version: i.version, decision: 'decline' })
                }
              >
                Không phải tôi
              </button>
            </div>
          )}
          {clanId && i.status === 'responded' && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed.includes(i.id + ':' + i.version)}
                  onChange={(e) =>
                    setConfirmed((ids) =>
                      e.target.checked
                        ? [...ids, i.id + ':' + i.version]
                        : ids.filter((id) => id !== i.id + ':' + i.version),
                    )
                  }
                />{' '}
                Tôi đã đối chiếu đúng người thân qua kênh đã biết
              </label>
              <div className="button-row">
                <button
                  className="button primary"
                  disabled={busy || !confirmed.includes(i.id + ':' + i.version)}
                  onClick={() =>
                    void act({
                      action: 'review',
                      id: i.id,
                      version: i.version,
                      decision: 'approve',
                      confirmed: true,
                    })
                  }
                >
                  Xác nhận và cấp quyền
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void act({ action: 'review', id: i.id, version: i.version, decision: 'reject' })
                  }
                >
                  Từ chối tài khoản
                </button>
              </div>
            </>
          )}
          {clanId && ['pending', 'responded', 'stale'].includes(i.status) && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => void act({ action: 'revoke', id: i.id, version: i.version })}
            >
              Thu hồi lời mời theo số
            </button>
          )}
        </article>
      ))}
      {cursor && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            expandedPages.current = true;
            setBusy(true);
            void load(cursor)
              .then((d) => {
                setItems((rows) => [...rows, ...d.items]);
                setCursor(d.cursor);
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          Xem thêm lời mời
        </button>
      )}
    </section>
  );
}
