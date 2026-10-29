import { spawn, type ChildProcess } from 'node:child_process';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { store } from '../../../../backend/service';
type User = { uid: string; token: string };
let server: ChildProcess, admin: User, member: User, first: User, second: User;
const clanId = 'join-api-tests';
async function account(): Promise<User> {
  const res = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: crypto.randomUUID() + '@join.test',
        password: 'local-join-12345',
        returnSecureToken: true,
      }),
    },
  );
  const d = await res.json();
  if (!res.ok) throw new Error('Emulator account failed');
  return { uid: d.localId, token: d.idToken };
}
async function call(user: User | null, action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('http://127.0.0.1:8787/api/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
    },
    body: JSON.stringify({ clanId, action, ...payload }),
  });
  return { status: res.status, data: await res.json() };
}
async function preview(token: string) {
  const res = await fetch('http://127.0.0.1:8787/api/join/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return { status: res.status, data: await res.json() };
}
const requestRef = (uid: string) => store.doc('joinRequests/' + clanId + '_' + uid);
const membershipRef = (uid: string) => store.doc('memberships/' + clanId + '_' + uid);
async function link(version: number | null = null) {
  expect((await call(admin, 'createLink', { version })).status).toBe(200);
  return (await store.doc('clans/' + clanId + '/joinSettings/current').get()).data()!
    .token as string;
}
const submit = (user: User, token: string, extra: Record<string, unknown> = {}) =>
  call(user, 'submit', {
    token,
    displayName: 'Người thân mẫu',
    message: 'Con của bác An trong dữ liệu mẫu',
    ...extra,
  });
beforeAll(async () => {
  [admin, member, first, second] = await Promise.all([account(), account(), account(), account()]);
  server = spawn(process.execPath, ['--experimental-strip-types', 'backend/server.ts'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    server.stdout!.on('data', (chunk) => {
      if (String(chunk).includes('Genealogy API local')) resolve();
    });
    server.on('error', reject);
    server.on('exit', (code) => reject(new Error('API exited ' + code)));
  });
});
beforeEach(async () => {
  await store.recursiveDelete(store.doc('clans/' + clanId));
  for (const name of ['joinRequests', 'joinLinks']) {
    const docs = await store.collection(name).where('clanId', '==', clanId).get();
    for (const doc of docs.docs) await doc.ref.delete();
  }
  for (const user of [admin, member, first, second]) await membershipRef(user.uid).delete();
  await store.doc('clans/' + clanId).set({ name: 'Gia phả riêng mẫu', ownerUid: admin.uid });
  await membershipRef(admin.uid).set({
    uid: admin.uid,
    clanId,
    displayName: 'Quản trị mẫu',
    role: 'admin',
  });
  await membershipRef(member.uid).set({
    uid: member.uid,
    clanId,
    displayName: 'Thành viên mẫu',
    role: 'member',
  });
  await store
    .doc('clans/' + clanId + '/people/private-person')
    .set({ name: 'Tên riêng không công khai' });
});
afterAll(async () => {
  if (server) {
    const exit = new Promise<void>((resolve) => server.once('exit', () => resolve()));
    server.kill();
    await exit;
  }
  await store.recursiveDelete(store.doc('clans/' + clanId));
});
it('public preview exposes only the clan name and link metadata, never genealogy or permissions', async () => {
  const token = await link();
  const result = await preview(token);
  expect(result.status).toBe(200);
  expect(result.data.clanName).toBe('Gia phả riêng mẫu');
  expect(Object.keys(result.data).sort()).toEqual([
    'clanId',
    'clanName',
    'expiresAtMs',
    'linkVersion',
  ]);
  expect((await preview('0'.repeat(64))).status).toBe(404);
  expect((await preview('../private')).status).toBe(404);
  expect((await call(null, 'submit', { token })).status).toBe(401);
});
it('a shared link accepts multiple applicants without granting access before approval', async () => {
  const token = await link();
  expect((await submit(first, token, { role: 'admin', uid: admin.uid })).status).toBe(200);
  expect((await submit(second, token)).status).toBe(200);
  expect((await membershipRef(first.uid).get()).exists).toBe(false);
  expect((await membershipRef(second.uid).get()).exists).toBe(false);
  expect((await requestRef(first.uid).get()).data()!.uid).toBe(first.uid);
  for (const user of [first, second])
    expect(
      (
        await call(admin, 'review', {
          uid: user.uid,
          version: 1,
          decision: 'approve',
          role: 'admin',
        })
      ).status,
    ).toBe(200);
  expect((await membershipRef(first.uid).get()).data()!.role).toBe('member');
  expect((await membershipRef(second.uid).get()).data()!.role).toBe('member');
});
it('duplicate submissions keep a single pending request and preserve the original introduction', async () => {
  const token = await link();
  const results = await Promise.all([submit(first, token), submit(first, token)]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  await submit(first, token, { message: 'Nội dung gửi lại' });
  expect((await requestRef(first.uid).get()).data()!.version).toBe(1);
  expect((await requestRef(first.uid).get()).data()!.message).toBe(
    'Con của bác An trong dữ liệu mẫu',
  );
});
it('only a current admin of the target clan may create links or review requests', async () => {
  expect((await call(member, 'createLink', { version: null })).status).toBe(403);
  const token = await link();
  await submit(first, token);
  expect(
    (await call(first, 'review', { uid: first.uid, version: 1, decision: 'approve' })).status,
  ).toBe(403);
  expect(
    (
      await call(admin, 'review', {
        clanId: 'other-clan',
        uid: first.uid,
        version: 1,
        decision: 'approve',
      })
    ).status,
  ).toBe(403);
  await membershipRef(admin.uid).update({ role: 'member' });
  expect(
    (await call(admin, 'review', { uid: first.uid, version: 1, decision: 'approve' })).status,
  ).toBe(403);
});
it('concurrent reviews create membership only once and cannot restore a removed member by replay', async () => {
  const token = await link();
  await submit(first, token);
  const results = await Promise.all(
    [1, 2].map(() => call(admin, 'review', { uid: first.uid, version: 1, decision: 'approve' })),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  await membershipRef(first.uid).delete();
  expect(
    (await call(admin, 'review', { uid: first.uid, version: 1, decision: 'approve' })).status,
  ).toBe(409);
  expect((await membershipRef(first.uid).get()).exists).toBe(false);
  expect((await submit(first, token)).status).toBe(200);
  expect((await requestRef(first.uid).get()).data()!.status).toBe('pending');
});
it('approval does not overwrite an existing membership or elevate its role', async () => {
  const token = await link();
  await submit(first, token);
  await membershipRef(first.uid).set({
    uid: first.uid,
    clanId,
    role: 'editor',
    invitationId: 'existing-invite',
  });
  expect(
    (await call(admin, 'review', { uid: first.uid, version: 1, decision: 'approve' })).status,
  ).toBe(200);
  expect((await membershipRef(first.uid).get()).data()!.role).toBe('editor');
  expect((await membershipRef(first.uid).get()).data()!.invitationId).toBe('existing-invite');
});
it('revocation prevents new requests and approval of pending requests from the old link', async () => {
  const token = await link();
  await submit(first, token);
  expect((await call(admin, 'revokeLink', { version: 1 })).status).toBe(200);
  expect((await preview(token)).status).toBe(404);
  expect((await submit(second, token)).status).toBe(404);
  expect(
    (await call(admin, 'review', { uid: first.uid, version: 1, decision: 'approve' })).status,
  ).toBe(409);
  const replacement = await link(2);
  expect((await submit(first, replacement)).status).toBe(200);
  expect((await requestRef(first.uid).get()).data()!.version).toBe(2);
  expect(
    (await call(admin, 'review', { uid: first.uid, version: 2, decision: 'approve' })).status,
  ).toBe(200);
});
it('rotation is versioned and invalidates the previous link immediately', async () => {
  const original = await link();
  const replacement = await link(1);
  expect(replacement).not.toBe(original);
  expect((await preview(original)).status).toBe(404);
  expect((await preview(replacement)).status).toBe(200);
  expect((await call(admin, 'revokeLink', { version: 1 })).status).toBe(409);
});
it('expired links cannot be previewed, submitted or used to approve a request', async () => {
  const token = await link();
  await submit(first, token);
  const request = (await requestRef(first.uid).get()).data()!;
  await store.doc('joinLinks/' + request.linkHash).update({ expiresAtMs: Date.now() - 1 });
  expect((await preview(token)).status).toBe(404);
  expect((await submit(second, token)).status).toBe(404);
  expect(
    (await call(admin, 'review', { uid: first.uid, version: 1, decision: 'approve' })).status,
  ).toBe(409);
});
it('withdrawal races safely with approval and cannot withdraw someone else’s request', async () => {
  const token = await link();
  await submit(first, token);
  expect((await call(second, 'withdraw', { uid: first.uid, version: 1 })).status).toBe(409);
  const results = await Promise.all([
    call(first, 'withdraw', { version: 1 }),
    call(admin, 'review', { uid: first.uid, version: 1, decision: 'approve' }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const request = (await requestRef(first.uid).get()).data()!;
  expect((await membershipRef(first.uid).get()).exists).toBe(request.status === 'approved');
});
it('a rejection does not grant membership or allow repeated requests through the same link', async () => {
  const token = await link();
  await submit(first, token);
  expect(
    (await call(admin, 'review', { uid: first.uid, version: 1, decision: 'reject' })).status,
  ).toBe(200);
  expect((await membershipRef(first.uid).get()).exists).toBe(false);
  expect((await submit(first, token)).status).toBe(409);
  const replacement = await link(1);
  expect((await submit(first, replacement)).status).toBe(200);
});
it('validates names and introductions on the backend, while existing members do not create requests', async () => {
  const token = await link();
  expect((await submit(first, token, { displayName: 'a' })).status).toBe(400);
  expect((await submit(first, token, { message: 'a' })).status).toBe(400);
  expect((await submit(first, token, { message: 'x'.repeat(301) })).status).toBe(400);
  expect((await submit(member, token)).data.status).toBe('member');
  expect((await requestRef(member.uid).get()).exists).toBe(false);
});
