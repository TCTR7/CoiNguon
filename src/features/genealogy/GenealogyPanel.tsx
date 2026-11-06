import { useEffect, useMemo, useState } from 'react';
import { FamilyTree } from './FamilyTree';
import { PhoneInvites } from '../workspace/PhoneInvites';
import { BookOpen, List, Network, Plus, Search, ShieldCheck } from 'lucide-react';
import { formatFamilyDate, normalizedName, type FamilyPerson } from '../../shared/domain/genealogy';
import { type Membership } from '../workspace/service';
import { genealogyMutation, watchGenealogy, type GenealogyData } from './service';
import { PersonForm } from './PersonForm';
import { QuickAddActions, type RelativeKind } from './QuickAddActions';
import { RelationshipPanel } from './RelationshipPanel';
import { RequestForm, RequestsPanel } from './RequestsPanel';
interface EditSession {
  id: string;
  initial?: FamilyPerson;
  version: number | null;
  key: string;
  presetRelation?: { targetId: string; role: RelativeKind };
}
export default function GenealogyPanel({
  membership,
  onAccessLost,
}: {
  membership: Membership;
  onAccessLost: (id: string) => void;
}) {
  const [data, setData] = useState<GenealogyData | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [archived, setArchived] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<EditSession | null>(null);
  const [view, setView] = useState<'list' | 'tree'>('list');
  const [count, setCount] = useState(20);
  const [confirm, setConfirm] = useState<'archive' | 'unlink' | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = membership.role !== 'member';
  useEffect(
    () =>
      watchGenealogy(
        membership.clanId,
        membership.uid,
        membership.role === 'admin',
        setData,
        (e, collectionName) => {
          setData(null);
          setError(e.message);
          if (
            collectionName !== 'personRequests' &&
            (e as { code?: string }).code === 'permission-denied'
          )
            onAccessLost(membership.clanId);
        },
      ),
    [membership.clanId, membership.uid, membership.role, onAccessLost],
  );
  const people = useMemo(() => data?.people || [], [data]);
  const active = useMemo(() => people.filter((p) => !p.archived), [people]);
  const selected = people.find((p) => p.id === selectedId);
  const results = useMemo(
    () =>
      people
        .filter(
          (p) =>
            p.archived === archived &&
            (!branch || p.branch === branch) &&
            normalizedName(p.name + ' ' + p.aliases).includes(normalizedName(search)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [people, archived, branch, search],
  );
  function edit(person?: FamilyPerson) {
    setError('');
    setEditing({
      id: person?.id || crypto.randomUUID(),
      initial: person,
      version: person?.version ?? null,
      key: crypto.randomUUID(),
    });
  }
  function addRelative(personId: string, kind: RelativeKind) {
    setError('');
    setConfirm(null);
    setEditing({
      id: crypto.randomUUID(),
      version: null,
      key: crypto.randomUUID(),
      presetRelation: { role: kind, targetId: personId },
    });
  }
  async function act(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      await genealogyMutation(membership.clanId, action, payload);
      setConfirm(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="genealogy-panel" aria-label="Gia phả dòng họ">
      <div className="section-heading">
        <div>
          <p className="eyebrow">TỪ MỘT GỐC RỄ, THÊM NHỮNG CÂU CHUYỆN</p>
          <h2>Gia phả dòng họ</h2>
        </div>
        {canEdit && (
          <button className="button primary" onClick={() => edit()}>
            <Plus size={18} />
            Thêm người thân
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {data === null && !error ? (
        <p role="status">Đang tải gia phả…</p>
      ) : (
        data && (
          <>
            {editing && (
              <PersonForm
                key={editing.key}
                clanId={membership.clanId}
                initial={editing.initial}
                personId={editing.id}
                version={editing.version}
                existingPeople={people}
                presetRelation={editing.presetRelation}
                onSaved={(id) => {
                  setEditing(null);
                  setSelectedId(id);
                }}
                onCancel={() => setEditing(null)}
                onReload={() => {
                  const latest = people.find((p) => p.id === editing.id);
                  if (latest) edit(latest);
                }}
              />
            )}
            <div className="genealogy-toolbar">
              <label className="search-field">
                <Search size={20} />
                <span className="sr-only">Tìm hồ sơ trong dòng họ</span>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCount(20);
                  }}
                  placeholder="Tìm người thân, kể cả tên không dấu…"
                />
              </label>
              <label>
                Chi gia đình
                <select
                  value={branch}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    setCount(20);
                  }}
                >
                  <option value="">Tất cả các chi</option>
                  {[...new Set(people.map((p) => p.branch).filter(Boolean))].sort().map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="genealogy-view-bar">
              <div className="segmented" aria-label="Cách xem gia phả dòng họ">
                <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
                  <List size={17} />
                  Danh sách hồ sơ
                </button>
                <button aria-pressed={view === 'tree'} onClick={() => setView('tree')}>
                  <Network size={17} />
                  Sơ đồ nhánh
                </button>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                />
                Xem hồ sơ lưu trữ
              </label>
            </div>
            {view === 'tree' && !archived ? (
              <FamilyTree
                people={active}
                relationships={data.relationships}
                results={results}
                selectedId={selectedId}
                onChoose={setSelectedId}
                onAddRelative={canEdit && !editing ? addRelative : undefined}
              />
            ) : (
              <>
                <p className="subtle result-count">
                  {results.length} hồ sơ {archived ? 'trong lưu trữ' : 'đang hoạt động'}
                </p>
                <div className="person-list genealogy-list">
                  {results.slice(0, count).map((p) => (
                    <button
                      key={p.id}
                      className={
                        'person-list-item ' + (selectedId === p.id ? 'selected-person' : '')
                      }
                      onClick={() => {
                        setSelectedId(p.id);
                        setConfirm(null);
                        setError('');
                      }}
                    >
                      <span className="avatar">{p.name.charAt(0)}</span>
                      <span className="person-list-name">
                        <strong>{p.name}</strong>
                        <small>
                          {p.birth.year ?? 'Chưa rõ năm sinh'}
                          {p.lifeStatus === 'deceased' ? ' · Đã mất' : ''} ·{' '}
                          {p.verified ? 'Đã xác minh' : 'Chưa xác minh'}
                        </small>
                      </span>
                      <BookOpen size={18} />
                    </button>
                  ))}
                </div>
                {results.length > count && (
                  <button className="button secondary" onClick={() => setCount(count + 20)}>
                    Xem thêm hồ sơ
                  </button>
                )}
                {!results.length && (
                  <div className="empty-state">
                    <BookOpen size={32} />
                    <h3>{people.length ? 'Chưa có hồ sơ phù hợp' : 'Bắt đầu từ một người thân'}</h3>
                    <p>
                      {people.length
                        ? 'Thử đổi tên tìm kiếm, bộ lọc chi hoặc chế độ lưu trữ.'
                        : 'Ghi lại một cái tên, rồi nối những nhánh gia đình.'}
                    </p>
                    {!people.length && canEdit && (
                      <button type="button" className="button primary" onClick={() => edit()}>
                        Thêm người thân đầu tiên
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {selected && !editing && (
              <article className="paper-panel family-person-detail">
                <p className="eyebrow">
                  {selected.archived
                    ? 'ĐANG LƯU TRỮ'
                    : selected.verified
                      ? 'THÔNG TIN ĐÃ XÁC MINH'
                      : 'THÔNG TIN CHƯA XÁC MINH'}
                </p>
                <h3>{selected.name}</h3>
                {canEdit && !selected.archived && (
                  <QuickAddActions onAdd={(kind) => addRelative(selected.id, kind)} />
                )}
                {selected.aliases && <p className="subtle">Tên khác: {selected.aliases}</p>}
                <dl className="facts">
                  <div>
                    <dt>Tình trạng</dt>
                    <dd>
                      {selected.lifeStatus === 'living'
                        ? 'Còn sống'
                        : selected.lifeStatus === 'deceased'
                          ? 'Đã mất'
                          : 'Chưa rõ'}
                    </dd>
                  </div>
                  <div>
                    <dt>Ngày sinh</dt>
                    <dd>{formatFamilyDate(selected.birth)}</dd>
                  </div>
                  <div>
                    <dt>Ngày mất</dt>
                    <dd>{formatFamilyDate(selected.death)}</dd>
                  </div>
                  <div>
                    <dt>Chi gia đình</dt>
                    <dd>{selected.branch || 'Chưa ghi'}</dd>
                  </div>
                </dl>
                {selected.biography && <p className="biography-text">{selected.biography}</p>}
                <p className="subtle">
                  Nguồn: {selected.source || 'Chưa ghi nguồn'} · Phiên bản {selected.version}
                </p>
                {canEdit && (
                  <div className="button-row">
                    {!selected.archived && (
                      <button className="button secondary" onClick={() => edit(selected)}>
                        Sửa hồ sơ
                      </button>
                    )}
                    <button className="text-link" onClick={() => setConfirm('archive')}>
                      {selected.archived ? 'Khôi phục hồ sơ' : 'Đưa hồ sơ vào lưu trữ'}
                    </button>
                  </div>
                )}
                {confirm === 'archive' && (
                  <div className="notice">
                    <p>
                      {selected.archived
                        ? 'Khôi phục hồ sơ này về danh sách đang hoạt động?'
                        : 'Hồ sơ sẽ được đưa vào lưu trữ và có thể khôi phục. Không xóa hồ sơ người thân khác.'}
                    </p>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => {
                        void act(selected.archived ? 'restorePerson' : 'archivePerson', {
                          personId: selected.id,
                          version: selected.version,
                        });
                      }}
                    >
                      Xác nhận {selected.archived ? 'khôi phục' : 'lưu trữ'} hồ sơ
                    </button>
                    <button className="text-link" onClick={() => setConfirm(null)}>
                      Hủy
                    </button>
                  </div>
                )}
                {membership.role === 'admin' && (
                  <PhoneInvites
                    key={selected.id + '_invite'}
                    clanId={membership.clanId}
                    personId={selected.id}
                    canInvite={
                      selected.lifeStatus === 'living' &&
                      !selected.archived &&
                      !data.links.some((l) => l.personId === selected.id)
                    }
                  />
                )}
                <RelationshipPanel
                  key={selected.id}
                  clanId={membership.clanId}
                  person={selected}
                  people={people}
                  relations={data.relationships}
                  canEdit={canEdit}
                  onError={setError}
                />
                <RequestForm
                  key={
                    selected.id +
                    '_' +
                    (data.links.find((l) => l.personId === selected.id)?.uid || 'none')
                  }
                  clanId={membership.clanId}
                  person={selected}
                  uid={membership.uid}
                  link={data.links.find((l) => l.personId === selected.id)}
                />
                {membership.role === 'admin' &&
                  data.links.some((l) => l.personId === selected.id) && (
                    <>
                      <button className="text-link" onClick={() => setConfirm('unlink')}>
                        Gỡ liên kết tài khoản
                      </button>
                      {confirm === 'unlink' && (
                        <div className="notice">
                          <p>Gỡ liên kết tài khoản khỏi hồ sơ? Tư cách thành viên vẫn được giữ.</p>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => {
                              void act('unlinkPerson', { personId: selected.id });
                            }}
                          >
                            Xác nhận gỡ liên kết
                          </button>
                          <button className="text-link" onClick={() => setConfirm(null)}>
                            Hủy
                          </button>
                        </div>
                      )}
                    </>
                  )}
              </article>
            )}
            <RequestsPanel
              clanId={membership.clanId}
              requests={data.requests}
              admin={membership.role === 'admin'}
              onChoose={setSelectedId}
            />
            {!canEdit && (
              <p className="subtle icon-text">
                <ShieldCheck size={17} />
                Bạn có thể xem, góp ý và đề nghị nhận hồ sơ. Liên kết tài khoản không tự cấp quyền
                chỉnh sửa.
              </p>
            )}
          </>
        )
      )}
    </section>
  );
}
