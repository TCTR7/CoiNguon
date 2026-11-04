import { mutateData } from './data.ts';
import { accountAction, limitAccountRequest, requireAccount } from './accounts.ts';
import { phoneInvites } from './phone-invites.ts';
import { mutateReminders, startReminderWorker, runReminderTick } from './reminders.ts';
import { runtime } from './config.ts';
import { consumeBudget } from './rate-limit.ts';
import { mutateInvitations, previewGuest, respondGuest } from './invitations.ts';
import { mutateMemberships } from './memberships.ts';
import { previewJoin, mutateJoining } from './joining.ts';
import { createServer, type IncomingMessage } from 'node:http';
import { adminAuth, ApiError, mutate } from './service.ts';
import { mutateEvents } from './events.ts';
const port = runtime.port;
const origins = new Set(runtime.origins);
async function bodyJson(req: IncomingMessage, maxBytes = 32768) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) throw new ApiError(413, 'Dữ liệu gửi lên quá lớn.');
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  try {
    const data: unknown = JSON.parse(body);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new ApiError(400, 'Nội dung JSON không hợp lệ.');
  }
}
export const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  if (
    runtime.local &&
    req.headers.host !== '127.0.0.1:' + port &&
    req.headers.host !== 'localhost:' + port
  ) {
    res.writeHead(403).end();
    return;
  }
  if (origin && !origins.has(origin)) {
    res.writeHead(403).end();
    return;
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'GET' && ['/health', '/api/health'].includes(req.url || '')) {
    res.end(
      JSON.stringify({
        mode: runtime.local ? 'local-emulator' : runtime.mode,
        projectId: runtime.projectId,
        role: runtime.role,
      }),
    );
    return;
  }
  try {
    if (runtime.role === 'worker') {
      // Cloud Run IAM authenticates Scheduler on this separate private service.
      if (
        runtime.local ||
        !process.env.K_SERVICE ||
        req.method !== 'POST' ||
        req.url !== '/internal/reminders/tick'
      )
        throw new ApiError(404, 'Không tìm thấy endpoint.');
      const payload = await bodyJson(req);
      if (Object.keys(payload).length) throw new ApiError(400, 'Tác vụ không nhận tham số.');
      res.end(JSON.stringify(await runReminderTick()));
      return;
    }
    if (
      req.method !== 'POST' ||
      ![
        '/api/genealogy',
        '/api/account',
        '/api/phone-invites',
        '/api/events',
        '/api/join',
        '/api/join/preview',
        '/api/memberships',
        '/api/invitations',
        '/api/data',
        '/api/reminders',
        '/api/guest/preview',
        '/api/guest/respond',
      ].includes(req.url || '')
    )
      throw new ApiError(404, 'Không tìm thấy endpoint.');
    if (!req.headers['content-type']?.startsWith('application/json'))
      throw new ApiError(415, 'Cần gửi JSON.');
    if (req.url === '/api/guest/preview' || req.url === '/api/guest/respond') {
      await consumeBudget('api:global', 600);
      const payload = await bodyJson(req);
      await consumeBudget('guest:' + String(payload.token || 'invalid'), 120);
      res.end(
        JSON.stringify(
          await (req.url === '/api/guest/preview' ? previewGuest : respondGuest)(payload),
        ),
      );
      return;
    }
    if (req.url === '/api/join/preview') {
      await consumeBudget('api:global', 600);
      const payload = await bodyJson(req);
      await consumeBudget('join:' + String(payload.token || 'invalid'), 120);
      res.end(JSON.stringify(await previewJoin(payload)));
      return;
    }
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new ApiError(401, 'Vui lòng đăng nhập.');
    let uid: string;
    let authTime = 0;
    try {
      const decoded = await adminAuth.verifyIdToken(token, true);
      if (!runtime.local && decoded.firebase?.sign_in_provider !== 'google.com')
        throw new Error('Google sign-in required');
      uid = decoded.uid;
      authTime = decoded.auth_time;
    } catch {
      throw new ApiError(401, 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
    }
    await consumeBudget('api:global', 600);
    const payload = await bodyJson(req, req.url === '/api/data' ? 8 * 1024 * 1024 : 32768);
    const read = [
      'get',
      'list',
      'inbox',
      'download',
      'export',
      'validate',
      'previewRestore',
      'status',
    ].includes(String(payload.action));
    await consumeBudget(uid + ':' + (read ? 'read' : 'write'), read ? 120 : 30);
    if (req.url === '/api/account' || req.url === '/api/phone-invites') {
      limitAccountRequest(
        uid,
        ['get', 'list', 'inbox'].includes(String(payload.action)) ? 'read' : 'write',
      );
      const result =
        req.url === '/api/account'
          ? await accountAction(uid, payload, authTime)
          : await phoneInvites(uid, payload);
      res.end(JSON.stringify(result));
      return;
    }
    if (
      req.url === '/api/data' &&
      !['download', 'export', 'validate', 'previewRestore'].includes(String(payload.action))
    )
      await requireAccount(uid);
    const result = await (
      req.url === '/api/data'
        ? mutateData
        : req.url === '/api/reminders'
          ? mutateReminders
          : req.url === '/api/invitations'
            ? mutateInvitations
            : req.url === '/api/memberships'
              ? mutateMemberships
              : req.url === '/api/join'
                ? mutateJoining
                : req.url === '/api/events'
                  ? mutateEvents
                  : mutate
    )(uid, payload);
    res.end(JSON.stringify(result));
  } catch (e) {
    const error =
      e instanceof ApiError
        ? e
        : new ApiError(503, 'Dịch vụ tạm thời chưa sẵn sàng. Vui lòng thử lại.');
    if (error.status === 429) res.setHeader('Retry-After', '60');
    res.writeHead(error.status).end(JSON.stringify({ error: error.message }));
  }
});
server.requestTimeout = 30000;
server.listen(port, runtime.host, () =>
  console.log(
    runtime.local
      ? 'Genealogy API local: http://127.0.0.1:' + port
      : 'Coi Nguon API listening on port ' + port + ' (' + runtime.mode + ', ' + runtime.role + ')',
  ),
);
const stopWorker = runtime.local && runtime.role === 'api' ? startReminderWorker() : () => {};
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    stopWorker();
    server.close(() => process.exit(0));
  });
