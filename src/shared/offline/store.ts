import type { OfflineSnapshot } from '../domain/portable';
const database = 'coinguon-private-v1';
let opening: Promise<IDBDatabase> | undefined;
export function privateDB() {
  if (!opening)
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => {
        for (const name of ['snapshots', 'settings', 'receipts'])
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        opening = undefined;
        reject(new Error('Trình duyệt chưa cho phép lưu dữ liệu trên thiết bị.'));
      };
    });
  return opening;
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  task: (items: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await privateDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode),
      req = task(tx.objectStore(store));
    let value: T;
    req.onsuccess = () => {
      value = req.result;
    };
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(new Error('Không đọc/ghi được dữ liệu tải xuống.'));
    tx.onabort = () => reject(new Error('Thay đổi dữ liệu tải xuống đã bị hủy.'));
  });
}
function changed() {
  window.dispatchEvent(new Event('coinguon-private-changed'));
  try {
    localStorage.setItem('cn-private-revision', crypto.randomUUID());
  } catch {
    /* Cross-tab hints are optional; IndexedDB is authoritative. */
  }
}
export const getSetting = async (key: string) =>
  (await transaction('settings', 'readonly', (s) => s.get(key)))?.value;
export const setSetting = async (key: string, value: unknown) => {
  await transaction('settings', 'readwrite', (s) => s.put({ key, value }));
};
export async function snapshots(uid: string): Promise<OfflineSnapshot[]> {
  const rows = (await transaction('snapshots', 'readonly', (s) => s.getAll())) as {
    key: string;
    snapshot: OfflineSnapshot;
  }[];
  return rows.filter((row) => row.snapshot.uid === uid).map((row) => row.snapshot);
}
export async function saveSnapshot(snapshot: OfflineSnapshot) {
  const db = await privateDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['settings', 'snapshots'], 'readwrite');
    const request = tx.objectStore('settings').get('active');
    const permission = tx.objectStore('settings').get('memberships:' + snapshot.uid);
    permission.onsuccess = () => {
      if (
        request.result?.value !== snapshot.uid ||
        permission.result?.value?.[snapshot.clanId] !== snapshot.membershipEpoch
      ) {
        tx.abort();
        return;
      }
      tx.objectStore('snapshots').put({ key: snapshot.uid + ':' + snapshot.clanId, snapshot });
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(new Error('Phiên tài khoản đã thay đổi hoặc chưa lưu được bản tải.'));
  });
  changed();
}
export async function deleteSnapshot(uid: string, clanId: string) {
  await transaction('snapshots', 'readwrite', (s) => s.delete(uid + ':' + clanId));
  changed();
}
export async function clearPrivateData() {
  const db = await privateDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['snapshots', 'settings', 'receipts'], 'readwrite');
    for (const name of ['snapshots', 'settings', 'receipts']) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Chưa xóa được dữ liệu riêng tư trên thiết bị.'));
  });
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      for (const n of (await reg?.getNotifications?.()) || []) n.close();
    } catch {
      /* Permission or platform may not expose notifications. */
    }
  }
  changed();
}
let sessionQueue: Promise<void> = Promise.resolve();
export function activatePrivateSession(uid: string | null) {
  sessionQueue = sessionQueue
    .catch(() => undefined)
    .then(async () => {
      const old = await getSetting('active');
      if (old && old !== uid) await clearPrivateData();
      await setSetting('active', uid);
    });
  return sessionQueue;
}
export async function pruneSnapshots(
  uid: string,
  members: { clanId: string; joinedAt?: { toMillis: () => number }; invitationId: string | null }[],
) {
  const allowed = Object.fromEntries(
    members.map((m) => [
      m.clanId,
      String(m.joinedAt?.toMillis() ?? 0) + ':' + String(m.invitationId ?? ''),
    ]),
  );
  const db = await privateDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['settings', 'snapshots'], 'readwrite');
    tx.objectStore('settings').put({ key: 'memberships:' + uid, value: allowed });
    const request = tx.objectStore('snapshots').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const row = cursor.value.snapshot as OfflineSnapshot;
      if (row.uid === uid && allowed[row.clanId] !== row.membershipEpoch) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(new Error('Chưa cập nhật được quyền của bản tải.'));
  });
  changed();
}
export async function invalidateSnapshot(uid: string, clanId: string) {
  const db = await privateDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['settings', 'snapshots'], 'readwrite');
    const settings = tx.objectStore('settings'),
      request = settings.get('memberships:' + uid);
    request.onsuccess = () => {
      const allowed = { ...request.result?.value };
      delete allowed[clanId];
      settings.put({ key: 'memberships:' + uid, value: allowed });
      tx.objectStore('snapshots').delete(uid + ':' + clanId);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(new Error('Chưa dọn được bản đã mất quyền.'));
  });
  changed();
}

export function watchPrivateChanges(callback: () => void) {
  const listener = () => callback();
  window.addEventListener('coinguon-private-changed', listener);
  const storage = (e: StorageEvent) => {
    if (e.key === 'cn-private-revision') callback();
  };
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener('coinguon-private-changed', listener);
    window.removeEventListener('storage', storage);
  };
}
