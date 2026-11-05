/* Static shell only. Family data is explicit, UID-scoped IndexedDB, never HTTP cache. */
const shell = 'coinguon-shell-__CACHE_VERSION__';
const assets = __ASSET_LIST__;
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(shell).then((cache) => cache.addAll(assets)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('coinguon-shell-') && key !== shell) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    const safe =
      [
        '/',
        '/dong-ho',
        '/ngoai-tuyen',
        '/gia-pha',
        '/lich-gio',
        '/thanh-vien',
      ].includes(url.pathname) && !url.search;
    event.respondWith(
      fetch(req).catch(async () => {
        if (safe) return (await caches.open(shell)).match('/index.html');
        return new Response('Cần kết nối mạng để mở liên kết này.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }),
    );
  } else if (assets.includes(url.pathname) && !url.search) {
    event.respondWith(
      caches.open(shell).then(async (cache) => (await cache.match(url.pathname)) || fetch(req)),
    );
  }
});
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('coinguon-private-v1', 1);
    request.onupgradeneeded = () => {
      for (const name of ['snapshots', 'settings', 'receipts'])
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function localReminder(uid, id) {
  if (typeof uid !== 'string' || typeof id !== 'string' || id.length > 160) return false;
  const db = await database();
  try {
    const allowed = await new Promise((resolve, reject) => {
      const tx = db.transaction(['settings', 'receipts'], 'readwrite'),
        settings = tx.objectStore('settings'),
        receipts = tx.objectStore('receipts');
      const active = settings.get('active'),
        enabled = settings.get('notifications:' + uid),
        old = receipts.get(uid + ':' + id);
      let ok = false,
        finished = 0;
      const done = () => {
        if (++finished === 3) {
          ok = active.result?.value === uid && enabled.result?.value === true && !old.result;
          if (ok) receipts.put({ key: uid + ':' + id });
        }
      };
      active.onsuccess = done;
      enabled.onsuccess = done;
      old.onsuccess = done;
      tx.oncomplete = () => resolve(ok);
      tx.onerror = () => reject(tx.error);
    });
    if (!allowed) return false;
    // This generic notification contains no family name, date, person, link token or UID.
    await self.registration.showNotification('Cội Nguồn', {
      body: 'Bạn có lời nhắc mới. Mở ứng dụng để xem.',
      tag: 'cn-' + id,
      renotify: false,
      icon: '/favicon.svg',
    });
    // Logout may have happened while showNotification was pending.
    const active = await new Promise((resolve, reject) => {
      const tx = db.transaction('settings');
      const q = tx.objectStore('settings').get('active');
      q.onsuccess = () => resolve(q.result?.value);
      q.onerror = () => reject(q.error);
    });
    if (active !== uid) {
      for (const n of await self.registration.getNotifications({ tag: 'cn-' + id })) n.close();
      return false;
    }
    return true;
  } catch (error) {
    await new Promise((resolve) => {
      const tx = db.transaction('receipts', 'readwrite');
      tx.objectStore('receipts').delete(uid + ':' + id);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    throw error;
  } finally {
    db.close();
  }
}
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'LOCAL_REMINDER')
    event.waitUntil(
      localReminder(event.data.uid, event.data.id)
        .then((done) => event.ports[0]?.postMessage({ done }))
        .catch(() => event.ports[0]?.postMessage({ done: false })),
    );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const page = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (page) {
        await page.navigate('/dong-ho');
        await page.focus();
      } else await self.clients.openWindow('/dong-ho');
    })(),
  );
});
