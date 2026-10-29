import { useState, type FormEvent } from 'react';
import { parseAttendance, type AttendanceResponse } from '../../shared/domain/attendance';
export function ResponseForm({
  initial,
  stale,
  onReset,
  onSubmit,
  manager = false,
  late = false,
  label,
}: {
  initial: AttendanceResponse;
  stale: boolean;
  onReset: () => void;
  onSubmit: (response: AttendanceResponse, reason: string) => Promise<void>;
  manager?: boolean;
  late?: boolean;
  label: string;
}) {
  const [status, setStatus] = useState(initial.status === 'pending' ? '' : initial.status);
  const [adults, setAdults] = useState(String(initial.adults)),
    [children, setChildren] = useState(String(initial.children));
  const [note, setNote] = useState(initial.note),
    [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const value = parseAttendance({
        status,
        adults: status === 'declined' ? 0 : Number(adults),
        children: status === 'declined' ? 0 : Number(children),
        note,
      });
      setBusy(true);
      await onSubmit(value, reason);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="workspace-form household-response"
      onSubmit={submit}
      aria-label={manager ? 'Ghi phản hồi thay nhóm khách' : 'Xác nhận tham dự của gia đình'}
    >
      <h3>{manager ? 'Ghi phản hồi thay nhóm khách' : 'Gia đình mình có tham dự không?'}</h3>
      <p>
        <strong>{label}</strong>
      </p>
      {stale && (
        <div className="notice" role="alert">
          <p>
            Thiệp hoặc phản hồi đã thay đổi. Nội dung đang nhập vẫn được giữ. Hãy xem bản mới trước
            khi tiếp tục.
          </p>
          <button type="button" className="button secondary" disabled={busy} onClick={onReset}>
            Bỏ bản đang nhập và dùng phản hồi mới
          </button>
        </div>
      )}
      <fieldset className="attendance-choices">
        <legend>Lựa chọn của nhóm</legend>
        <label>
          <input
            type="radio"
            name="attendance"
            value="attending"
            checked={status === 'attending'}
            onChange={() => setStatus('attending')}
            required
          />{' '}
          Có tham dự
        </label>
        <label>
          <input
            type="radio"
            name="attendance"
            value="declined"
            checked={status === 'declined'}
            onChange={() => setStatus('declined')}
            required
          />{' '}
          Không tham dự
        </label>
      </fieldset>
      <div className="attendance-counts">
        <label>
          Số người lớn
          <input
            type="number"
            min="0"
            max="500"
            step="1"
            required
            disabled={status !== 'attending'}
            value={status === 'declined' ? '0' : adults}
            onChange={(e) => setAdults(e.target.value)}
          />
        </label>
        <label>
          Số trẻ em
          <input
            type="number"
            min="0"
            max="500"
            step="1"
            required
            disabled={status !== 'attending'}
            value={status === 'declined' ? '0' : children}
            onChange={(e) => setChildren(e.target.value)}
          />
        </label>
      </div>
      <label>
        Ghi chú cho người tổ chức
        <textarea
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Gia đình đến muộn một chút."
        />
      </label>
      {manager ? (
        <label>
          Lý do cập nhật{late ? ' (bắt buộc vì đã quá hạn)' : ''}
          <textarea
            value={reason}
            required={late}
            minLength={late ? 5 : undefined}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      ) : (
        <label className="response-consent">
          <input type="checkbox" required /> Tôi xác nhận thay cho nhóm này; đây là tổng số người
          của cả nhóm.
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy || stale}>
        {busy ? 'Đang lưu…' : manager ? 'Lưu phản hồi thay' : 'Gửi xác nhận tham dự'}
      </button>
    </form>
  );
}
