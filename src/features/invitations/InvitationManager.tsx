import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { MemorialEvent } from '../../shared/domain/anniversary';
import {
  attendanceLabels,
  suggestedTables,
  type AttendanceResponse,
} from '../../shared/domain/attendance';
import { InvitationApiError } from './api';
import { invitationLink, invitationMutation, loadInvitationDashboard } from './service';
import type { CardSettings, GuestGroup, InvitationDashboard, PublicCard } from './types';
import { InvitationCard } from './InvitationCard';
import { ResponseForm } from './ResponseForm';
import './invitations.css';

export function InvitationManager({ clanId, event }: { clanId: string; event: MemorialEvent }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details className="invitation-manager" onToggle={(e) => setExpanded(e.currentTarget.open)}>
      <summary>Thiệp mời & phản hồi theo hộ</summary>
      {expanded && <ManagerPanel clanId={clanId} event={event} />}
    </details>
  );
}
function ManagerPanel({ clanId, event }: { clanId: string; event: MemorialEvent }) {
  const [data, setData] = useState<InvitationDashboard | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false),
    [editingCard, setEditingCard] = useState(false);
  const [label, setLabel] = useState(''),
    [seats, setSeats] = useState('8');
  const [editing, setEditing] = useState<{ group: GuestGroup; eventVersion: number } | null>(null);
  const createOperation = useRef({ label: '', id: '' }),
    serial = useRef({ sequence: 0, active: true });
  const load = useCallback(async () => {
    const lifecycle = serial.current;
    const n = ++lifecycle.sequence;
    try {
      const value = await loadInvitationDashboard(clanId, event.id);
      if (lifecycle.active && n === lifecycle.sequence) {
        setData(value);
        setError('');
      }
    } catch (e) {
      if (lifecycle.active && n === lifecycle.sequence) {
        setError((e as Error).message);
        if (e instanceof InvitationApiError && (e.status === 403 || e.status === 404))
          setData(null);
      }
    }
  }, [clanId, event.id]);
  useEffect(() => {
    const lifecycle = serial.current;
    lifecycle.active = true;
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void load();
    }, 15000);
    return () => {
      lifecycle.active = false;
      lifecycle.sequence++;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load, event.version]);
  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await invitationMutation(clanId, event.id, action, {
        eventVersion: event.version,
        ...payload,
      });
      await load();
      setNotice('Đã lưu thay đổi.');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    if (createOperation.current.label !== label)
      createOperation.current = { label, id: crypto.randomUUID() };
    if (await act('createGroup', { label, operationId: createOperation.current.id })) {
      setLabel('');
      createOperation.current = { label: '', id: '' };
    }
  }
  const card = data?.card;
  const open = event.status === 'published';
  const currentGroup = data?.groups.find((g) => g.id === editing?.group.id);
  const tables = data ? suggestedTables(data.totals.people, Number(seats)) : null;
  return (
    <section
      className="invitation-management paper-panel"
      aria-label={'Quản lý thiệp ' + event.personName}
    >
      <p className="eyebrow">HẸN NHAU MỘT NGÀY SUM HỌP</p>
      <h3>Thiệp mời & lời hẹn của khách</h3>
      <p>
        Link xem chung chỉ mở thiệp. Mỗi hộ/nhóm có một link riêng để phản hồi thay cho cả nhóm;
        người có link có thể chuyển tiếp, vì vậy hãy gửi đúng người đại diện.
      </p>
      <p className="subtle">
        Bản local, chỉ dùng dữ liệu giả. Link hết hạn 7 ngày sau giờ tổ chức hiện tại. Chia sẻ thủ
        công; ứng dụng chưa gửi tin nhắn.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <button className="button secondary" disabled={busy} onClick={() => void load()}>
        Cập nhật phản hồi
      </button>
      {!data ? (
        <p role="status">Đang tải thiệp và nhóm khách…</p>
      ) : (
        <>
          <div className="button-row">
            <button
              className="button primary"
              disabled={busy || !open}
              onClick={() => setEditingCard(true)}
            >
              {card ? 'Chỉnh nội dung thiệp' : 'Soạn thiệp khách'}
            </button>
            {card?.published && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm('Rút thiệp khách? Mọi link sẽ tạm đóng đến khi bạn công bố lại.')
                  )
                    void act('withdrawCard', { version: card.version });
                }}
              >
                Rút thiệp khách
              </button>
            )}
          </div>
          {!open && (
            <p className="notice">
              Thiệp chỉ nhận phản hồi khi sự kiện đang được công bố. Sự kiện hủy hoặc hoàn tất sẽ
              ngừng nhận phản hồi.
            </p>
          )}
          {card && (
            <p>
              Thiệp khách: <strong>{card.published ? 'Đã công bố' : 'Đã rút'}</strong>
            </p>
          )}
          {editingCard && (
            <CardEditor
              initial={card || null}
              current={card || null}
              event={event}
              busy={busy}
              onClose={() => setEditingCard(false)}
              onPublish={async (payload) => {
                if (await act('publishCard', payload)) setEditingCard(false);
              }}
            />
          )}
          {card?.published && (
            <>
              <h4>Link xem thiệp chung</h4>
              {!card.publicRevoked ? (
                <ShareLink label="Link xem thiệp chung" token={card.publicToken} />
              ) : (
                <p>Link xem chung đã thu hồi; link riêng của các nhóm vẫn được kiểm tra riêng.</p>
              )}
              <div className="button-row">
                <button
                  className="button secondary"
                  disabled={busy || !open}
                  onClick={() => {
                    if (window.confirm('Cấp lại link xem chung? Link xem cũ sẽ mất hiệu lực.'))
                      void act('rotatePublic', { version: card.version });
                  }}
                >
                  Cấp lại link xem chung
                </button>
                {!card.publicRevoked && (
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Thu hồi link xem chung? Link riêng theo hộ vẫn có thể dùng.',
                        )
                      )
                        void act('revokePublic', { version: card.version });
                    }}
                  >
                    Thu hồi link xem chung
                  </button>
                )}
              </div>
            </>
          )}
          <h4>Tổng hợp tham dự</h4>
          <dl className="attendance-summary">
            <div>
              <dt>Nhóm được mời</dt>
              <dd>{data.totals.invited}</dd>
            </div>
            <div>
              <dt>Nhóm đã phản hồi</dt>
              <dd>{data.totals.responded}</dd>
            </div>
            <div>
              <dt>Nhóm chưa phản hồi</dt>
              <dd>{data.totals.pending}</dd>
            </div>
            <div>
              <dt>Người lớn</dt>
              <dd>{data.totals.adults}</dd>
            </div>
            <div>
              <dt>Trẻ em</dt>
              <dd>{data.totals.children}</dd>
            </div>
            <div>
              <dt>Tổng số người</dt>
              <dd>{data.totals.people}</dd>
            </div>
          </dl>
          <p>
            {data.totals.attending} nhóm tham dự · {data.totals.declined} nhóm không tham dự.
          </p>
          <label className="table-capacity">
            Số chỗ mỗi mâm
            <input
              type="number"
              min="1"
              max="30"
              step="1"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
          </label>
          <p role="status">
            Gợi ý:{' '}
            {tables === null
              ? 'nhập số chỗ từ 1 đến 30'
              : tables + ' mâm cho ' + data.totals.people + ' người'}
            . Đây chỉ là ước lượng theo số chỗ, không tự đặt dịch vụ.
          </p>
          <form className="workspace-form" onSubmit={create}>
            <label>
              Tên hộ/nhóm được mời
              <input
                required
                minLength={2}
                maxLength={100}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ví dụ: Gia đình bác An"
              />
            </label>
            <button className="button primary" disabled={busy || !card?.published || !open}>
              Tạo link riêng cho nhóm
            </button>
          </form>
          <p className="subtle">
            Thu hồi link chỉ ngăn truy cập; nhóm và phản hồi đã lưu vẫn nằm trong tổng hợp.
          </p>
          <div className="household-list">
            {data.groups.map((group) => (
              <article
                className="household-row"
                key={group.id}
                aria-label={'Nhóm khách ' + group.label}
              >
                <h4>{group.label}</h4>
                <p>
                  <strong>{attendanceLabels[group.response.status]}</strong>
                  {group.response.status === 'attending'
                    ? ' · ' +
                      group.response.adults +
                      ' người lớn, ' +
                      group.response.children +
                      ' trẻ em'
                    : ''}
                </p>
                {group.response.note && <p className="invitation-message">{group.response.note}</p>}
                {group.lastReason && <p>Lý do người quản lý cập nhật: {group.lastReason}</p>}
                {group.revoked ? (
                  <p className="notice">Link riêng đã thu hồi.</p>
                ) : (
                  <ShareLink label={'Link riêng của ' + group.label} token={group.token} />
                )}
                <div className="button-row">
                  <button
                    className="button secondary"
                    disabled={busy || !open}
                    onClick={() => setEditing({ group, eventVersion: event.version })}
                  >
                    Ghi phản hồi thay nhóm
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy || !open}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Cấp lại link riêng? Link cũ mất hiệu lực; phản hồi đã lưu được giữ lại.',
                        )
                      )
                        void act('rotateGroup', { groupId: group.id, version: group.version });
                    }}
                  >
                    Cấp lại link riêng
                  </button>
                  {!group.revoked && (
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Thu hồi link riêng của ' + group.label + '?'))
                          void act('revokeGroup', { groupId: group.id, version: group.version });
                      }}
                    >
                      Thu hồi link riêng
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {editing && currentGroup && (
            <div className="manager-response-editor">
              <button className="text-link" onClick={() => setEditing(null)}>
                Đóng phản hồi thay
              </button>
              <ManagerResponse
                key={
                  editing.group.id +
                  '_' +
                  editing.group.version +
                  '_' +
                  editing.group.responseVersion +
                  '_' +
                  editing.eventVersion
                }
                initial={editing.group}
                current={currentGroup}
                event={event}
                eventVersion={editing.eventVersion}
                clanId={clanId}
                onReset={() => setEditing({ group: currentGroup, eventVersion: event.version })}
                onSaved={async () => {
                  await load();
                  setEditing(null);
                  setNotice('Đã lưu phản hồi thay nhóm.');
                }}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
function ShareLink({ label, token }: { label: string; token: string }) {
  const [message, setMessage] = useState('');
  const link = invitationLink(token);
  return (
    <div className="invitation-share">
      <label>
        {label}
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <button
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setMessage('Đã sao chép link.');
          } catch {
            setMessage('Hãy chọn và sao chép link trong ô.');
          }
        }}
      >
        Sao chép link
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
function CardEditor({
  initial,
  current,
  event,
  busy,
  onClose,
  onPublish,
}: {
  initial: CardSettings | null;
  current: CardSettings | null;
  event: MemorialEvent;
  busy: boolean;
  onClose: () => void;
  onPublish: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [snapshot] = useState({ version: initial?.version ?? null, eventVersion: event.version });
  const [title, setTitle] = useState(initial?.title || 'Giỗ ' + event.personName),
    [message, setMessage] = useState(initial?.message || event.invitationText),
    [contact, setContact] = useState(initial?.contact || '');
  const [preview, setPreview] = useState(false),
    [consent, setConsent] = useState(false);
  const stale =
    snapshot.eventVersion !== event.version || snapshot.version !== (current?.version ?? null);
  const card: PublicCard = {
    title,
    message,
    contact,
    date: event.scheduledDate,
    time: event.scheduledTime,
    timeZone: event.timeZone,
    address: event.address,
    deadline: event.rsvpDeadlineLocal,
    deadlineAtUTC: event.deadlineAtUTC,
    status: event.status,
  };
  return (
    <section className="invitation-editor" aria-label="Soạn thiệp khách">
      <h4>Nội dung sẽ hiển thị cho người có link</h4>
      <button className="text-link" disabled={busy} onClick={onClose}>
        Đóng soạn thiệp
      </button>
      {stale && (
        <p role="alert" className="notice">
          Thiệp hoặc sự kiện đã thay đổi. Đóng và mở lại để đối chiếu bản mới trước khi công bố.
        </p>
      )}
      <form
        className="workspace-form"
        onSubmit={(e) => {
          e.preventDefault();
          setPreview(true);
          setConsent(false);
        }}
      >
        <label>
          Tiêu đề thiệp
          <input
            required
            minLength={2}
            maxLength={120}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setPreview(false);
            }}
          />
        </label>
        <label>
          Lời mời gửi người thân
          <textarea
            maxLength={3000}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setPreview(false);
            }}
          />
        </label>
        <label>
          Liên hệ được phép công bố (tùy chọn)
          <input
            maxLength={200}
            value={contact}
            onChange={(e) => {
              setContact(e.target.value);
              setPreview(false);
            }}
          />
        </label>
        <p>
          Ngày, giờ, múi giờ và địa chỉ lấy từ sự kiện hiện tại; khi đổi lịch, link thiệp sẽ hiển
          thị lịch mới.
        </p>
        <button className="button secondary" disabled={busy || stale}>
          Xem trước thiệp
        </button>
      </form>
      {preview && (
        <>
          <InvitationCard card={card} />
          <label className="response-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{' '}
            Tôi đồng ý cho người có link xem các nội dung trên, gồm địa chỉ và liên hệ đã nhập.
          </label>
          <button
            className="button primary"
            disabled={!consent || busy || stale}
            onClick={() =>
              void onPublish({
                version: snapshot.version,
                eventVersion: snapshot.eventVersion,
                title,
                message,
                contact,
                consent: true,
              })
            }
          >
            Công bố thiệp khách
          </button>
        </>
      )}
    </section>
  );
}
function ManagerResponse({
  initial,
  current,
  event,
  eventVersion,
  clanId,
  onReset,
  onSaved,
}: {
  initial: GuestGroup;
  current: GuestGroup;
  event: MemorialEvent;
  eventVersion: number;
  clanId: string;
  onReset: () => void;
  onSaved: () => Promise<void>;
}) {
  const op = useRef({ fingerprint: '', id: '' });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  async function submit(value: AttendanceResponse, reason: string) {
    const fingerprint = JSON.stringify({ value, reason });
    if (op.current.fingerprint !== fingerprint)
      op.current = { fingerprint, id: crypto.randomUUID() };
    await invitationMutation(clanId, event.id, 'recordResponse', {
      eventVersion,
      groupId: initial.id,
      version: initial.version,
      responseVersion: initial.responseVersion,
      ...value,
      reason,
      operationId: op.current.id,
    });
    await onSaved();
  }
  return (
    <ResponseForm
      manager
      late={now >= Date.parse(event.deadlineAtUTC)}
      label={initial.label}
      initial={initial.response}
      stale={
        initial.version !== current.version ||
        initial.responseVersion !== current.responseVersion ||
        eventVersion !== event.version
      }
      onReset={onReset}
      onSubmit={submit}
    />
  );
}
