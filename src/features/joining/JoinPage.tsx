import { useEffect, useState, type FormEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Users } from 'lucide-react';
import { auth } from '../../shared/firebase/client';
import AuthForm from '../workspace/AuthForm';
import { logout, watchMine } from '../workspace/service';
import {
  joinMutation,
  previewJoin,
  requestLabels,
  watchJoinRequests,
  type JoinPreview,
  type JoinRequest,
} from './service';
import './joining.css';

export default function JoinPage() {
  const token = useLocation().hash.slice(1);
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [session, setSession] = useState<{ ready: boolean; user: User | null }>({
    ready: false,
    user: null,
  });
  useEffect(() => onAuthStateChanged(auth, (user) => setSession({ ready: true, user })), []);
  useEffect(() => {
    let current = true;
    void previewJoin(token)
      .then((value) => {
        if (current) {
          setPreview(value);
          setError('');
        }
      })
      .catch((e) => {
        if (current) {
          setPreview(null);
          setError(e.message);
        }
      });
    return () => {
      current = false;
    };
  }, [token, retry]);
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  return (
    <section className="workspace join-page">
      <div className="join-welcome">
        <span className="icon-circle">
          <Users size={28} />
        </span>
        <p className="eyebrow">MỘT LỜI MỜI VỀ CÙNG GỐC RỄ</p>
        <h1>Đăng ký tham gia gia phả</h1>
        {preview && <h2>{preview.clanName}</h2>}
        <p>
          Gửi lời giới thiệu để quản trị viên nhận ra bạn. Gia phả chỉ mở sau khi yêu cầu được
          duyệt.
        </p>
        <p className="subtle">Bản thử trên máy này — chỉ dùng thông tin giả.</p>
      </div>
      {error ? (
        <div className="notice" role="alert">
          <p>{error}</p>
          <button className="button secondary" onClick={() => setRetry((v) => v + 1)}>
            Thử tải lại link
          </button>
        </div>
      ) : !preview ? (
        <p role="status">Đang kiểm tra link đăng ký…</p>
      ) : !session.ready ? (
        <p role="status">Đang kiểm tra đăng nhập…</p>
      ) : session.user ? (
        <Applicant
          key={session.user.uid + '_' + token}
          user={session.user}
          preview={preview}
          token={token}
        />
      ) : (
        <>
          <div className="join-actions">
            <button className="button primary" onClick={() => setShowAuth(true)}>
              Đăng ký tham gia gia phả
            </button>
            <p>Cần đăng nhập hoặc tạo tài khoản trước khi gửi yêu cầu.</p>
          </div>
          {showAuth && <AuthForm />}
        </>
      )}
      <p className="join-privacy">
        <ShieldCheck size={20} /> Link này chỉ mở trang đăng ký. Người có link chưa được xem hồ sơ,
        cây gia phả hay danh sách thành viên.
      </p>
      <Link className="text-link" to="/dong-ho">
        Về dòng họ của tôi
      </Link>
    </section>
  );
}
function Applicant({ user, preview, token }: { user: User; preview: JoinPreview; token: string }) {
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [member, setMember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const request = requests?.find((r) => r.clanId === preview.clanId);
  useEffect(
    () =>
      watchJoinRequests('uid', user.uid, setRequests, (e) => {
        setRequests(null);
        setError(e.message);
      }),
    [user.uid],
  );
  useEffect(
    () =>
      watchMine(
        user.uid,
        (list) => setMember(list.some((m) => m.clanId === preview.clanId)),
        (e) => {
          setMember(false);
          setError(e.message);
        },
      ),
    [user.uid, preview.clanId],
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await joinMutation('submit', {
        token,
        displayName: String(data.get('displayName')),
        message: String(data.get('message')),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="paper-panel join-application" aria-label="Yêu cầu tham gia của bạn">
      <div className="session-bar">
        <span>Đang đăng nhập: {user.displayName || user.email}</span>
        <button
          className="text-link"
          disabled={busy}
          onClick={() => void logout().catch((e) => setError(e.message))}
        >
          Đổi tài khoản
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {member ? (
        <>
          <h2>Bạn đã là thành viên</h2>
          <p>Bạn có thể mở gia phả và cùng người thân bổ sung thông tin.</p>
          <button
            className="button primary"
            onClick={() => {
              sessionStorage.setItem('active-clan:' + user.uid, preview.clanId);
              navigate('/dong-ho');
            }}
          >
            Vào gia phả
          </button>
        </>
      ) : requests === null ? (
        <p role="status">Đang tải yêu cầu của bạn…</p>
      ) : request?.status === 'pending' && request.linkVersion === preview.linkVersion ? (
        <>
          <h2 aria-live="polite">{requestLabels.pending}</h2>
          <p>Đã nhận lời giới thiệu của bạn. Bạn có thể đóng trang và quay lại sau.</p>
          <p>{request.message}</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await joinMutation('withdraw', {
                  clanId: preview.clanId,
                  version: request.version,
                });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Rút yêu cầu
          </button>
        </>
      ) : request?.status === 'rejected' && request.linkVersion === preview.linkVersion ? (
        <>
          <h2>{requestLabels.rejected}</h2>
          <p>
            Hãy trao đổi với quản trị viên. Nếu cần gửi lại yêu cầu, hãy xin một link đăng ký mới.
          </p>
        </>
      ) : (
        <>
          {request && (
            <p className="notice">
              {request.status === 'pending'
                ? 'Yêu cầu cũ dùng link đã hết hiệu lực. Hãy gửi lại bằng link mới này.'
                : request.status === 'approved'
                  ? 'Quyền tham gia trước đây không còn hoạt động. Gửi yêu cầu mới để quản trị viên xem xét.'
                  : requestLabels[request.status]}
              {request.status === 'rejected'
                ? ' Nếu cần, hãy trao đổi với quản trị viên và xin link mới.'
                : ''}
            </p>
          )}
          <form className="workspace-form" onSubmit={submit}>
            <label>
              Tên để người thân nhận ra bạn
              <input
                name="displayName"
                defaultValue={user.displayName || ''}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label>
              Bạn có quan hệ thế nào với gia đình?
              <textarea
                name="message"
                required
                minLength={5}
                maxLength={300}
                placeholder="Ví dụ: Con của bác An, chi thứ hai."
              />
            </label>
            <p className="subtle">
              Tên và lời giới thiệu chỉ được gửi tới quản trị viên để duyệt. Không cần nhập giấy tờ
              hay thông tin nhạy cảm.
            </p>
            <button className="button primary" disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi yêu cầu tham gia'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
