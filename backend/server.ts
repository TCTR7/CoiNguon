import { mutateData } from './data.ts';
import { mutateReminders, startReminderWorker } from './reminders.ts';
import { mutateInvitations, previewGuest, respondGuest } from './invitations.ts';
import { mutateMemberships } from './memberships.ts';
import { previewJoin, mutateJoining } from './joining.ts';
import { createServer, type IncomingMessage } from 'node:http';
import { adminAuth, ApiError, mutate } from './service.ts';
import { mutateEvents } from './events.ts';
const port = 8787;
const origins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173']);
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
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  if (req.headers.host !== '127.0.0.1:' + port && req.headers.host !== 'localhost:' + port) {
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
  if (req.method === 'GET' && req.url === '/health') {
    res.end(JSON.stringify({ mode: 'local-emulator', projectId: 'demo-coinguon' }));
    return;
  }
  try {
    if (
      req.method !== 'POST' ||
      ![
        '/api/genealogy',
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
      res.end(
        JSON.stringify(
          await (req.url === '/api/guest/preview' ? previewGuest : respondGuest)(
            await bodyJson(req),
          ),
        ),
      );
      return;
    }
    if (req.url === '/api/join/preview') {
      res.end(JSON.stringify(await previewJoin(await bodyJson(req))));
      return;
    }
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new ApiError(401, 'Vui lòng đăng nhập.');
    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(token, true)).uid;
    } catch {
      throw new ApiError(401, 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
    }
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
    )(uid, await bodyJson(req, req.url === '/api/data' ? 8 * 1024 * 1024 : 32768));
    res.end(JSON.stringify(result));
  } catch (e) {
    const error =
      e instanceof ApiError
        ? e
        : new ApiError(503, 'Chưa thực hiện được. Kiểm tra Emulator và thử lại.');
    res.writeHead(error.status).end(JSON.stringify({ error: error.message }));
  }
});
server.requestTimeout = 30000;
server.listen(port, '127.0.0.1', () =>
  console.log('Genealogy API local: http://127.0.0.1:' + port),
);
const stopWorker = startReminderWorker();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    stopWorker();
    server.close(() => process.exit(0));
  });
