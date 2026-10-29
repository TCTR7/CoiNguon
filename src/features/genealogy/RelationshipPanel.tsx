import { useState, type FormEvent } from 'react';
import type { FamilyPerson, FamilyRelationship } from '../../shared/domain/genealogy';
import { genealogyMutation } from './service';
export function RelationshipPanel({
  clanId,
  person,
  people,
  relations,
  canEdit,
  onError,
}: {
  clanId: string;
  person: FamilyPerson;
  people: FamilyPerson[];
  relations: FamilyRelationship[];
  canEdit: boolean;
  onError: (message: string) => void;
}) {
  const related = relations.filter((r) => r.from === person.id || r.to === person.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function archive(r: FamilyRelationship) {
    setBusy(true);
    try {
      await genealogyMutation(clanId, r.archived ? 'restoreRelation' : 'archiveRelation', {
        relationId: r.id,
        version: r.version,
      });
      setConfirm(null);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="relationships-panel">
      <h3>Quan hệ gia đình</h3>
      {!related.length && (
        <p className="subtle">Chưa có quan hệ được ghi. Không suy đoán quan hệ từ họ tên.</p>
      )}
      <ul className="relationship-list">
        {related.map((r) => {
          const other = people.find((p) => p.id === (r.from === person.id ? r.to : r.from));
          const label =
            r.kind === 'spouse'
              ? r.status === 'former'
                ? 'Vợ/chồng trước đây'
                : 'Vợ/chồng'
              : (r.from === person.id ? 'Con' : 'Cha/mẹ') +
                (r.parentType === 'adoptive' ? ' (nuôi)' : ' (ruột)');
          return (
            <li key={r.id}>
              <div>
                <strong>{other?.name || 'Hồ sơ chưa tải'}</strong>
                <span>
                  {label} · {r.archived ? 'Đã gỡ' : r.verified ? 'Đã xác minh' : 'Chưa xác minh'}
                </span>
                {r.source && <small>Nguồn: {r.source}</small>}
              </div>
              {canEdit && (
                <div className="button-row">
                  <button className="text-link" disabled={busy} onClick={() => setConfirm(r.id)}>
                    {r.archived ? 'Khôi phục quan hệ' : 'Gỡ quan hệ'}
                    <span className="sr-only"> với {other?.name}</span>
                  </button>
                  {!r.archived && (
                    <button
                      className="text-link"
                      onClick={() => setEditing(editing === r.id ? null : r.id)}
                    >
                      Sửa quan hệ<span className="sr-only"> với {other?.name}</span>
                    </button>
                  )}
                </div>
              )}
              {confirm === r.id && (
                <div className="notice">
                  <p>
                    {r.archived
                      ? 'Khôi phục quan hệ này? Hệ thống sẽ kiểm tra lại vòng lặp tổ tiên.'
                      : 'Gỡ quan hệ này? Hồ sơ của cả hai người vẫn được giữ nguyên.'}
                  </p>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      void archive(r);
                    }}
                  >
                    Xác nhận {r.archived ? 'khôi phục' : 'gỡ'} quan hệ
                  </button>
                  <button className="text-link" onClick={() => setConfirm(null)}>
                    Hủy
                  </button>
                </div>
              )}
              {editing === r.id && (
                <RelationshipForm
                  clanId={clanId}
                  person={person}
                  people={people}
                  relations={relations}
                  existing={r}
                  onSaved={() => setEditing(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && !person.archived && (
        <details>
          <summary>Thêm quan hệ gia đình</summary>
          <RelationshipForm
            clanId={clanId}
            person={person}
            people={people}
            relations={relations}
            onSaved={() => undefined}
          />
        </details>
      )}
    </section>
  );
}
function RelationshipForm({
  clanId,
  person,
  people,
  relations,
  existing,
  onSaved,
}: {
  clanId: string;
  person: FamilyPerson;
  people: FamilyPerson[];
  relations: FamilyRelationship[];
  existing?: FamilyRelationship;
  onSaved: () => void;
}) {
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState('parent');
  const [parentType, setParentType] = useState(existing?.parentType || 'biological');
  const [status, setStatus] = useState(existing?.status || 'current');
  const [source, setSource] = useState(existing?.source || '');
  const [verified, setVerified] = useState(existing?.verified || false);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const kind = existing?.kind || (direction === 'spouse' ? 'spouse' : 'parent');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!existing && !target) throw new Error('Chọn người thân cần liên kết.');
      const relation = existing
        ? { ...existing, parentType, status, source, verified }
        : {
            from: direction === 'child' ? target : person.id,
            to: direction === 'child' ? person.id : target,
            kind,
            parentType,
            status,
            source,
            verified,
          };
      if (
        !existing &&
        relations.some(
          (r) =>
            r.kind === relation.kind &&
            ((r.from === relation.from && r.to === relation.to) ||
              (r.kind === 'spouse' && r.from === relation.to && r.to === relation.from)),
        )
      )
        throw new Error('Quan hệ đã được ghi. Hãy sửa hoặc khôi phục quan hệ hiện có.');
      await genealogyMutation(clanId, 'saveRelation', {
        relationship: relation,
        version: existing?.version ?? null,
      });
      if (!existing) {
        setTarget('');
        setSource('');
        setVerified(false);
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="workspace-form relationship-form" onSubmit={submit}>
      {!existing && (
        <>
          <label>
            Người được liên kết
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Chọn người thân</option>
              {people
                .filter((p) => !p.archived && p.id !== person.id)
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Mối quan hệ với {person.name}
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="parent">Người đang xem là cha/mẹ của người được chọn</option>
              <option value="child">Người đang xem là con của người được chọn</option>
              <option value="spouse">Hai người là vợ/chồng</option>
            </select>
          </label>
        </>
      )}
      {kind === 'parent' ? (
        <label>
          Loại quan hệ cha/mẹ — con
          <select
            value={parentType}
            onChange={(e) => setParentType(e.target.value as 'biological' | 'adoptive')}
          >
            <option value="biological">Cha/mẹ ruột</option>
            <option value="adoptive">Cha/mẹ nuôi</option>
          </select>
        </label>
      ) : (
        <label>
          Tình trạng vợ/chồng
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'current' | 'former')}
          >
            <option value="current">Hiện tại</option>
            <option value="former">Trước đây</option>
          </select>
        </label>
      )}
      <label>
        Nguồn quan hệ
        <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={500} />
      </label>
      <label className="checkbox-label">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        Quan hệ đã được gia đình xác minh
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button secondary" disabled={busy}>
        {busy ? 'Đang lưu…' : existing ? 'Lưu quan hệ' : 'Ghi quan hệ'}
      </button>
    </form>
  );
}
