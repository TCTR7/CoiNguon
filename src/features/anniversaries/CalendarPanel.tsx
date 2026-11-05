import { InvitationManager } from '../invitations/InvitationManager';
import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, ArrowRight, ShieldCheck } from 'lucide-react';
import type { Membership } from '../workspace/service';
import { formatFamilyDate, type FamilyPerson } from '../../shared/domain/genealogy';
import {
  solarToLunar,
  anniversaryCandidate,
  confirmationCurrent,
  eventStatusLabels,
  sameDate,
  type AnniversaryRule,
  type HostAssignment,
  type MemorialEvent,
} from '../../shared/domain/anniversary';
import { eventMutation, watchCalendar, type CalendarData } from './service';
import { EventEditor } from './EventEditor';
import './anniversaries.css';

const dualDate = (value: string) => {
  if (!value) return 'Chưa xác định';
  const [year, month, day] = value.split('-').map(Number);
  const lunar = solarToLunar({ year, month, day });
  return (
    value +
    ' (dương)' +
    (lunar
      ? ' · ' +
        lunar.day +
        '/' +
        lunar.month +
        '/' +
        lunar.year +
        (lunar.leapMonth ? ' nhuận' : '') +
        ' (âm)'
      : '')
  );
};
const epoch = (m: Membership) =>
  String(m.joinedAt?.toMillis() ?? 0) + ':' + String(m.invitationId ?? '');
