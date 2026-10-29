import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './preparedness.css';
export function PwaBanner() {
  const { pathname } = useLocation();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [ready, setReady] = useState(false),
    [update, setUpdate] = useState(false),
    [error, setError] = useState('');
  const enabled = ['/dong-ho', '/ngoai-tuyen'].includes(pathname);
  useEffect(() => {
    if (!enabled || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let active = true;
    let reg: ServiceWorkerRegistration | undefined;
    const change = () => {
      if (active) {
        setReady(!!navigator.serviceWorker.controller);
        setUpdate(!!reg?.waiting);
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', change);
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((r) => {
        reg = r;
        if (!active) return;
        setRegistration(r);
        change();
        r.addEventListener('updatefound', () =>
          r.installing?.addEventListener('statechange', change),
        );
      })
      .catch(() => {
        if (active) setError('Chưa chuẩn bị được app để tải lại khi mất mạng.');
      });
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener('controllerchange', change);
    };
  }, [enabled]);
  if (!enabled || !import.meta.env.PROD) return null;
  return (
    <aside className="notice pwa-banner" aria-label="Cài ứng dụng">
      <p>
        {error ||
          (ready
            ? 'Ứng dụng đã sẵn sàng để mở ngoại tuyến. Hãy tải dữ liệu trên thiết bị riêng trước khi mất mạng.'
            : 'Đang chuẩn bị ứng dụng để mở ngoại tuyến…')}
      </p>
      <p className="subtle">
        Có thể dùng “Cài ứng dụng” hoặc “Thêm vào màn hình chính” trong trình duyệt nếu thiết bị hỗ
        trợ.
      </p>
      {update && (
        <button
          className="button secondary"
          onClick={() => {
            const worker = registration?.waiting;
            if (!worker) return;
            navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
              once: true,
            });
            worker.postMessage({ type: 'SKIP_WAITING' });
          }}
        >
          Đã lưu việc đang làm — cập nhật ứng dụng
        </button>
      )}
    </aside>
  );
}
