import { useEffect, useState } from 'react';
import { requestLabels, watchJoinRequests, type JoinRequest } from './service';
export function MyJoinRequests({ uid }: { uid: string }) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [error, setError] = useState('');
  useEffect(
    () =>
      watchJoinRequests('uid', uid, setRequests, (e) => {
        setRequests([]);
        setError(e.message);
      }),
    [uid],
  );
  const visible = requests.filter((r) => r.status === 'pending' || r.status === 'rejected');
  if (!visible.length && !error) return null;
  return (
    <section className="paper-panel" aria-label="Yêu cầu tham gia đã gửi">
      <h2>Yêu cầu tham gia đã gửi</h2>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {visible.map((r) => (
        <p key={r.id}>
          <strong>{r.clanName}</strong> · {requestLabels[r.status]}
        </p>
      ))}
      <p className="subtle">
        Gia phả sẽ xuất hiện trong danh sách của bạn sau khi quản trị viên duyệt.
      </p>
    </section>
  );
}
