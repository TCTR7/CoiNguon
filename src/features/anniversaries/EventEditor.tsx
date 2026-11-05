import { useState, type FormEvent } from 'react';
import {
  anniversaryCandidate,
  sameDate,
  type AnniversaryRule,
  type MemorialEvent,
} from '../../shared/domain/anniversary';
import type { FamilyDate } from '../../shared/domain/genealogy';

export function EventEditor({
  initial,
  current,
  rule,
  death,
  onReload,
  onClose,
  onSave,
}: {
  initial: MemorialEvent;
  current?: MemorialEvent;
  rule?: AnniversaryRule;
  death: FamilyDate;
  onReload: () => void;
  onClose: () => void;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => ({
    anniversaryDate: initial.anniversaryDate,
    dateConfirmed:
      initial.dateConfirmed &&
      initial.ruleVersion === rule?.version &&
      sameDate(initial.sourceDate, death),
    confirmationNote: initial.confirmationNote,
    scheduledDate: initial.scheduledDate,
    scheduledTime: initial.scheduledTime,
    timeZone: initial.timeZone,
    rsvpDeadlineLocal: initial.rsvpDeadlineLocal,
    address: initial.address,
    invitationText: initial.invitationText,
  }));
  const [busy, setBusy] = useState(false);
  // Freeze rule version with the editing session too; never silently rebase a confirmation.
  const [ruleVersion] = useState(rule?.version);
  const stale = current?.version !== initial.version || ruleVersion !== rule?.version;
  const candidate = rule ? anniversaryCandidate(rule, initial.year) : null;
  const update = (key: keyof typeof draft, value: string | boolean) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({ ...draft, ruleVersion });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="paper-panel event-editor" aria-label="Chỉnh sửa buổi giỗ">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SẮP MỘT NGÀY ĐOÀN VIÊN</p>
          <h3>
            Giỗ {initial.personName} · {initial.year}
          </h3>
        </div>
        <button className="text-link" onClick={onClose} disabled={busy}>
          Đóng chỉnh sửa
        </button>
      </div>
      {stale && (
        <p className="notice" role="alert">
          Có bản mới từ người thân. Bản đang nhập vẫn được giữ.{' '}
          <button className="text-link" onClick={onReload}>
            Tải bản mới
          </button>
        </p>
      )}
      <p>
        {candidate?.explanation || 'Cần thiết lập quy tắc trước.'} Ngày gợi ý:{' '}
        <strong>{candidate?.date || 'Chưa xác định'}</strong>.
      </p>
      <form className="workspace-form" onSubmit={save}>
        <fieldset>
          <legend>Ngày giỗ của năm này</legend>
          <label>
            Ngày giỗ xác nhận (dương lịch)
            <input
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              value={draft.anniversaryDate}
              onChange={(e) => {
                update('anniversaryDate', e.target.value);
                update('dateConfirmed', false);
              }}
            />
          </label>
          <label>
            Lý do / căn cứ xác nhận
            <textarea
              maxLength={500}
              value={draft.confirmationNote}
              onChange={(e) => update('confirmationNote', e.target.value)}
              placeholder="Bắt buộc khi ngày khác gợi ý hoặc dữ liệu gốc còn thiếu"
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={draft.dateConfirmed}
              onChange={(e) => update('dateConfirmed', e.target.checked)}
            />
            Tôi đã đối chiếu và xác nhận ngày giỗ với gia đình
          </label>
        </fieldset>
        <fieldset>
          <legend>Buổi gặp mặt thực tế</legend>
          <p className="subtle">
            Có thể tổ chức vào một ngày khác. Ngày mất trong gia phả được giữ nguyên.
          </p>
          <div className="calendar-filters">
            <label>
              Ngày tổ chức
              <input
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                value={draft.scheduledDate}
                onChange={(e) => update('scheduledDate', e.target.value)}
              />
            </label>
            <label>
              Giờ tổ chức
              <input
                type="time"
                value={draft.scheduledTime}
                onChange={(e) => update('scheduledTime', e.target.value)}
              />
            </label>
          </div>
          <label>
            Múi giờ địa điểm
            <input
              value={draft.timeZone}
              maxLength={80}
              required
              list="event-timezones"
              onChange={(e) => update('timeZone', e.target.value)}
            />
          </label>
          <datalist id="event-timezones">
            <option value="Asia/Ho_Chi_Minh" />
            <option value="Asia/Bangkok" />
            <option value="Australia/Sydney" />
            <option value="America/New_York" />
            <option value="Europe/Paris" />
          </datalist>
          <label>
            Địa chỉ tổ chức
            <textarea
              value={draft.address}
              maxLength={500}
              onChange={(e) => update('address', e.target.value)}
            />
          </label>
          <label>
            Hạn phản hồi (giờ tại địa điểm)
            <input
              type="datetime-local"
              value={draft.rsvpDeadlineLocal}
              onChange={(e) => update('rsvpDeadlineLocal', e.target.value)}
            />
          </label>
          <label>
            Lời mời trong dòng họ
            <textarea
              value={draft.invitationText}
              maxLength={3000}
              onChange={(e) => update('invitationText', e.target.value)}
            />
          </label>
        </fieldset>
        <div className="button-row">
          <button className="button primary" disabled={busy || stale}>
            {busy ? 'Đang lưu…' : 'Lưu buổi giỗ'}
          </button>
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Để sau
          </button>
        </div>
      </form>
    </section>
  );
}
