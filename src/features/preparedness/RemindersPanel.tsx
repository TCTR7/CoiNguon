import { useCallback, useEffect, useState } from 'react';
import { getSetting, setSetting, activatePrivateSession } from '../../shared/offline/store';
import { auth } from '../../shared/firebase/client';
import { accountRequest } from './service';
import type { Membership } from '../workspace/service';
type Reminder = {
  id: string;
  title: string;
  date: string;
  time: string;
  timeZone: string;
  offset: number;
  read: boolean;
};
type WorkerStatus = { counts: Record<string, number>; lastScanAtMs: number | null };
async function notify(uid: string, id: string, required = false) {
  if (
    !import.meta.env.PROD ||
    !('serviceWorker' in navigator) ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  )
    return;
  if (auth.currentUser?.uid !== uid || !(await getSetting('notifications:' + uid))) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const worker = reg?.active;
  if (!worker) {
    if (required)
      throw new Error(
        'Ứng dụng chưa sẵn sàng để thử thông báo. Chờ PWA chuẩn bị xong rồi thử lại.',
      );
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error?: Error) => {
      clearTimeout(timer);
      channel.port1.close();
      if (error) reject(error);
      else resolve();
    };
    const timer = window.setTimeout(
      () => finish(new Error('Chưa xác nhận được thông báo trên thiết bị. Hãy thử lại.')),
      10000,
    );
    channel.port1.onmessage = (event) =>
      finish(
        required && event.data?.done !== true
          ? new Error('Chưa hiển thị được thông báo thử. Kiểm tra quyền và thử lại.')
          : undefined,
      );
    worker.postMessage({ type: 'LOCAL_REMINDER', uid, id }, [channel.port2]);
  });
}
export function RemindersPanel({ membership }: { membership: Membership }) {
  const { clanId, uid } = membership;
  const [items, setItems] = useState<Reminder[]>([]),
    [status, setStatus] = useState<WorkerStatus | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await accountRequest<{ items: Reminder[] }>('reminders', clanId, 'list');
    if (auth.currentUser?.uid !== uid) return;
    setItems(result.items);
    for (const item of result.items)
      if (!item.read) void notify(uid, item.id).catch(() => undefined);
  }, [clanId, uid]);
  useEffect(() => {
    let active = true;
    const tick = () => {
      void load().catch(() => {
        if (active) setError('Chưa tải được lời nhắc. Hãy kiểm tra kết nối rồi thử lại.');
      });
    };
    const first = window.setTimeout(tick, 0),
      timer = window.setInterval(tick, 30000);
    return () => {
      active = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);
  async function act(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enable() {
    if (!import.meta.env.PROD)
      throw new Error(
        'Thông báo thử cần bản build PWA; hộp nhắc trong ứng dụng vẫn hoạt động ở dev.',
      );
    if (!('Notification' in window) || !('serviceWorker' in navigator))
      throw new Error(
        'Trình duyệt này chưa hỗ trợ thông báo. Bạn vẫn xem được hộp nhắc trong ứng dụng.',
      );
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      await setSetting('notifications:' + uid, false);
      throw new Error(
        permission === 'denied'
          ? 'Thông báo đang bị chặn. Mở cài đặt quyền của trang nếu muốn bật lại.'
          : 'Chưa cấp quyền thông báo; hộp nhắc vẫn dùng được.',
      );
    }
    await activatePrivateSession(uid);
    if (auth.currentUser?.uid !== uid) throw new Error('Tài khoản đã thay đổi.');
    await setSetting('notifications:' + uid, true);
    await notify(uid, 'test-' + crypto.randomUUID(), true);
    setNotice(
      'Đã bật thông báo thử trên thiết bị này. Thông báo chỉ hiện nội dung chung, không có tên gia đình.',
    );
  }
  return (
    <section className="paper-panel preparedness-panel" aria-label="Nhắc giỗ">
      <p className="eyebrow">NHỚ NGÀY TRỞ VỀ</p>
      <h2>Hộp nhắc giỗ</h2>
      <p>
        Nhắc trước 7 và 3 ngày, lúc 09:00 theo múi giờ tổ chức. Lịch vừa công bố sau mốc nhắc sẽ
        không gửi bù.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <div className="button-row">
        <button className="button secondary" disabled={busy} onClick={() => void act(load)}>
          Tải lại lời nhắc
        </button>
        <button className="button secondary" disabled={busy} onClick={() => void act(enable)}>
          Bật và thử thông báo thiết bị
        </button>
        <button
          className="text-link"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              await setSetting('notifications:' + uid, false);
              const reg = await navigator.serviceWorker?.getRegistration();
              for (const n of (await reg?.getNotifications()) || []) n.close();
              setNotice('Đã tắt thông báo trên thiết bị này.');
            })
          }
        >
          Tắt thông báo thiết bị
        </button>
      </div>
      {!items.length ? (
        <p>Chưa có lời nhắc hợp lệ.</p>
      ) : (
        <ul className="reminder-list">
          {items.map((item) => (
            <li key={item.id}>
              <h3>{item.title}</h3>
              <p>
                Trước {item.offset} ngày · {item.date} · {item.time} · {item.timeZone}
              </p>
              {item.read ? (
                <span>Đã đọc</span>
              ) : (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await accountRequest('reminders', clanId, 'read', { id: item.id });
                      await load();
                    })
                  }
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {membership.role === 'admin' && (
        <details>
          <summary>Tình trạng nhắc trên môi trường local</summary>
          <p>
            Worker quét mỗi phút khi API đang chạy. Lỗi tạm thời thử lại tối đa 3 lần trong cửa sổ
            24 giờ; lịch hoặc tư cách thành viên thay đổi sẽ bỏ lời nhắc cũ.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await accountRequest('reminders', clanId, 'run');
                setStatus(await accountRequest('reminders', clanId, 'status'));
                await load();
              })
            }
          >
            Quét và xem tình trạng nhắc
          </button>
          {status && (
            <p role="status">
              Lần quét:{' '}
              {status.lastScanAtMs
                ? new Date(status.lastScanAtMs).toLocaleString('vi-VN')
                : 'Chưa có'}{' '}
              · Đã ghi hộp nhắc: {status.counts.delivered} · Chờ thử lại: {status.counts.retry} ·
              Lỗi cuối: {status.counts.failed} · Đã hủy: {status.counts.cancelled}.
            </p>
          )}
        </details>
      )}
    </section>
  );
}
