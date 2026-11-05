import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function InstallApp() {
  const prompt = useRef<InstallPrompt | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const display = window.matchMedia?.('(display-mode: standalone)');
    const sync = () =>
      setInstalled(
        !!display?.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
    const capture = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
    };
    const done = () => {
      setInstalled(true);
      prompt.current = null;
      dialog.current?.close();
    };
    sync();
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', done);
    display?.addEventListener?.('change', sync);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', done);
      display?.removeEventListener?.('change', sync);
    };
  }, []);
  async function install() {
    if (lock.current) return;
    const event = prompt.current;
    if (!event) {
      dialog.current?.showModal();
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    prompt.current = null;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      setError('Chưa mở được cửa sổ cài đặt. Bạn có thể làm theo hướng dẫn bên dưới.');
      dialog.current?.showModal();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (installed) return null;
  return (
    <>
      <button className="install-app-button" onClick={() => void install()} disabled={busy}>
        <Download size={19} />
        {busy ? 'Đang mở…' : 'Cài ứng dụng'}
      </button>
      <dialog ref={dialog} className="settings-dialog install-dialog">
        <div className="dialog-heading">
          <h2>Thêm Cội Nguồn vào điện thoại</h2>
          <button
            className="icon-button"
            aria-label="Đóng hướng dẫn cài ứng dụng"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        <p>Sau khi thêm, bạn có thể mở Cội Nguồn từ biểu tượng trên màn hình chính.</p>
        <p>
          <strong>Đang mở từ Messenger, Facebook hoặc Zalo?</strong> Bấm menu ⋯ và chọn mở bằng
          trình duyệt ngoài. Nếu không có lựa chọn này, sao chép liên kết rồi mở bằng Chrome hoặc
          Safari.
        </p>
        <p>
          <strong>Android:</strong> Trong Chrome, bấm menu ⋮ → “Cài ứng dụng” hoặc “Thêm vào màn
          hình chính”, rồi xác nhận.
        </p>
        <p>
          <strong>iPhone / iPad:</strong> Mở bằng Safari, bấm Chia sẻ → “Thêm vào màn hình chính” →
          “Thêm”.
        </p>
        <button className="button primary full-width" onClick={() => dialog.current?.close()}>
          Đã hiểu
        </button>
      </dialog>
    </>
  );
}
