import { useEffect, useState } from 'react';
import { BookOpen, List, Network, Plus, Search, ShieldCheck } from 'lucide-react';
import {
  descendantLayers,
  formatFamilyDate,
  normalizedName,
  type FamilyPerson,
} from '../../shared/domain/genealogy';
import { type Membership } from '../workspace/service';
import { genealogyMutation, watchGenealogy, type GenealogyData } from './service';
import { PersonForm } from './PersonForm';
import { RelationshipPanel } from './RelationshipPanel';
import { RequestForm, RequestsPanel } from './RequestsPanel';
interface EditSession {
  id: string;
  initial?: FamilyPerson;
  version: number | null;
  key: string;
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
  const people = data?.people || [];
  const active = people.filter((p) => !p.archived);
  const selected = people.find((p) => p.id === selectedId);
  const results = people
    .filter(
      (p) =>
        p.archived === archived &&
        (!branch || p.branch === branch) &&
        normalizedName(p.name + ' ' + p.aliases).includes(normalizedName(search)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  function edit(person?: FamilyPerson) {
    setError('');
    setEditing({
      id: person?.id || crypto.randomUUID(),
      initial: person,
      version: person?.version ?? null,
      key: crypto.randomUUID(),
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
      <p className="subtle">
        Hồ sơ được lưu riêng trong dòng họ đang chọn. Người thân không cần có tài khoản để xuất hiện
        trong gia phả.
      </p>
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
              <BranchTree
                people={active}
                relationships={data.relationships}
                root={selected && !selected.archived ? selected.id : active[0]?.id || ''}
                onChoose={setSelectedId}
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
                  </div>
                )}
              </>
            )}
            {editing && (
              <PersonForm
                key={editing.key}
                clanId={membership.clanId}
                initial={editing.initial}
                personId={editing.id}
                version={editing.version}
                existingPeople={people}
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
function BranchTree({
  people,
  relationships,
  root,
  onChoose,
}: {
  people: FamilyPerson[];
  relationships: GenealogyData['relationships'];
  root: string;
  onChoose: (id: string) => void;
}) {
  if (!root) return <p className="notice">Thêm hồ sơ để bắt đầu xem sơ đồ nhánh.</p>;
  const levels = descendantLayers(root, relationships);
  const grouped = new Map<string, FamilyPerson[]>();
  for (const person of people) {
    const values = levels.get(person.id);
    if (!values) continue;
    const label =
      values.size === 1 ? 'Thế hệ tương đối ' + String([...values][0] + 1) : 'Chưa xác định thế hệ';
    grouped.set(label, [...(grouped.get(label) || []), person]);
  }
  return (
    <div className="live-tree">
      <label>
        Gốc nhánh đang xem
        <select value={root} onChange={(e) => onChoose(e.target.value)}>
          {people.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <p className="subtle">
        Chỉ tính thế hệ từ quan hệ cha/mẹ — con đã xác minh. Quan hệ vợ/chồng, con nuôi và chưa xác
        minh được ghi rõ trong hồ sơ. Đây là thế hệ tương đối từ gốc đang chọn.
      </p>
      {[...grouped]
        .sort(([a], [b]) => a.localeCompare(b, 'vi', { numeric: true }))
        .map(([label, members]) => (
          <section className="live-tree-level" key={label}>
            <h4>{label}</h4>
            <div>
              {members.slice(0, 100).map((p) => (
                <button className="tree-person" key={p.id} onClick={() => onChoose(p.id)}>
                  <span className="avatar">{p.name.charAt(0)}</span>
                  <strong>{p.name}</strong>
                  <small>{p.birth.year ?? 'Chưa rõ năm sinh'}</small>
                </button>
              ))}
            </div>
            {members.length > 100 && (
              <p className="subtle">Đang hiện 100 hồ sơ đầu; dùng tìm kiếm để xem thêm.</p>
            )}
          </section>
        ))}
      <p className="subtle">
        {people.length - levels.size} hồ sơ ngoài nhánh hoặc chưa đủ quan hệ xác minh. Dùng danh
        sách để tra cứu đầy đủ.
      </p>
    </div>
  );
}
