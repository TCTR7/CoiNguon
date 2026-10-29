import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../shared/firebase/client';
import {
  snapshots,
  deleteSnapshot,
  invalidateSnapshot,
  watchPrivateChanges,
} from '../../shared/offline/store';
import { useConnectivity } from '../../shared/offline/useOnline';
import { formatFamilyDate, normalizedName } from '../../shared/domain/genealogy';
import { eventStatusLabels } from '../../shared/domain/anniversary';
import type { OfflineSnapshot } from '../../shared/domain/portable';
import { accountRequest } from './service';
import { InvitationApiError } from '../invitations/api';
import { logout, watchMine } from '../workspace/service';
import './preparedness.css';
export default function OfflinePage() {
  const [session, setSession] = useState<{ ready: boolean; user: User | null }>({
    ready: false,
    user: null,
  });
  useEffect(() => onAuthStateChanged(auth, (user) => setSession({ ready: true, user })), []);
  return (
    <section className="workspace">
      <h1>Dữ liệu đã tải xuống</h1>
      {!session.ready ? (
        <p role="status">Đang kiểm tra tài khoản…</p>
      ) : session.user ? (
        <OfflineViewer key={session.user.uid} uid={session.user.uid} />
      ) : (
        <p>
          Cần tài khoản đã đăng nhập trên thiết bị tin cậy. <Link to="/dong-ho">Về đăng nhập</Link>
        </p>
      )}
    </section>
  );
}
const key = (s: OfflineSnapshot) => s.clanId + ':' + s.membershipEpoch + ':' + s.downloadedAtMs;
export function OfflineViewer({ uid }: { uid: string }) {
  const connection = useConnectivity();
  const [rows, setRows] = useState<OfflineSnapshot[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [verified, setVerified] = useState<{ generation: number; keys: Set<string> }>({
    generation: -1,
    keys: new Set(),
  });
  const [chosen, setChosen] = useState('');
  const load = useCallback(async () => {
    try {
      setRows(await snapshots(uid));
      setError('');
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [uid]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const unsub = watchPrivateChanges(() => void load());
    return () => {
      window.clearTimeout(initial);
      unsub();
    };
  }, [load]);
  useEffect(
    () =>
      watchMine(
        uid,
        () => undefined,
        () => undefined,
      ),
    [uid],
  );
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      if (!connection.online) return;
      void (async () => {
        const allowed = new Set<string>();
        for (const row of rows) {
          try {
            const result = await accountRequest<{ membershipEpoch: string }>(
              'data',
              row.clanId,
              'validate',
            );
            if (result.membershipEpoch === row.membershipEpoch) allowed.add(key(row));
            else {
              if (alive) setRows((current) => current.filter((s) => s.clanId !== row.clanId));
              await invalidateSnapshot(uid, row.clanId);
            }
          } catch (e) {
            if (e instanceof InvitationApiError && e.status === 403) {
              if (alive) setRows((current) => current.filter((s) => s.clanId !== row.clanId));
              await invalidateSnapshot(uid, row.clanId);
            } else if (alive)
              setError(
                'Chưa xác minh được quyền khi có mạng. Dữ liệu tải xuống đang được ẩn; hãy thử tải lại.',
              );
          }
        }
        if (alive) setVerified({ generation: connection.generation, keys: allowed });
      })();
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [uid, rows, connection.online, connection.generation]);
  const visible = connection.online
    ? rows.filter((s) => verified.generation === connection.generation && verified.keys.has(key(s)))
    : rows;
  const selected = visible.find((s) => s.clanId === chosen) || visible[0];
  return (
    <section className="offline-reader" aria-label="Bản tải xuống chỉ đọc">
      <div className="notice">
        <strong>
          {connection.online ? 'Bản tải xuống — chỉ đọc' : 'Đang ngoại tuyến — chỉ đọc'}
        </strong>
        <p>
          Không thể sửa, phản hồi thiệp hay chuyển quyền trong chế độ này. Thiết bị mất mạng không
          thể nhận việc thu hồi quyền ngay lập tức.
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Đang đọc dữ liệu trên thiết bị…</p>
      ) : !selected ? (
        <p role="status">
          {connection.online && rows.length
            ? 'Đang kiểm tra quyền truy cập trước khi mở bản tải xuống…'
            : 'Chưa có dữ liệu tải xuống cho tài khoản này. Hãy kết nối mạng, mở gia phả và chọn tải trên thiết bị tin cậy.'}
        </p>
      ) : (
        <>
          <label>
            Gia phả đã tải
            <select value={selected.clanId} onChange={(e) => setChosen(e.target.value)}>
              {visible.map((s) => (
                <option value={s.clanId} key={s.clanId}>
                  {s.clanName}
                </option>
              ))}
            </select>
          </label>
          <p>
            Đồng bộ lần cuối: {new Date(selected.downloadedAtMs).toLocaleString('vi-VN')} · Phạm vi:
            hồ sơ chữ, quan hệ và lịch. Không gồm ảnh, link khách hay quyền quản trị.
          </p>
          <OfflineContent key={key(selected)} data={selected} />
          <button
            className="button secondary"
            onClick={() =>
              void deleteSnapshot(uid, selected.clanId)
                .then(load)
                .catch((e) => setError(e.message))
            }
          >
            Xóa bản tải xuống này
          </button>
        </>
      )}
      <div className="button-row">
        <button className="button secondary" onClick={() => void load()}>
          Tải lại danh sách đã lưu
        </button>
        <button
          className="text-link"
          onClick={() => void logout().catch((e) => setError(e.message))}
        >
          Đăng xuất và xóa dữ liệu đã tải
        </button>
        <Link className="button secondary" to="/dong-ho">
          Về dòng họ của tôi
        </Link>
      </div>
    </section>
  );
}
function OfflineContent({ data }: { data: OfflineSnapshot }) {
  const [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(''),
    [archived, setArchived] = useState(false);
  const matches = useMemo(
    () =>
      data.people.filter(
        (p) =>
          (archived || !p.archived) &&
          normalizedName(p.name + ' ' + p.aliases).includes(normalizedName(query)),
      ),
    [data.people, query, archived],
  );
  const person = data.people.find((p) => p.id === selected);
  const names = new Map(data.people.map((p) => [p.id, p.name]));
  return (
    <div>
      <h2>{data.clanName}</h2>
      <h3>Hồ sơ đã tải · {data.people.length}</h3>
      <label>
        Tìm người trong bản tải xuống
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Tên người thân, có hoặc không dấu"
        />
      </label>
      <label className="preparedness-check">
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => {
            setArchived(e.target.checked);
            setPage(1);
          }}
        />{' '}
        Xem cả hồ sơ lưu trữ
      </label>
      <p role="status">
        {matches.length} kết quả · {Math.min(page * 20, matches.length)} đang hiển thị.
      </p>
      <div className="offline-people">
        {matches.slice(0, page * 20).map((p) => (
          <button className="offline-person" key={p.id} onClick={() => setSelected(p.id)}>
            <strong>{p.name}</strong>
            <span>
              {formatFamilyDate(p.birth)}
              {p.archived ? ' · Đã lưu trữ' : ''}
            </span>
          </button>
        ))}
      </div>
      {matches.length > page * 20 && (
        <button className="button secondary" onClick={() => setPage((n) => n + 1)}>
          Xem thêm 20 hồ sơ
        </button>
      )}
      {person && (
        <article className="paper-panel" aria-label="Hồ sơ ngoại tuyến">
          <h3>{person.name}</h3>
          <p>Ngày sinh: {formatFamilyDate(person.birth)}</p>
          <p>Ngày mất: {formatFamilyDate(person.death)}</p>
          <p>
            {person.verified ? 'Đã xác minh' : 'Chưa xác minh'} · Nguồn:{' '}
            {person.source || 'Chưa ghi'}
          </p>
          <p className="offline-biography">{person.biography}</p>
          <h4>Quan hệ đã ghi</h4>
          <ul>
            {data.relationships
              .filter((r) => !r.archived && (r.from === person.id || r.to === person.id))
              .map((r) => (
                <li key={r.id}>
                  {r.kind === 'spouse' ? 'Vợ/chồng' : r.from === person.id ? 'Con' : 'Cha/mẹ'}:{' '}
                  {names.get(r.from === person.id ? r.to : r.from)} ·{' '}
                  {r.kind === 'parent'
                    ? r.parentType === 'adoptive'
                      ? 'Quan hệ nuôi'
                      : 'Quan hệ ruột'
                    : r.status === 'former'
                      ? 'Trước đây'
                      : 'Hiện tại'}
                </li>
              ))}
          </ul>
        </article>
      )}
      <h3>Lịch đã tải</h3>
      {!data.events.length ? (
        <p>Chưa có sự kiện trong lần tải này.</p>
      ) : (
        <div className="offline-calendar">
          {[...data.events]
            .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
            .map((e) => (
              <article key={e.id}>
                <h4>Giỗ {e.personName}</h4>
                <p>
                  {eventStatusLabels[e.status]} · {e.scheduledDate || 'Chưa có ngày'} ·{' '}
                  {e.scheduledTime || 'Chưa có giờ'} · {e.timeZone}
                </p>
                <p>
                  {e.address || 'Chưa có địa điểm'} ·{' '}
                  {e.dateConfirmed ? 'Ngày đã xác nhận tại lúc tải' : 'Cần xác nhận ngày'}
                </p>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