export function CalendarPanel({
  membership,
  members,
  onAccessLost,
}: {
  membership: Membership;
  members: Membership[];
  onAccessLost: (clanId: string) => void;
}) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [selected, setSelected] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<MemorialEvent | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(
    () =>
      watchCalendar(membership.clanId, setData, (e) => {
        setData(null);
        setEditing(null);
        setError(e.message);
        if ((e as { code?: string }).code === 'permission-denied') onAccessLost(membership.clanId);
      }),
    [membership.clanId, onAccessLost],
  );
  const people = data?.people.filter((p) => !p.archived && p.lifeStatus === 'deceased') || [];
  const person = people.find((p) => p.id === selected) || people[0];
  const assignment = data?.assignments.find((a) => a.id === person?.id);
  const rule = data?.rules.find((r) => r.id === person?.id);
  const admin = membership.role === 'admin';
  const memberName = (uid: string) =>
    members.find((m) => m.uid === uid)?.displayName || 'Người đã rời dòng họ';
  const hostActive = (a: HostAssignment | undefined) =>
    !!a && members.some((m) => m.uid === a.hostUid && epoch(m) === a.hostEpoch);
  const isHost = hostActive(assignment) && assignment?.hostUid === membership.uid;
  const canManage = admin || isHost;
  const visibleEvents =
    data?.events.filter((e) => e.personId === person?.id && e.year === year) || [];
  async function act(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await eventMutation(membership.clanId, action, payload);
      setNotice(result.notice || 'Đã lưu thay đổi.');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="calendar-workspace" aria-label="Lịch giỗ dòng họ">
      <div className="calendar-intro">
        <span className="calendar-seal" aria-hidden="true">
          <CalendarDays size={30} />
        </span>
        <div>
          <p className="eyebrow">GIỮ MỘT NGÀY SUM HỌP</p>
          <h2>Lịch giỗ & người gìn giữ</h2>
          <p>Ngày mất là gốc. Ngày giỗ theo nếp nhà. Ngày tổ chức do gia đình cùng thu xếp.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="calendar-feedback">
          {notice}
        </p>
      )}
      {!data ? (
        <p role="status">Đang tải lịch giỗ…</p>
      ) : !person ? (
        <div className="empty-state">
          <h3>Ngày sum họp bắt đầu từ một hồ sơ</h3>
          <p>Thêm hồ sơ người đã khuất trong gia phả phía trên để lập lịch giỗ đầu tiên.</p>
        </div>
      ) : (
        <>
          <div className="calendar-filters">
            <label>
              Người được tưởng nhớ
              <select
                value={person.id}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setEditing(null);
                }}
              >
                {people.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Năm lịch giỗ
              <input
                type="number"
                min={1900}
                max={2099}
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  setEditing(null);
                }}
              />
            </label>
          </div>
          <div className="date-origin">
            <small>NGÀY MẤT TRONG GIA PHẢ</small>
            <strong>{formatFamilyDate(person.death)}</strong>
            <span>Giữ nguyên khi bạn dời ngày tổ chức.</span>
          </div>
          <div className="calendar-planning">
            <div className="paper-panel">
              <p className="eyebrow">01 · NẾP NHÀ</p>
              <h3>Quy tắc giỗ hằng năm</h3>
              <p>
                Lịch âm Việt Nam · UTC+7 · đối chiếu 1900–2099. Năm âm có thể kết thúc vào đầu năm
                dương kế tiếp.
              </p>
              {rule && (
                <p className="notice">
                  {anniversaryCandidate(rule, year).explanation}
                  <br />
                  Ngày gợi ý (dương lịch):{' '}
                  <strong>{anniversaryCandidate(rule, year).date || 'Cần xác nhận riêng'}</strong>
                </p>
              )}
              {rule && !sameDate(rule.sourceDate, person.death) && (
                <p role="alert" className="form-error">
                  Ngày mất đã đổi. Lưu lại quy tắc và xác nhận lại sự kiện.
                </p>
              )}
              {canManage ? (
                <details>
                  <summary>{rule ? 'Điều chỉnh quy tắc' : 'Thiết lập quy tắc'}</summary>
                  <RuleForm
                    key={person.id + '_' + (rule?.version || 0)}
                    person={person}
                    rule={rule}
                    busy={busy}
                    onSave={(fields) =>
                      act('saveRule', {
                        personId: person.id,
                        version: rule?.version ?? null,
                        rule: fields,
                      })
                    }
                  />
                </details>
              ) : (
                <p className="subtle">Chủ sự hoặc quản trị viên thiết lập quy tắc cùng gia đình.</p>
              )}
            </div>
            <div className="paper-panel">
              <p className="eyebrow">02 · NGƯỜI GÌN GIỮ</p>
              <h3>Chủ sự lâu dài</h3>
              <p className="host-name">
                <ShieldCheck size={20} />
                {assignment ? memberName(assignment.hostUid) : 'Chưa phân công'}
              </p>
              {assignment && !hostActive(assignment) && (
                <p role="alert" className="form-error">
                  Chủ sự không còn hoạt động. Quản trị viên cần phân công lại.
                </p>
              )}
              {admin && (
                <form
                  className="workspace-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const toUid = String(new FormData(e.currentTarget).get('host'));
                    void act('assignHost', {
                      personId: person.id,
                      toUid,
                      version: assignment?.version ?? null,
                    });
                  }}
                >
                  <label>
                    Phân công chủ sự
                    <select
                      name="host"
                      defaultValue=""
                      required
                      key={person.id + '_' + assignment?.version}
                    >
                      <option value="" disabled>
                        Chọn người thân
                      </option>
                      {members.map((m) => (
                        <option value={m.uid} key={m.uid}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button secondary" disabled={busy}>
                    Lưu phân công
                  </button>
                </form>
              )}
              {isHost && (
                <details>
                  <summary>Chuyển chủ sự lâu dài</summary>
                  <p>Bạn giữ trách nhiệm đến khi người nhận đồng ý. Yêu cầu có hiệu lực 7 ngày.</p>
                  <RecipientForm
                    members={members}
                    uid={membership.uid}
                    busy={busy}
                    label="Gửi đề nghị chuyển chủ sự"
                    onSubmit={(toUid) =>
                      act('requestDelegation', { personId: person.id, scope: 'permanent', toUid })
                    }
                  />
                </details>
              )}
            </div>
          </div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">03 · HẸN MỘT NGÀY VỀ</p>
              <h3>Sự kiện năm {year}</h3>
            </div>
            {canManage && !visibleEvents.length && (
              <button
                className="button primary"
                disabled={busy || !rule}
                onClick={() => void act('createEvent', { personId: person.id, year })}
              >
                Tạo bản nháp <ArrowRight size={18} />
              </button>
            )}
          </div>
          {!visibleEvents.length && (
            <p className="notice">
              Chưa có sự kiện cho năm này. Mỗi người có một sự kiện mỗi năm lịch giỗ.
            </p>
          )}
          {visibleEvents.map((event) => {
            const a = data.assignments.find((v) => v.id === event.personId);
            const delegate =
              event.delegateUid === membership.uid &&
              event.delegateEpoch === epoch(membership) &&
              hostActive(a) &&
              event.delegateAssignmentVersion === a?.version;
            const editable = admin || isHost || delegate;
            const confirmed = confirmationCurrent(event, rule, person.death);
            return (
              <article key={event.id} className="memorial-card">
                <div className="memorial-card-top">
                  <div>
                    <span className="tag green">{eventStatusLabels[event.status]}</span>
                    <h3>Giỗ {event.personName}</h3>
                    <p>
                      Năm {event.year} ·{' '}
                      {rule?.calendar === 'lunar' ? 'Âm lịch Việt Nam' : 'Dương lịch'}
                    </p>
                  </div>
                  <div className="event-date-block">
                    <small>NGÀY TỔ CHỨC</small>
                    <strong>{event.scheduledDate || 'Chưa chọn'}</strong>
                    <span>
                      {event.scheduledTime || 'Chưa có giờ'} · {event.timeZone}
                    </span>
                  </div>
                </div>
                <dl className="event-facts">
                  <div>
                    <dt>Ngày giỗ đã đối chiếu</dt>
                    <dd>
                      {dualDate(event.anniversaryDate)} ·{' '}
                      {confirmed ? 'Đã xác nhận' : 'Cần xác nhận'}
                    </dd>
                  </div>
                  <div>
                    <dt>Địa điểm</dt>
                    <dd>{event.address || 'Chưa chọn'}</dd>
                  </div>
                  <div>
                    <dt>Hạn phản hồi tại địa điểm</dt>
                    <dd>{event.rsvpDeadlineLocal.replace('T', ' ') || 'Chưa chọn'}</dd>
                  </div>
                  <div>
                    <dt>Phụ trách sự kiện</dt>
                    <dd>
                      {event.delegateUid &&
                      hostActive(a) &&
                      event.delegateAssignmentVersion === a?.version &&
                      members.some(
                        (m) => m.uid === event.delegateUid && epoch(m) === event.delegateEpoch,
                      )
                        ? memberName(event.delegateUid) + ' · Được ủy quyền'
                        : a
                          ? memberName(a.hostUid)
                          : 'Chưa phân công'}
                    </dd>
                  </div>
                </dl>
                {!confirmed && !['completed', 'cancelled'].includes(event.status) && (
                  <p className="notice">
                    Ngày chưa xác nhận nên chưa đủ điều kiện công bố hoặc lên lịch nhắc.
                  </p>
                )}
                {event.invitationText && <p className="event-message">{event.invitationText}</p>}
                {editable && (
                  <div className="button-row">
                    {!['completed', 'cancelled'].includes(event.status) && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => setEditing(event)}
                      >
                        Sửa sự kiện
                      </button>
                    )}
                    {event.status === 'draft' && (
                      <button
                        className="button primary"
                        disabled={busy || !confirmed}
                        onClick={() =>
                          void act('transitionEvent', {
                            personId: person.id,
                            eventId: event.id,
                            version: event.version,
                            status: 'published',
                          })
                        }
                      >
                        Công bố trong dòng họ
                      </button>
                    )}
                    {event.status === 'published' && (
                      <>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            void act('transitionEvent', {
                              personId: person.id,
                              eventId: event.id,
                              version: event.version,
                              status: 'draft',
                            })
                          }
                        >
                          Chuyển về nháp
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Đánh dấu buổi giỗ đã hoàn tất? Sự kiện sẽ ngừng chỉnh sửa.',
                              )
                            )
                              void act('transitionEvent', {
                                personId: person.id,
                                eventId: event.id,
                                version: event.version,
                                status: 'completed',
                              });
                          }}
                        >
                          Hoàn tất sự kiện
                        </button>
                      </>
                    )}
                    {!['completed', 'cancelled'].includes(event.status) && (
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm('Hủy sự kiện năm này? Bạn có thể mở lại bản nháp.'))
                            void act('transitionEvent', {
                              personId: person.id,
                              eventId: event.id,
                              version: event.version,
                              status: 'cancelled',
                            });
                        }}
                      >
                        Hủy sự kiện
                      </button>
                    )}
                    {event.status === 'cancelled' && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          void act('transitionEvent', {
                            personId: person.id,
                            eventId: event.id,
                            version: event.version,
                            status: 'draft',
                          })
                        }
                      >
                        Mở lại bản nháp
                      </button>
                    )}
                  </div>
                )}
                {editable && <InvitationManager clanId={membership.clanId} event={event} />}
                {isHost && !['completed', 'cancelled'].includes(event.status) && (
                  <details>
                    <summary>Ủy quyền riêng buổi giỗ này</summary>
                    <p>Người nhận cần đồng ý; không thay đổi chủ sự lâu dài.</p>
                    <RecipientForm
                      members={members}
                      uid={membership.uid}
                      busy={busy}
                      label="Gửi đề nghị ủy quyền"
                      onSubmit={(toUid) =>
                        act('requestDelegation', {
                          personId: person.id,
                          eventId: event.id,
                          scope: 'event',
                          toUid,
                        })
                      }
                    />
                  </details>
                )}
                {canManage && event.delegateUid && (
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() =>
                      void act('revokeDelegate', {
                        personId: person.id,
                        eventId: event.id,
                        version: event.version,
                      })
                    }
                  >
                    Thu hồi ủy quyền
                  </button>
                )}
              </article>
            );
          })}
          {editing && (
            <EventEditor
              key={editing.id + '_' + editing.version}
              initial={editing}
              current={data.events.find((e) => e.id === editing.id)}
              rule={rule}
              death={person.death}
              onReload={() => setEditing(data.events.find((e) => e.id === editing.id) || null)}
              onClose={() => setEditing(null)}
              onSave={async (fields) => {
                const ok = await act('saveEvent', {
                  personId: person.id,
                  eventId: editing.id,
                  version: editing.version,
                  ...fields,
                });
                if (ok) setEditing(null);
              }}
            />
          )}
          {data.delegations
            .filter((d) => d.personId === person.id)
            .map((d) => {
              const a = data.assignments.find((v) => v.id === d.personId);
              const sender = members.find((m) => m.uid === d.fromUid),
                recipient = members.find((m) => m.uid === d.toUid);
              const event = data.events.find((e) => e.id === d.eventId);
              const effective =
                d.status === 'pending' &&
                d.expiresAtMs > now &&
                hostActive(a) &&
                a?.version === d.assignmentVersion &&
                !!sender &&
                epoch(sender) === d.fromEpoch &&
                !!recipient &&
                epoch(recipient) === d.toEpoch &&
                (d.scope === 'permanent' ||
                  (!!event &&
                    event.version === d.eventVersion &&
                    !['completed', 'cancelled'].includes(event.status)));
              const labels = {
                pending: 'Đang chờ',
                accepted: 'Đã nhận',
                rejected: 'Đã từ chối',
                cancelled: 'Đã hủy',
                expired: 'Hết hạn',
              };
              return (
                <section className="delegation-note" key={d.id}>
                  <strong>
                    {d.scope === 'permanent' ? 'Chuyển chủ sự lâu dài' : 'Ủy quyền một sự kiện'}
                  </strong>
                  <p>
                    {memberName(d.fromUid)} → {memberName(d.toUid)} ·{' '}
                    {effective
                      ? 'Đang chờ đồng ý'
                      : d.status === 'pending'
                        ? 'Đã mất hiệu lực'
                        : labels[d.status]}
                  </p>
                  <small>
                    Hết hạn: {new Date(d.expiresAtMs).toLocaleString('vi-VN')} · {d.resolution}
                  </small>
                  {effective && (
                    <div className="button-row">
                      {d.toUid === membership.uid && (
                        <>
                          <button
                            className="button primary"
                            disabled={busy}
                            onClick={() =>
                              void act('respondDelegation', {
                                requestId: d.id,
                                version: d.version,
                                decision: 'accept',
                              })
                            }
                          >
                            Đồng ý nhận trách nhiệm
                          </button>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() =>
                              void act('respondDelegation', {
                                requestId: d.id,
                                version: d.version,
                                decision: 'reject',
                              })
                            }
                          >
                            Từ chối
                          </button>
                        </>
                      )}
                      {(admin || d.fromUid === membership.uid) && (
                        <button
                          className="text-link"
                          disabled={busy}
                          onClick={() =>
                            void act('respondDelegation', {
                              requestId: d.id,
                              version: d.version,
                              decision: 'cancel',
                            })
                          }
                        >
                          Hủy đề nghị
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
        </>
      )}
    </section>
  );
}
function RuleForm({
  person,
  rule,
  busy,
  onSave,
}: {
  person: FamilyPerson;
  rule?: AnniversaryRule;
  busy: boolean;
  onSave: (fields: Record<string, unknown>) => Promise<boolean>;
}) {
  const [calendar, setCalendar] = useState(rule?.calendar || person.death.calendar);
  const [leapPolicy, setLeapPolicy] = useState(rule?.leapPolicy || 'unset');
  const [missingDayPolicy, setMissingDayPolicy] = useState(rule?.missingDayPolicy || 'unset');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onSave({ calendar, leapPolicy, missingDayPolicy });
  }
  return (
    <form className="workspace-form" onSubmit={submit}>
      <label>
        Lịch dùng để tính giỗ
        <select value={calendar} onChange={(e) => setCalendar(e.target.value as typeof calendar)}>
          <option value="lunar">Âm lịch Việt Nam</option>
          <option value="solar">Dương lịch</option>
        </select>
      </label>
      <label>
        Nếu ngày gốc thuộc tháng nhuận
        <select
          value={leapPolicy}
          onChange={(e) => setLeapPolicy(e.target.value as typeof leapPolicy)}
        >
          <option value="unset">Để gia đình xác nhận từng năm</option>
          <option value="regular">Dùng tháng thường cùng số</option>
          <option value="prefer-leap">Dùng tháng nhuận nếu có, nếu không dùng tháng thường</option>
        </select>
      </label>
      <label>
        Nếu năm đó thiếu ngày (30 âm hoặc 29/02)
        <select
          value={missingDayPolicy}
          onChange={(e) => setMissingDayPolicy(e.target.value as typeof missingDayPolicy)}
        >
          <option value="unset">Chưa chọn — cần xác nhận</option>
          <option value="last-day">Dùng ngày cuối tháng</option>
          <option value="manual">Xác nhận thủ công từng năm</option>
        </select>
      </label>
      <p className="subtle">Lưu quy tắc sẽ đưa các sự kiện đang mở về nháp để xác nhận lại ngày.</p>
      <button className="button primary" disabled={busy}>
        Lưu quy tắc
      </button>
    </form>
  );
}
function RecipientForm({
  members,
  uid,
  busy,
  label,
  onSubmit,
}: {
  members: Membership[];
  uid: string;
  busy: boolean;
  label: string;
  onSubmit: (uid: string) => Promise<boolean>;
}) {
  return (
    <form
      className="workspace-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(String(new FormData(e.currentTarget).get('recipient')));
      }}
    >
      <label>
        Người nhận trách nhiệm
        <select name="recipient" defaultValue="" required>
          <option value="" disabled>
            Chọn người thân
          </option>
          {members
            .filter((m) => m.uid !== uid)
            .map((m) => (
              <option value={m.uid} key={m.uid}>
                {m.displayName}
              </option>
            ))}
        </select>
      </label>
      <button className="button secondary" disabled={busy}>
        {label}
      </button>
    </form>
  );
}
