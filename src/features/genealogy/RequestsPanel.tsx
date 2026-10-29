import { useState, type FormEvent } from 'react';
import type { FamilyPerson, PersonLink, PersonRequest } from '../../shared/domain/genealogy';
import { genealogyMutation } from './service';
export function RequestForm({
  clanId,
  person,
  link,
  uid,
}: {
  clanId: string;
  person: FamilyPerson;
  link?: PersonLink;
  uid: string;
}) {
  const [kind, setKind] = useState('correction'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await genealogyMutation(clanId, 'request', { personId: person.id, kind, message });
      setMessage('');
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="request-form">
      <p className="subtle">
        {link
          ? link.uid === uid
            ? 'Hồ sơ đã liên kết với tài khoản của bạn.'
            : 'Hồ sơ đã được liên kết với một tài khoản thành viên.'
          : 'Hồ sơ này chưa liên kết tài khoản.'}
      </p>
      {!person.archived && (
        <details>
          <summary>Đề nghị sửa hoặc nhận hồ sơ</summary>
          <form className="workspace-form" onSubmit={submit}>
            <label>
              Loại đề nghị
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setSaved(false);
                }}
              >
                <option value="correction">Góp ý chỉnh sửa thông tin</option>
                {!link && person.lifeStatus !== 'deceased' && (
                  <option value="claim">Đây là hồ sơ của tôi</option>
                )}
              </select>
            </label>
            <label>
              Nội dung đề nghị
              <textarea
                rows={3}
                minLength={5}
                maxLength={1000}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {saved && <p role="status">Đã gửi đề nghị để quản trị viên xem xét.</p>}
            <button className="button secondary" disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi đề nghị'}
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
const labels = {
  pending: 'Chờ xem xét',
  approved: 'Đã liên kết',
  rejected: 'Từ chối',
  resolved: 'Đã xử lý',
};
export function RequestsPanel({
  clanId,
  requests,
  admin,
  onChoose,
}: {
  clanId: string;
  requests: PersonRequest[];
  admin: boolean;
  onChoose: (id: string) => void;
}) {
  return (
    <details className="requests-panel">
      <summary>
        {admin ? 'Đề nghị từ thành viên' : 'Đề nghị của bạn'} ·{' '}
        {requests.filter((r) => r.status === 'pending').length} đang chờ
      </summary>
      {!requests.length && <p className="subtle">Chưa có đề nghị.</p>}
      {requests.map((request) => (
        <RequestRow
          key={request.id + '_' + request.version}
          clanId={clanId}
          request={request}
          admin={admin}
          onChoose={onChoose}
        />
      ))}
    </details>
  );
}
function RequestRow({
  clanId,
  request,
  admin,
  onChoose,
}: {
  clanId: string;
  request: PersonRequest;
  admin: boolean;
  onChoose: (id: string) => void;
}) {
  const [resolution, setResolution] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function resolve(decision: 'approve' | 'reject') {
    setBusy(true);
    setError('');
    try {
      await genealogyMutation(clanId, 'resolveRequest', {
        requestId: request.id,
        version: request.version,
        decision,
        resolution,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="request-row">
      <h4>
        {request.personName} · {request.kind === 'claim' ? 'Nhận hồ sơ' : 'Góp ý chỉnh sửa'}
      </h4>
      <p>{request.message}</p>
      <p className="subtle">
        {request.displayName} · {labels[request.status]}
      </p>
      {request.resolution && <p className="subtle">Kết quả: {request.resolution}</p>}
      <button className="text-link" onClick={() => onChoose(request.personId)}>
        Mở hồ sơ liên quan
      </button>
      {admin && request.status === 'pending' && (
        <>
          <label>
            Kết quả xử lý cho {request.personName}
            <input
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              maxLength={500}
            />
          </label>
          {request.kind === 'correction' && (
            <p className="subtle">
              Chỉnh sửa hồ sơ trước, rồi đánh dấu đã xử lý. Góp ý không tự thay đổi dữ liệu.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                void resolve('approve');
              }}
            >
              {request.kind === 'claim' ? 'Duyệt liên kết' : 'Đánh dấu đã xử lý'}
            </button>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                void resolve('reject');
              }}
            >
              Từ chối đề nghị
            </button>
          </div>
        </>
      )}
    </article>
  );
}
