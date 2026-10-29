import { spawn, type ChildProcess } from 'node:child_process';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { store } from '../../../../backend/service';
type User = { uid: string; token: string };
let server: ChildProcess, creator: User, successor: User, member: User, outsider: User;
const clanId = 'membership-api-tests',
  otherClan = 'membership-api-other';
const ref = (user: User) => store.doc('memberships/' + clanId + '_' + user.uid);
async function account(): Promise<User> {
  const res = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: crypto.randomUUID() + '@handoff.test',
        password: 'local-handoff-12345',
        returnSecureToken: true,
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error('Emulator account failed');
  return { uid: data.localId, token: data.idToken };
}
async function expected(user: User) {
  const m = (await ref(user).get()).data()!;
  return {
    uid: user.uid,
    expectedRole: m.role,
    version: m.managementVersion ?? 0,
    epoch: [m.joinedAt?.seconds ?? 0, m.joinedAt?.nanoseconds ?? 0, m.invitationId ?? ''].join(':'),
  };
}
async function call(actor: User | null, action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch('http://127.0.0.1:8787/api/memberships', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}),
    },
    body: JSON.stringify({ clanId, action, ...payload }),
  });
  return { status: response.status, data: await response.json() };
}
async function change(actor: User, target: User, role: string) {
  return call(actor, 'changeRole', { ...(await expected(target)), role });
}
async function admins() {
  return (
    await store
      .collection('memberships')
      .where('clanId', '==', clanId)
      .where('role', '==', 'admin')
      .get()
  ).docs.map((d) => d.data().uid);
}
async function promote() {
  expect((await change(creator, successor, 'admin')).status).toBe(200);
}
beforeAll(async () => {
  [creator, successor, member, outsider] = await Promise.all([
    account(),
    account(),
    account(),
    account(),
  ]);
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
  await store.doc('clans/' + clanId).set({ name: 'Gia phả bàn giao mẫu', ownerUid: creator.uid });
  for (const [user, role] of [
    [creator, 'admin'],
    [successor, 'member'],
    [member, 'editor'],
  ] as const)
    await ref(user).set({
      clanId,
      uid: user.uid,
      displayName: 'Người mẫu',
      role,
      joinedAt: Timestamp.fromMillis(1700000000000),
      invitationId: user === creator ? null : 'fixture-' + user.uid,
    });
  await store.doc('clans/' + otherClan).set({ name: 'Gia phả khác', ownerUid: outsider.uid });
  await store
    .doc('memberships/' + otherClan + '_' + outsider.uid)
    .set({ clanId: otherClan, uid: outsider.uid, role: 'admin' });
  await store.doc('clans/' + clanId + '/people/original').set({ name: 'Hồ sơ mẫu được giữ' });
});
afterAll(async () => {
  if (server) {
    const exited = new Promise<void>((resolve) => server.once('exit', () => resolve()));
    server.kill();
    await exited;
  }
  for (const id of [clanId, otherClan]) {
    await store.recursiveDelete(store.doc('clans/' + id));
    const docs = await store.collection('memberships').where('clanId', '==', id).get();
    for (const doc of docs.docs) await doc.ref.delete();
  }
});
it('blocks unauthenticated, non-admin and cross-clan management', async () => {
  const target = await expected(creator);
  expect((await call(null, 'changeRole', { ...target, role: 'member' })).status).toBe(401);
  for (const actor of [successor, member, outsider]) {
    expect((await call(actor, 'changeRole', { ...target, role: 'member' })).status).toBe(403);
    expect((await call(actor, 'remove', target)).status).toBe(403);
  }
  expect(await admins()).toEqual([creator.uid]);
});
it('protects the sole admin for demotion, removal and departure', async () => {
  const target = await expected(creator);
  for (const action of ['changeRole', 'remove', 'leave']) {
    const result = await call(creator, action, { ...target, role: 'member' });
    expect(result.status).toBe(409);
    expect(result.data.error).toContain('ít nhất một quản trị viên');
  }
  expect(await admins()).toEqual([creator.uid]);
});
it('allows a creator to promote a successor then demote themselves without changing creator metadata', async () => {
  await promote();
  expect((await change(creator, creator, 'editor')).status).toBe(200);
  expect((await ref(creator).get()).data()!.role).toBe('editor');
  expect((await store.doc('clans/' + clanId).get()).data()!.ownerUid).toBe(creator.uid);
  expect((await change(creator, member, 'admin')).status).toBe(403);
  expect((await change(successor, member, 'admin')).status).toBe(200);
});
it('allows an admin creator to leave; their old ID has no privileges and genealogy survives', async () => {
  await promote();
  expect((await call(creator, 'leave', await expected(creator))).status).toBe(200);
  expect((await ref(creator).get()).exists).toBe(false);
  expect((await change(creator, successor, 'member')).status).toBe(403);
  expect((await store.doc('clans/' + clanId + '/people/original').get()).exists).toBe(true);
  expect(await admins()).toEqual([successor.uid]);
});
it('lets another admin demote or remove the creator while preserving a current admin', async () => {
  await promote();
  expect((await change(successor, creator, 'member')).status).toBe(200);
  expect((await call(successor, 'remove', await expected(creator))).status).toBe(200);
  expect(await admins()).toEqual([successor.uid]);
});
it('lets ordinary members leave but rejects forged departures for another person', async () => {
  expect((await call(member, 'leave', await expected(successor))).status).toBe(403);
  expect((await call(member, 'leave', await expected(member))).status).toBe(200);
  expect((await ref(member).get()).exists).toBe(false);
  expect((await ref(successor).get()).exists).toBe(true);
});
it('serializes simultaneous self-demotions so exactly one admin remains', async () => {
  await promote();
  const [a, b] = await Promise.all([expected(creator), expected(successor)]);
  const results = await Promise.all([
    call(creator, 'changeRole', { ...a, role: 'member' }),
    call(successor, 'changeRole', { ...b, role: 'editor' }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await admins()).toHaveLength(1);
});
it('serializes simultaneous admin departures so exactly one admin remains', async () => {
  await promote();
  const [a, b] = await Promise.all([expected(creator), expected(successor)]);
  const results = await Promise.all([call(creator, 'leave', a), call(successor, 'leave', b)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await admins()).toHaveLength(1);
});
it('does not allow mutual admin removals to empty the admin set', async () => {
  await promote();
  const [a, b] = await Promise.all([expected(creator), expected(successor)]);
  const results = await Promise.all([call(creator, 'remove', b), call(successor, 'remove', a)]);
  expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  expect(results.find((r) => r.status !== 200)!.status).toBe(403);
  expect(await admins()).toHaveLength(1);
});
it('rejects duplicate and stale role edits, including roles changed away and back', async () => {
  const stale = await expected(successor);
  const results = await Promise.all([
    call(creator, 'changeRole', { ...stale, role: 'admin' }),
    call(creator, 'changeRole', { ...stale, role: 'editor' }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await change(creator, successor, 'member')).status).toBe(200);
  expect((await call(creator, 'remove', stale)).status).toBe(409);
  expect((await ref(successor).get()).exists).toBe(true);
});
it('rejects a stale removal after the target leaves and rejoins', async () => {
  const stale = await expected(member);
  expect((await call(member, 'leave', stale)).status).toBe(200);
  await ref(member).set({
    clanId,
    uid: member.uid,
    displayName: 'Người mẫu tham gia lại',
    role: 'editor',
    joinedAt: Timestamp.fromMillis(1800000000000),
    invitationId: 'new-membership',
  });
  expect((await call(creator, 'remove', stale)).status).toBe(409);
  expect((await ref(member).get()).exists).toBe(true);
});
it('does not restore admin privileges to a returning creator automatically', async () => {
  await promote();
  expect((await call(creator, 'leave', await expected(creator))).status).toBe(200);
  await ref(creator).set({
    clanId,
    uid: creator.uid,
    displayName: 'Người tạo tham gia lại',
    role: 'member',
    joinedAt: Timestamp.now(),
    invitationId: 'new-invite',
  });
  expect((await change(creator, creator, 'admin')).status).toBe(403);
  expect((await change(successor, creator, 'admin')).status).toBe(200);
});
it('validates role, target, snapshot and actions without touching memberships', async () => {
  const target = await expected(successor);
  expect((await call(creator, 'changeRole', { ...target, role: 'owner' })).status).toBe(400);
  expect((await call(creator, 'changeRole', { ...target, role: ['admin'] })).status).toBe(400);
  const malformedAction = await fetch('http://127.0.0.1:8787/api/memberships', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + creator.token },
    body: JSON.stringify({ clanId, ...target, action: ['remove'] }),
  });
  expect(malformedAction.status).toBe(400);
  expect(
    (await call(creator, 'changeRole', { ...target, role: 'admin', epoch: 'forged' })).status,
  ).toBe(409);
  expect(
    (await call(creator, 'changeRole', { ...target, role: 'admin', version: 99 })).status,
  ).toBe(409);
  expect((await call(creator, 'changeRole', { uid: successor.uid, role: 'admin' })).status).toBe(
    409,
  );
  expect((await call(creator, 'remove', { ...target, uid: '../other' })).status).toBe(400);
  expect((await call(creator, 'create', target)).status).toBe(400);
  expect((await change(creator, creator, 'admin')).data.status).toBe('unchanged');
  expect(await admins()).toEqual([creator.uid]);
});
