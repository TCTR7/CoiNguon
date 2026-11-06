import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  blankDate,
  blankPerson,
  formatFamilyDate,
  normalizedName,
  validatePerson,
  type FamilyDate,
  type FamilyPerson,
  type PersonFields,
} from '../../shared/domain/genealogy';
import { genealogyMutation, GenealogyError } from './service';
import type { RelativeKind } from './QuickAddActions';
export function PersonForm({
  clanId,
  initial,
  personId,
  version,
  existingPeople,
  relative,
  presetRelation,
  onSaved,
  onCancel,
  onReload,
}: {
  clanId: string;
  initial?: FamilyPerson;
  personId: string;
  version: number | null;
  existingPeople: FamilyPerson[];
  relative?: { kind: RelativeKind; personId: string };
  presetRelation?: { targetId: string; role: RelativeKind };
  onSaved: (id: string) => void;
  onCancel: () => void;
  onReload?: () => void;
}) {
  const editorRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [relativeKind, setRelativeKind] = useState<RelativeKind>(
    presetRelation?.role ?? relative?.kind ?? 'child',
  );
  const [targetId, setTargetId] = useState(presetRelation?.targetId ?? relative?.personId ?? '');
  useEffect(() => {
    nameRef.current?.focus({ preventScroll: true });
    editorRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, []);
  const [fields, setFields] = useState<PersonFields>(() => {
    const p = initial || blankPerson();
    return {
      name: p.name,
      aliases: p.aliases,
      lifeStatus: p.lifeStatus,
      birth: p.birth,
      death: p.death,
      branch: p.branch,
      biography: p.biography,
      source: p.source,
      verified: p.verified,
    };
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [conflict, setConflict] = useState(false);
  function change<K extends keyof PersonFields>(key: K, value: PersonFields[K]) {
    setFields((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setConflict(false);
    setBusy(true);
    try {
      const person = validatePerson(fields);
      const target = existingPeople.find((p) => p.id === targetId && !p.archived);
      if (version === null && targetId && !target)
        throw new Error('Chọn người thân đang hoạt động để liên kết.');
      const result = await genealogyMutation(
        clanId,
        version === null ? 'createPerson' : 'updatePerson',
        {
          personId,
          version,
          person,
          ...(version === null && target
            ? {
                targetVersion: target.version,
                ...(relative && !presetRelation
                  ? {
                      relationship: {
                        from: relativeKind === 'child' ? target.id : personId,
                        to: relativeKind === 'child' ? personId : target.id,
                        kind: relativeKind === 'spouse' ? 'spouse' : 'parent',
                        parentType: 'biological',
                        status: 'current',
                        source: '',
                        verified: false,
                      },
                    }
                  : { initialRelation: { targetId: target.id, role: relativeKind } }),
              }
            : {}),
        },
      );
      onSaved(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được hồ sơ.');
      setConflict(e instanceof GenealogyError && e.status === 409);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      ref={editorRef}
      style={{ scrollMarginTop: '6rem' }}
      className="paper-panel person-editor"
      aria-label={initial ? 'Sửa hồ sơ' : 'Thêm hồ sơ'}
    >
      <h3>{initial ? 'Sửa hồ sơ người thân' : 'Thêm một người thân'}</h3>
      <p className="subtle">
        Chưa rõ ngày, tháng hoặc năm thì để trống. Không cần tạo tài khoản cho người này.
      </p>
      {existingPeople.some(
        (p) => p.id !== personId && normalizedName(p.name) === normalizedName(fields.name),
      ) && (
        <p className="notice">
          Đã có hồ sơ cùng tên. Hãy đối chiếu năm sinh và quan hệ; hệ thống không tự gộp.
        </p>
      )}
      <form onSubmit={submit} noValidate className="workspace-form">
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-two-columns">
            <label>
              Tên hiển thị
              <input
                ref={nameRef}
                value={fields.name}
                onChange={(e) => change('name', e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <label>
              Tình trạng
              <select
                value={fields.lifeStatus}
                onChange={(e) => {
                  const lifeStatus = e.target.value as PersonFields['lifeStatus'];
                  setFields((previous) => ({
                    ...previous,
                    lifeStatus,
                    death: lifeStatus === 'deceased' ? previous.death : blankDate(),
                  }));
                }}
              >
                <option value="unknown">Chưa rõ</option>
                <option value="living">Còn sống</option>
                <option value="deceased">Đã mất</option>
              </select>
            </label>
          </div>
          {version === null && existingPeople.some((p) => !p.archived && p.id !== personId) && (
            <div data-testid="quick-add-context">
              <h4>Liên kết quan hệ ngay (không bắt buộc)</h4>
              <div className="form-two-columns">
                <label>
                  Mối quan hệ
                  <select
                    aria-label="Mối quan hệ"
                    value={relativeKind}
                    onChange={(e) => setRelativeKind(e.target.value as RelativeKind)}
                  >
                    <option value="parent">Là Cha / mẹ của</option>
                    <option value="spouse">Là Vợ / chồng của</option>
                    <option value="child">Là Con của</option>
                  </select>
                </label>
                <label>
                  Người liên kết
                  <select
                    aria-label="Người liên kết"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                  >
                    <option value="">Chọn người thân</option>
                    {existingPeople
                      .filter((p) => !p.archived && p.id !== personId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </div>
          )}
          <DateFields
            title="Ngày sinh"
            value={fields.birth}
            onChange={(value) => change('birth', value)}
          />
          <small className="subtle">Ngày sinh không bắt buộc.</small>
          {fields.lifeStatus === 'deceased' && (
            <DateFields
              title="Ngày mất"
              value={fields.death}
              onChange={(value) => change('death', value)}
            />
          )}
          <details open={Boolean(initial)} data-testid="person-details">
            <summary>Thông tin bổ sung (chi nhánh, tên gọi khác, tiểu sử — tùy chọn)</summary>
            <div className="workspace-form">
              <label>
                Tên khác / tên thường gọi
                <input
                  value={fields.aliases}
                  onChange={(e) => change('aliases', e.target.value)}
                  maxLength={200}
                />
              </label>
              <label>
                Chi / nhánh gia đình
                <input
                  value={fields.branch}
                  onChange={(e) => change('branch', e.target.value)}
                  maxLength={80}
                />
              </label>
              <label>
                Tiểu sử
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={fields.biography}
                  onChange={(e) => change('biography', e.target.value)}
                />
              </label>
              <label>
                Nguồn thông tin
                <textarea
                  rows={2}
                  maxLength={500}
                  value={fields.source}
                  onChange={(e) => change('source', e.target.value)}
                  placeholder="Ví dụ: Gia phả viết tay, lời kể của người thân"
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fields.verified}
                  onChange={(e) => change('verified', e.target.checked)}
                />
                Gia đình đã xác minh thông tin (cần ghi nguồn)
              </label>
            </div>
          </details>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {conflict && initial && onReload && (
          <button type="button" className="button secondary" onClick={onReload} disabled={busy}>
            Tải bản mới — bỏ thay đổi đang nhập
          </button>
        )}
        <div className="button-row">
          <button className="button primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </button>
          <button type="button" className="button secondary" onClick={onCancel} disabled={busy}>
            Hủy chỉnh sửa
          </button>
        </div>
      </form>
    </section>
  );
}
function DateFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: FamilyDate;
  onChange: (date: FamilyDate) => void;
}) {
  function number(key: 'day' | 'month' | 'year', text: string) {
    onChange({ ...value, [key]: text.trim() === '' ? null : Number(text) });
  }
  return (
    <fieldset className="date-fields">
      <legend>{title}</legend>
      <div className="date-inputs">
        <label>
          Lịch {title.toLowerCase()}
          <select
            value={value.calendar}
            onChange={(e) =>
              onChange({
                ...value,
                calendar: e.target.value as 'solar' | 'lunar',
                leapMonth: false,
              })
            }
          >
            <option value="solar">Dương lịch</option>
            <option value="lunar">Âm lịch</option>
          </select>
        </label>
        {(['day', 'month', 'year'] as const).map((key, index) => (
          <label key={key}>
            {index === 0 ? title : title.replace('Ngày', index === 1 ? 'Tháng' : 'Năm')}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={key === 'year' ? 9999 : key === 'month' ? 12 : 31}
              value={value[key] ?? ''}
              onChange={(e) => number(key, e.target.value)}
              placeholder="Chưa rõ"
            />
          </label>
        ))}
      </div>
      {value.calendar === 'lunar' && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={value.leapMonth}
            onChange={(e) => onChange({ ...value, leapMonth: e.target.checked })}
          />
          Tháng nhuận của {title.toLowerCase()}
        </label>
      )}
      <p className="subtle">Đang ghi: {formatFamilyDate(value)}</p>
    </fieldset>
  );
}
