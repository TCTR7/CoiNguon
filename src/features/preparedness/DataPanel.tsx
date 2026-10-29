import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from '../../shared/firebase/client';
import {
  saveSnapshot,
  snapshots,
  deleteSnapshot,
  watchPrivateChanges,
  setSetting,
} from '../../shared/offline/store';
import type { OfflineSnapshot, PortableData } from '../../shared/domain/portable';
import { accountRequest } from './service';
import type { Membership } from '../workspace/service';
import './preparedness.css';
export function DataPanel({ membership }: { membership: Membership }) {
  const [trusted, setTrusted] = useState(false),
    [saved, setSaved] = useState<OfflineSnapshot | null>(null),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [file, setFile] = useState<PortableData | null>(null);
  const [preview, setPreview] = useState<{
    people: number;
    relationships: number;
    rules: number;
    events: number;
    clanName: string;
  } | null>(null);
  const [name, setName] = useState(''),
    [confirm, setConfirm] = useState(false),
    [restored, setRestored] = useState('');
  const operation = useRef('');
  const { clanId, uid } = membership;
  useEffect(() => {
    let alive = true;
    const load = () => {
      void snapshots(uid)
        .then((rows) => {
          if (alive) setSaved(rows.find((s) => s.clanId === clanId) || null);
        })
        .catch(() => undefined);
    };
    load();
    const stop = watchPrivateChanges(load);
    return () => {
      alive = false;
      stop();
    };
  }, [uid, clanId]);
  async function act(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!trusted) throw new Error('Chỉ tải trên thiết bị riêng mà bạn tin cậy.');
    const data = await accountRequest<OfflineSnapshot>('data', clanId, 'download');
    if (auth.currentUser?.uid !== uid) throw new Error('Tài khoản đã thay đổi.');
    await setPersistence(auth, browserLocalPersistence);
    await setSetting('trusted:' + uid, true);
    await saveSnapshot(data);
    setNotice(
      'Đã tải hồ sơ chữ, quan hệ và lịch để đọc ngoại tuyến. Các lần thay đổi tiếp theo chưa tự cập nhật vào bản tải.',
    );
  }
  async function exportFile() {
    const data = await accountRequest<PortableData>('data', clanId, 'export');
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'coi-nguon-gia-pha-' + new Date().toISOString().slice(0, 10) + '.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      'Đã tạo tệp JSON. Lưu bản sao ở nơi riêng tư; đăng xuất không xóa tệp bạn đã tải về.',
    );
  }
  async function restore(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      if (!file || !preview || !confirm)
        throw new Error('Chọn tệp, kiểm tra trước và xác nhận khôi phục riêng.');
      if (!operation.current) operation.current = crypto.randomUUID();
      const result = await accountRequest<{ clanId: string }>('data', clanId, 'restore', {
        data: file,
        name,
        operationId: operation.current,
        confirm: true,
      });
      setRestored(result.clanId);
      setNotice(
        'Đã khôi phục sang gia phả thử mới. Chỉ tài khoản của bạn là admin; lịch được giữ ngày và đưa về nháp để kiểm tra lại.',
      );
    });
  }
  return (
    <section className="paper-panel preparedness-panel" aria-label="Dữ liệu và thiết bị">
      <p className="eyebrow">GIỮ MỘT BẢN ĐỂ AN TÂM</p>
      <h2>Dữ liệu & thiết bị</h2>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <h3>Đọc khi mất mạng</h3>
      <p>
        Chỉ lưu hồ sơ chữ, quan hệ và lịch; không lưu ảnh, danh sách khách, token mời hoặc quyền
        quản trị. Chế độ ngoại tuyến không có thao tác ghi.
      </p>
      <label className="preparedness-check">
        <input type="checkbox" checked={trusted} onChange={(e) => setTrusted(e.target.checked)} />{' '}
        Đây là thiết bị riêng tôi tin cậy. Tôi đồng ý lưu dữ liệu và duy trì đăng nhập trên thiết bị
        này.
      </label>
      <p className="subtle">
        Khi mất mạng, ứng dụng không thể biết ngay nếu quyền đã bị thu hồi. Khi có mạng sẽ kiểm tra
        quyền; đăng xuất sẽ xóa dữ liệu tải xuống.
      </p>
      <div className="button-row">
        <button
          className="button primary"
          disabled={busy || !trusted}
          onClick={() => void act(download)}
        >
          {saved ? 'Cập nhật bản tải xuống' : 'Tải dữ liệu để đọc ngoại tuyến'}
        </button>
        <Link className="button secondary" to="/ngoai-tuyen">
          Mở dữ liệu đã tải
        </Link>
        {saved && (
          <button
            className="text-link"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await deleteSnapshot(uid, clanId);
                setNotice('Đã xóa bản tải xuống của gia phả này.');
              })
            }
          >
            Xóa bản tải xuống
          </button>
        )}
      </div>
      {saved && (
        <p>
          Lần tải cuối: {new Date(saved.downloadedAtMs).toLocaleString('vi-VN')} ·{' '}
          {saved.people.length} hồ sơ · {saved.events.length} sự kiện.
        </p>
      )}
      <p className="subtle">
        Tải lại trang khi mất mạng cần bản build PWA đã mở ít nhất một lần. Bản chạy dev chỉ đọc
        được trong trang đang mở; trình duyệt có thể dọn dữ liệu đã lưu.
      </p>
      {membership.role === 'admin' && (
        <details>
          <summary>Xuất bản sao & khôi phục thử</summary>
          <p>
            JSON gồm hồ sơ, quan hệ, quy tắc và lịch. Không chứa tài khoản, phân quyền, liên kết tài
            khoản, khách mời hoặc khóa truy cập. Đây là bản sao gia phả cơ bản.
          </p>
          <button className="button secondary" disabled={busy} onClick={() => void act(exportFile)}>
            Xuất bản sao JSON
          </button>
          <form className="workspace-form" onSubmit={restore}>
            <label>
              Tệp JSON cần kiểm tra
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  setPreview(null);
                  setFile(null);
                  setConfirm(false);
                  setRestored('');
                  operation.current = '';
                  if (chosen)
                    void act(async () => {
                      if (chosen.size > 8 * 1024 * 1024) throw new Error('Tệp local tối đa 8 MB.');
                      const value = JSON.parse(await chosen.text()) as PortableData;
                      setFile(value);
                      setName(
                        (
                          'Khôi phục thử — ' +
                          (typeof value.clanName === 'string' ? value.clanName : 'Gia phả')
                        ).slice(0, 80),
                      );
                    });
                }}
              />
            </label>
            <button
              className="button secondary"
              type="button"
              disabled={busy || !file}
              onClick={() =>
                void act(async () =>
                  setPreview(
                    await accountRequest('data', clanId, 'previewRestore', { data: file }),
                  ),
                )
              }
            >
              Kiểm tra tệp trước khi khôi phục
            </button>
            {preview && (
              <div className="notice" role="status">
                {preview.clanName}: {preview.people} hồ sơ, {preview.relationships} quan hệ,{' '}
                {preview.rules} quy tắc, {preview.events} sự kiện. ID và ngày gốc được giữ; mọi sự
                kiện khôi phục ở trạng thái nháp.
              </div>
            )}
            <label>
              Tên gia phả khôi phục thử
              <input
                value={name}
                minLength={2}
                maxLength={80}
                required
                onChange={(e) => {
                  setName(e.target.value);
                  operation.current = '';
                }}
              />
            </label>
            <label className="preparedness-check">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />{' '}
              Tôi hiểu dữ liệu được khôi phục vào gia phả thử mới, không ghi đè gia phả hiện tại và
              không khôi phục quyền của người khác.
            </label>
            <button className="button primary" disabled={busy || !preview || !confirm}>
              Khôi phục sang gia phả thử mới
            </button>
          </form>
          {restored && (
            <p role="status">
              Gia phả thử đã sẵn sàng trong danh sách “Dòng họ đang xem”. Mã: {restored}
            </p>
          )}
        </details>
      )}
    </section>
  );
}
