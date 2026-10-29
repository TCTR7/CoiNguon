import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { InvitationCard } from './InvitationCard';
import { ResponseForm } from './ResponseForm';
import { InvitationApiError, invitationRequest } from './api';
import type { GuestView } from './types';
import { attendanceLabels, type AttendanceResponse } from '../../shared/domain/attendance';
import './invitations.css';
export default function GuestInvitationPage() {
  const token = useLocation().hash.slice(1);
  return <GuestContent key={token} token={token} />;
}
function GuestContent({ token }: { token: string }) {
  const [view, setView] = useState<GuestView | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0),
    [notice, setNotice] = useState('');
  const serial = useRef({ sequence: 0, active: true });
  const refresh = useCallback(async () => {
    const lifecycle = serial.current;
    const current = ++lifecycle.sequence;
    try {
      const data = await invitationRequest<GuestView>('guest/preview', { token });
      if (lifecycle.active && current === lifecycle.sequence) {
        setView(data);
        setError('');
      }
    } catch (e) {
      if (lifecycle.active && current === lifecycle.sequence) {
        setError((e as Error).message);
        if (e instanceof InvitationApiError) setView(null);
      }
    } finally {
      if (lifecycle.active && current === lifecycle.sequence) setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    const lifecycle = serial.current;
    lifecycle.active = true;
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refresh();
    }, 30000);
    return () => {
      lifecycle.active = false;
      lifecycle.sequence++;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const robots = document.createElement('meta'),
      referrer = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,nofollow';
    referrer.name = 'referrer';
    referrer.content = 'no-referrer';
    document.head.append(robots, referrer);
    return () => {
      robots.remove();
      referrer.remove();
    };
  }, []);
  return (
    <section className="guest-invitation-page">
      <p className="local-invitation-note">
        Bản thử local — dùng thông tin giả. Không cần tạo tài khoản để phản hồi.
      </p>
      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
        </div>
      )}
      {loading && !view ? (
        <p role="status">Đang mở thiệp mời…</p>
      ) : !view ? (
        <div className="paper-panel">
          <h1>Chưa mở được thiệp mời</h1>
          <p>Hãy kiểm tra link hoặc liên hệ người đã mời bạn.</p>
        </div>
      ) : view.state === 'cancelled' ? (
        <div className="family-invitation">
          <h1>{view.title}</h1>
          <h2>Buổi giỗ đã hủy</h2>
          <p>Gia đình đã hủy buổi tổ chức này. Thiệp không nhận thêm phản hồi.</p>
        </div>
      ) : (
        view.card && (
          <>
            <InvitationCard card={view.card} main />
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            {view.group ? (
              <section
                className="paper-panel guest-response-panel"
                aria-label="Phản hồi của nhóm được mời"
              >
                <p className="eyebrow">LỜI HẸN CỦA GIA ĐÌNH</p>
                <h2>{view.group.label}</h2>
                <p>
                  Phản hồi hiện tại: <strong>{attendanceLabels[view.group.response.status]}</strong>
                  {view.group.response.status === 'attending'
                    ? ' · ' +
                      view.group.response.adults +
                      ' người lớn, ' +
                      view.group.response.children +
                      ' trẻ em'
                    : ''}
                </p>
                <p>
                  Hạn phản hồi: {view.card.deadline.replace('T', ' · ')} ({view.card.timeZone}).
                </p>
                {view.canRespond ? (
                  <GuestResponse
                    key={token + '_' + revision}
                    token={token}
                    view={view}
                    onRefresh={refresh}
                    onReset={() => setRevision((n) => n + 1)}
                    onStart={() => setNotice('')}
                    onSaved={async (value, responseVersion) => {
                      setView((previous) =>
                        previous?.group
                          ? {
                              ...previous,
                              group: { ...previous.group, response: value, responseVersion },
                            }
                          : previous,
                      );
                      await refresh();
                      setNotice(
                        'Đã lưu phản hồi của nhóm. Bạn có thể quay lại link này để sửa trước hạn.',
                      );
                      setRevision((n) => n + 1);
                    }}
                  />
                ) : (
                  <p className="notice">
                    {view.card.status === 'completed'
                      ? 'Buổi giỗ đã hoàn tất.'
                      : 'Đã qua hạn phản hồi.'}{' '}
                    Nếu cần cập nhật, hãy liên hệ người tổ chức.
                  </p>
                )}
              </section>
            ) : (
              <p className="notice">
                Đây là link xem thiệp chung. Để xác nhận số người, hãy xin người tổ chức link riêng
                cho hộ/nhóm của bạn.
              </p>
            )}
          </>
        )
      )}
      <div className="guest-invitation-footer">
        <button className="button secondary" onClick={() => void refresh()}>
          Tải thiệp cập nhật
        </button>
        <p>Link riêng đại diện cho cả nhóm. Chỉ chuyển link cho người được nhóm giao phản hồi.</p>
      </div>
    </section>
  );
}
function GuestResponse({
  token,
  view,
  onRefresh,
  onReset,
  onSaved,
  onStart,
}: {
  token: string;
  view: GuestView;
  onRefresh: () => Promise<void>;
  onReset: () => void;
  onSaved: (value: AttendanceResponse, responseVersion: number) => Promise<void>;
  onStart: () => void;
}) {
  const [snapshot] = useState(view);
  const operation = useRef({ fingerprint: '', id: '' });
  const group = snapshot.group!;
  const stale =
    snapshot.eventVersion !== view.eventVersion ||
    snapshot.cardVersion !== view.cardVersion ||
    group.responseVersion !== view.group?.responseVersion;
  async function submit(value: AttendanceResponse) {
    onStart();
    const fingerprint = JSON.stringify(value);
    if (operation.current.fingerprint !== fingerprint)
      operation.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const result = await invitationRequest<{ responseVersion: number }>('guest/respond', {
        token,
        ...value,
        eventVersion: snapshot.eventVersion,
        cardVersion: snapshot.cardVersion,
        responseVersion: group.responseVersion,
        operationId: operation.current.id,
      });
      await onSaved(value, result.responseVersion);
    } catch (e) {
      if (e instanceof InvitationApiError && e.status === 409) await onRefresh();
      throw e;
    }
  }
  return (
    <ResponseForm
      initial={group.response}
      label={group.label}
      stale={stale}
      onReset={onReset}
      onSubmit={submit}
    />
  );
}
