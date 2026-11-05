import { RemindersPanel } from '../preparedness/RemindersPanel';
import { DataPanel } from '../preparedness/DataPanel';
import { OfflineViewer } from '../preparedness/OfflinePage';
import { useConnectivity } from '../../shared/offline/useOnline';
import { MyJoinRequests } from '../joining/MyJoinRequests';
import { JoinManager } from '../joining/JoinManager';
import AuthForm from './AuthForm';
import { AccountGate } from './AccountGate';
import { PhoneInvites } from './PhoneInvites';
import { CalendarPanel } from '../anniversaries/CalendarPanel';
import GenealogyPanel from '../genealogy/GenealogyPanel';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Check, Copy, LogOut, Plus, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { auth } from '../../shared/firebase/client';
import {
  acceptInvitation,
  changeRole,
  createClan,
  createInvitation,
  friendlyError,
  getClan,
  getInvitation,
  logout,
  removeMember,
  revokeInvitation,
  roleLabels,
  watchInvitations,
  watchMembers,
  watchMine,
  type Clan,
  type Invitation,
  type Membership,
  type Role,
} from './service';
export type WorkspaceSection = 'all' | 'genealogy' | 'calendar' | 'members';
const sectionMeta: Record<WorkspaceSection, { eyebrow: string; title: string; intro: string }> = {
  all: {
    eyebrow: 'MỘT NƠI ĐỂ CÙNG GÌN GIỮ',
    title: 'Dòng họ của tôi',
    intro: 'Tạo mái nhà chung, mời người thân và cùng nhau chăm chút gia phả.',
  },
  genealogy: {
    eyebrow: 'CỘI NGUỒN CÁC THẾ HỆ',
    title: 'Gia phả dòng họ',
    intro: 'Lưu giữ hồ sơ người thân, kết nối quan hệ gia đình và tra cứu sơ đồ cây các thế hệ.',
  },
  calendar: {
    eyebrow: 'CÙNG NHAU GHI NHỚ',
    title: 'Lịch giỗ & Sự kiện',
    intro: 'Theo dõi ngày giỗ âm dương hàng năm, phân công chủ sự và gửi thiệp mời sum họp.',
  },
  members: {
    eyebrow: 'MÁI NHÀ CHUNG',
    title: 'Thành viên & Phân quyền',
    intro: 'Quản lý thành viên trong dòng họ, gửi lời mời và xét duyệt yêu cầu tham gia.',
  },
};
export default function WorkspacePage({ section = 'all' }: { section?: WorkspaceSection }) {
  const [session, setSession] = useState<{ ready: boolean; user: User | null }>({
    ready: false,
    user: null,
  });
  useEffect(() => onAuthStateChanged(auth, (user) => setSession({ ready: true, user })), []);
  const meta = sectionMeta[section];
  return (
    <section className="workspace">
      <p className="eyebrow">{meta.eyebrow}</p>
      <h1>{meta.title}</h1>
      <p className="page-intro">{meta.intro}</p>
      {!session.ready ? (
        <p role="status">Đang kiểm tra đăng nhập…</p>
      ) : session.user ? (
        <AccountGate key={session.user.uid} user={session.user}>
          <SignedIn user={session.user} section={section} />
        </AccountGate>
      ) : (
        <AuthForm />
      )}
    </section>
  );
}
function SignedIn({ user, section }: { user: User; section: WorkspaceSection }) {
  const { online, generation } = useConnectivity();
  const [verifiedGeneration, setVerifiedGeneration] = useState(-1);
  const [mine, setMine] = useState<Membership[] | null>(null);
  const onAccessLost = useCallback((clanId: string) => {
    setMine((current) => current?.filter((m) => m.clanId !== clanId) ?? []);
  }, []);
  const [error, setError] = useState('');
  const [chosen, setChosenState] = useState(
    () => sessionStorage.getItem('active-clan:' + user.uid) || '',
  );
  function setChosen(id: string) {
    sessionStorage.setItem('active-clan:' + user.uid, id);
    setChosenState(id);
  }
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const token = params.get('moi') || '';
  const selected = mine?.find((m) => m.clanId === chosen) || mine?.[0];
  useEffect(
    () =>
      watchMine(
        user.uid,
        (members) => {
          setMine(members);
          setVerifiedGeneration(generation);
        },
        (e) => {
          setMine([]);
          setError(friendlyError(e));
        },
      ),
    [user.uid, generation],
  );
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get('clanName'));
    setBusy(true);
    setError('');
    try {
      setChosen(await createClan(name));
      form.reset();
      const details = form.closest('details');
      if (details) details.open = false;
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!online && <OfflineViewer uid={user.uid} />}
      {online && verifiedGeneration !== generation && (
        <p role="status">Đang xác minh quyền truy cập…</p>
      )}
      <div className="session-bar">
        <span>
          <ShieldCheck size={19} /> {user.displayName || user.email}
        </span>
        <button
          className="text-link"
          onClick={() => {
            void logout().catch((e) => setError(friendlyError(e)));
          }}
        >
          <LogOut size={18} /> Đăng xuất
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div
        hidden={!online || verifiedGeneration !== generation}
        inert={!online || verifiedGeneration !== generation}
      >
        {token && (
          <AcceptInvite
            key={token}
            token={token}
            onAccepted={(id) => {
              setChosen(id);
              setParams({});
            }}
            onClose={() => setParams({})}
          />
        )}
        {(section === 'all' || section === 'members' || !selected) && <PhoneInvites />}
        <div className="clan-controls">
          <label>
            Dòng họ đang xem
            <select
              value={selected?.clanId || ''}
              onChange={(e) => setChosen(e.target.value)}
              disabled={!mine?.length}
            >
              <option value="" disabled>
                {mine === null ? 'Đang tải…' : 'Chọn dòng họ'}
              </option>
              {mine?.map((m) => (
                <ClanOption key={m.clanId} membership={m} />
              ))}
            </select>
          </label>
          <details className="create-clan">
            <summary>
              <Plus size={18} /> Tạo dòng họ mới
            </summary>
            <form className="workspace-form" onSubmit={create}>
              <label>
                Tên dòng họ
                <input
                  name="clanName"
                  minLength={2}
                  maxLength={80}
                  required
                  placeholder="Ví dụ: Gia đình họ Trần"
                />
              </label>
              <button className="button primary" disabled={busy}>
                {busy ? 'Đang tạo…' : 'Tạo dòng họ'}
              </button>
            </form>
          </details>
        </div>
        {mine === null && !error ? (
          <p role="status">Đang tải dòng họ…</p>
        ) : selected ? (
          <ClanPanel
            key={selected.clanId + '_' + selected.role}
            membership={selected}
            onAccessLost={onAccessLost}
            section={section}
          />
        ) : (
          <div className="empty-state">
            <Users size={36} />
            <h2>Chưa tham gia dòng họ nào</h2>
            <p>Tạo dòng họ đầu tiên hoặc kiểm tra lời mời theo số điện thoại của bạn.</p>
          </div>
        )}
        {(section === 'all' || section === 'members' || !selected) && (
          <>
            <MyJoinRequests uid={user.uid} />
            <JoinByCode />
          </>
        )}
      </div>
    </>
  );
}
function ClanOption({ membership }: { membership: Membership }) {
  const [name, setName] = useState('Dòng họ của tôi');
  useEffect(() => {
    let current = true;
    void getClan(membership.clanId)
      .then((clan) => {
        if (current) setName(clan.name);
      })
      .catch(() => {
        if (current) setName('Dòng họ không còn truy cập được');
      });
    return () => {
      current = false;
    };
  }, [membership.clanId]);
  return (
    <option value={membership.clanId}>
      {name} · {roleLabels[membership.role]}
    </option>
  );
}
function JoinByCode() {
  const [, setParams] = useSearchParams();
  const [error, setError] = useState('');
  return (
    <details className="join-code">
      <summary>Đã có mã mời từ người thân?</summary>
      <form
        className="workspace-form"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get('code')).trim();
          if (!/^[a-f0-9]{64}$/.test(value)) {
            setError('Nhập mã 64 ký tự được người thân cung cấp.');
            return;
          }
          setError('');
          setParams({ moi: value });
        }}
      >
        <label>
          Mã mời
          <input name="code" autoComplete="off" spellCheck={false} required />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button secondary">Xem lời mời</button>
      </form>
    </details>
  );
}
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
function AcceptInvite({
  token,
  onAccepted,
  onClose,
}: {
  token: string;
  onAccepted: (id: string) => void;
  onClose: () => void;
}) {
  const now = useNow();
  const [submitted, setSubmitted] = useState(false);
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    void getInvitation(token)
      .then((i) => {
        if (current) setInvite(i);
      })
      .catch((e) => {
        if (current) setError(friendlyError(e));
      });
    return () => {
      current = false;
    };
  }, [token]);
  const unavailable =
    invite && (invite.revoked || !!invite.acceptedBy || invite.expiresAt.toMillis() <= now);
  return (
    <section className="paper-panel accept-invite">
      <p className="eyebrow">LỜI MỜI TỪ NGƯỜI THÂN</p>
      <h2>{invite ? invite.clanName : 'Nhận lời mời'}</h2>
      {invite && (
        <p>
          Sau khi bạn đồng ý, admin cần xác nhận trước khi cấp quyền thành viên. Chỉ nhận nếu bạn
          biết người gửi.
        </p>
      )}
      {unavailable && (
        <p role="alert" className="form-error">
          Lời mời đã dùng, hết hạn hoặc được thu hồi.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="button-row">
        <button
          className="button primary"
          disabled={!invite || !!unavailable || busy || submitted}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const clanId = await acceptInvitation(token);
              setSubmitted(true);
              onAccepted(clanId);
            } catch (e) {
              setError(friendlyError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check size={18} />
          {submitted ? 'Đang chờ admin duyệt' : busy ? 'Đang gửi…' : 'Đồng ý tham gia'}
        </button>
        <button className="button secondary" onClick={onClose}>
          Đóng lời mời
        </button>
      </div>
    </section>
  );
}
function ClanPanel({
  membership,
  onAccessLost,
  section,
}: {
  membership: Membership;
  onAccessLost: (clanId: string) => void;
  section: WorkspaceSection;
}) {
  const [clan, setClan] = useState<Clan | null>(null);
  const [members, setMembers] = useState<Membership[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState<Membership | null>(null);
  const admin = membership.role === 'admin';
  const lastAdmin = admin && (members?.filter((m) => m.role === 'admin').length ?? 0) <= 1;
  const [roleConfirm, setRoleConfirm] = useState<{ member: Membership; role: Role } | null>(null);
  useEffect(() => {
    let current = true;
    void getClan(membership.clanId)
      .then((c) => {
        if (current) setClan(c);
      })
      .catch((e) => {
        if (current) setError(friendlyError(e));
      });
    const unsubscribe = watchMembers(membership.clanId, setMembers, (e) => {
      setMembers(null);
      setError(friendlyError(e));
      if ((e as { code?: string }).code === 'permission-denied') onAccessLost(membership.clanId);
    });
    return () => {
      current = false;
      unsubscribe();
    };
  }, [membership.clanId, onAccessLost]);
  async function act(id: string, task: () => Promise<void>) {
    setBusy(id);
    setError('');
    try {
      await task();
      setConfirm(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{roleLabels[membership.role].toUpperCase()}</p>
          <h2>{clan?.name || 'Đang tải dòng họ…'}</h2>
        </div>
        <span className="tag green">{members?.length ?? '…'} thành viên</span>
      </div>
      {section === 'all' && <DataPanel membership={membership} />}
      {(section === 'all' || section === 'calendar') && <RemindersPanel membership={membership} />}
      {(section === 'all' || section === 'genealogy') && (
        <GenealogyPanel membership={membership} onAccessLost={onAccessLost} />
      )}
      {(section === 'all' || section === 'members') && admin && (
        <PhoneInvites clanId={membership.clanId} />
      )}
      {(section === 'all' || section === 'calendar') && (
        <CalendarPanel membership={membership} members={members || []} onAccessLost={onAccessLost} />
      )}
      {(section === 'all' || section === 'members') && (
        <>
          <h3 className="members-heading">Thành viên dòng họ</h3>
      <p className="subtle">
        Chỉ hiển thị tên và vai trò trong dòng họ; email và thông tin đăng nhập không nằm trong danh
        sách này.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="person-list">
        {members?.map((m) => (
          <div className="person-list-item member-item" key={m.id}>
            <span className="avatar">{m.displayName.slice(0, 1)}</span>
            <span className="person-list-name">
              <strong>
                {m.displayName}
                {m.uid === membership.uid ? ' (bạn)' : ''}
              </strong>
              <small>
                {roleLabels[m.role]}
                {m.uid === clan?.ownerUid ? ' · Người tạo dòng họ' : ''}
              </small>
            </span>
            {admin ? (
              <>
                <label className="member-role">
                  <span className="sr-only">Vai trò của {m.displayName}</span>
                  <select
                    value={m.role}
                    disabled={!!busy || (m.uid === membership.uid && lastAdmin)}
                    onChange={(e) => {
                      const role = e.target.value as Role;
                      if (m.uid === membership.uid && role !== 'admin')
                        setRoleConfirm({ member: m, role });
                      else void act(m.id, () => changeRole(m, role));
                    }}
                  >
                    {Object.entries(roleLabels).map(([role, label]) => (
                      <option key={role} value={role}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {m.uid !== membership.uid && (
                  <button
                    className="text-link remove-button"
                    disabled={!!busy}
                    onClick={() => setConfirm(m)}
                  >
                    Gỡ<span className="sr-only"> {m.displayName}</span>
                  </button>
                )}
              </>
            ) : null}
          </div>
        ))}
      </div>
      {confirm && (
        <section
          className="notice remove-confirm"
          aria-label={
            confirm.uid === membership.uid ? 'Xác nhận rời gia phả' : 'Xác nhận gỡ thành viên'
          }
        >
          <div>
            <strong>
              {confirm.uid === membership.uid
                ? 'Bạn muốn rời gia phả này?'
                : 'Gỡ ' + confirm.displayName + ' khỏi dòng họ?'}
            </strong>
            <p>
              {confirm.uid === membership.uid
                ? 'Bạn sẽ mất quyền truy cập. Hồ sơ gia phả vẫn được giữ lại; muốn trở lại cần được mời hoặc duyệt yêu cầu mới.'
                : 'Người này sẽ mất quyền truy cập. Muốn tham gia lại cần được mời hoặc duyệt yêu cầu mới.'}
            </p>
            <div className="button-row">
              <button
                className="button primary"
                disabled={!!busy}
                onClick={() => {
                  void act(confirm.id, () => removeMember(confirm));
                }}
              >
                {confirm.uid === membership.uid ? 'Đồng ý rời gia phả' : 'Đồng ý gỡ'}
              </button>
              <button className="button secondary" onClick={() => setConfirm(null)}>
                {confirm.uid === membership.uid ? 'Ở lại gia phả' : 'Giữ thành viên'}
              </button>
            </div>
          </div>
        </section>
      )}
      <p className="subtle">
        Quyền quản trị độc lập với vai vế và hồ sơ gia phả. Người tạo có thể bàn giao quyền; gia phả
        luôn cần ít nhất một quản trị viên.
      </p>
      {lastAdmin && (
        <p className="notice" role="status">
          Bạn là quản trị viên cuối cùng. Hãy cấp quyền quản trị cho người khác trước khi hạ quyền
          hoặc rời gia phả.
        </p>
      )}
      <button
        className="button secondary"
        disabled={!!busy || members === null || lastAdmin}
        onClick={() => setConfirm(membership)}
      >
        Rời gia phả
      </button>
      {roleConfirm && (
        <section className="notice remove-confirm" aria-label="Xác nhận hạ quyền của bạn">
          <strong>Hạ quyền của bạn xuống {roleLabels[roleConfirm.role]}?</strong>
          <p>
            Bạn sẽ không còn quản lý thành viên. Chỉ quản trị viên khác có thể cấp lại quyền quản
            trị cho bạn.
          </p>
          <div className="button-row">
            <button
              className="button primary"
              disabled={!!busy}
              onClick={() =>
                void act(roleConfirm.member.id, async () => {
                  await changeRole(roleConfirm.member, roleConfirm.role);
                  setRoleConfirm(null);
                })
              }
            >
              Đồng ý hạ quyền
            </button>
            <button
              className="button secondary"
              disabled={!!busy}
              onClick={() => setRoleConfirm(null)}
            >
              Giữ quyền quản trị
            </button>
          </div>
        </section>
      )}
          {admin && clan ? (
            <>
              <JoinManager key={clan.id + '_join'} clanId={clan.id} />
              <InviteManager key={clan.id} clan={clan} />
            </>
          ) : (
            <p className="notice">
              <ShieldCheck size={20} /> Chỉ quản trị viên có thể mời người thân và thay đổi vai trò.
            </p>
          )}
        </>
      )}
    </>
  );
}
function InviteManager({ clan }: { clan: Clan }) {
  const now = useNow();
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [role, setRole] = useState<'editor' | 'member'>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [latest, setLatest] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(
    () =>
      watchInvitations(clan.id, setInvites, (e) => {
        setInvites([]);
        setError(friendlyError(e));
      }),
    [clan.id],
  );
  const link = latest ? window.location.origin + '/dong-ho?moi=' + latest : '';
  return (
    <section className="paper-panel invite-manager">
      <p className="eyebrow">MỞ THÊM MỘT CÁNH CỬA</p>
      <h2>Mời người thân</h2>
      <p className="subtle">
        Lời mời riêng dùng một lần trong 6 ngày. Người nhận phản hồi rồi chờ admin duyệt quyền thành
        viên. Chỉ gửi riêng đúng người; có thể mời theo số điện thoại ngay tại hồ sơ người còn sống.
      </p>
      <div className="button-row">
        <label>
          Quyền sau khi được duyệt
          <select value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'member')}>
            <option value="member">Thành viên — xem thông tin</option>
          </select>
        </label>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              setLatest(await createInvitation(clan, role));
              setCopied(false);
            } catch (e) {
              setError(friendlyError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <UserPlus size={18} />
          {busy ? 'Đang tạo…' : 'Tạo link mời'}
        </button>
      </div>
      {latest && (
        <div className="invite-link">
          <label>
            Link mời vừa tạo
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setError('Chưa sao chép được. Bạn có thể chọn và sao chép link trong ô.');
              }
            }}
          >
            <Copy size={17} />
            {copied ? 'Đã sao chép' : 'Sao chép link'}
          </button>
          <p className="subtle" role="status">
            {copied ? 'Đã sao chép link mời.' : 'Link chưa được gửi cho ai.'}
          </p>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <ul className="invitation-list">
        {invites.map((i, index) => (
          <li key={i.id}>
            <span>
              Lời mời {index + 1} · {roleLabels[i.role]}
              <small>
                {i.revoked
                  ? 'Đã thu hồi'
                  : i.acceptedBy
                    ? 'Đã sử dụng'
                    : i.expiresAt.toMillis() <= now
                      ? 'Đã hết hạn'
                      : 'Đang chờ · hết hạn ' + i.expiresAt.toDate().toLocaleDateString('vi-VN')}
              </small>
            </span>
            {!i.revoked && !i.acceptedBy && (
              <button
                className="text-link"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await revokeInvitation(i.id);
                    if (latest === i.id) setLatest('');
                  } catch (e) {
                    setError(friendlyError(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Thu hồi<span className="sr-only"> lời mời {index + 1}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
