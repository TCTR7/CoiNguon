import { spawn, type ChildProcess } from 'node:child_process';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, store } from '../../../../backend/service';
import { blankPerson } from '../../../../src/shared/domain/genealogy';
import { accountAction } from '../../../../backend/accounts';
type User = { uid: string; token: string; phone: string };
let server: ChildProcess,
  admin: User,
  guest: User,
  outsider: User,
  clanId: string,
  personId: string;
const phone = () =>
  '09' + String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, '0');
async function account(): Promise<User> {
  const res = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: crypto.randomUUID() + '@phone.test',
        password: 'local-test-12345',
        returnSecureToken: true,
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error('Account fixture failed');
  await adminAuth.updateUser(data.localId, { displayName: 'Người mẫu từ Auth' });
  return { uid: data.localId, token: data.idToken, phone: phone() };
}
async function call(user: User | null, path: string, body: Record<string, unknown>) {
  const res = await fetch('http://127.0.0.1:8787/api/' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}
const save = (user: User, number = user.phone, version: number | null = null) =>
  call(user, 'account', { action: 'save', phone: number, displayName: 'Tên mẫu', version });
const invite = (extra: Record<string, unknown> = {}) =>
  call(admin, 'phone-invites', {
    action: 'create',
    clanId,
    personId,
    phone: guest.phone,
    version: null,
    ...extra,
  });
const inbox = (user = guest) => call(user, 'phone-invites', { action: 'inbox' });
async function respond(id: string) {
  return call(guest, 'phone-invites', {
    action: 'respond',
    id,
    version: 1,
    decision: 'accept',
    displayName: 'Giả mạo',
  });
}
const review = (id: string, extra: Record<string, unknown> = {}) =>
  call(admin, 'phone-invites', {
    action: 'review',
    id,
    version: 2,
    decision: 'approve',
    confirmed: true,
    ...extra,
  });
beforeAll(async () => {
  server = spawn(process.execPath, ['--experimental-strip-types', 'backend/server.ts'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    server.stdout!.on('data', (c) => {
      if (String(c).includes('Genealogy API local')) resolve();
    });
    server.on('error', reject);
    server.on('exit', (code) => reject(new Error('API exited ' + code)));
  });
});
afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise<void>((resolve) => server.once('exit', () => resolve()));
  }
});
beforeEach(async () => {
  [admin, guest, outsider] = await Promise.all([account(), account(), account()]);
  clanId = 'phone-' + crypto.randomUUID();
  personId = 'living';
  expect((await save(admin)).status).toBe(200);
  await store.doc('clans/' + clanId).set({ name: 'Tên gia phả bí mật', ownerUid: admin.uid });
  await store.doc('memberships/' + clanId + '_' + admin.uid).set({
    clanId,
    uid: admin.uid,
    role: 'admin',
    displayName: 'Admin mẫu',
    joinedAt: Timestamp.now(),
    invitationId: null,
  });
  await store.doc('clans/' + clanId + '/people/' + personId).set({
    ...blankPerson(),
    name: 'Tên người bí mật',
    lifeStatus: 'living',
    archived: false,
    version: 1,
  });
});
it('requires authentication/onboarding and never trusts a client uid', async () => {
  expect((await call(null, 'account', { action: 'get' })).status).toBe(401);
  expect((await inbox()).status).toBe(403);
  expect(
    (
      await call(guest, 'phone-invites', {
        action: 'create',
        clanId,
        personId,
        phone: guest.phone,
        version: null,
        uid: admin.uid,
      })
    ).status,
  ).toBe(403);
  expect((await save(guest, 'bad')).status).toBe(400);
});
it('allows only one claimant across local/+84 formats and concurrent registrations', async () => {
  const results = await Promise.all([save(guest), save(outsider, '+84' + guest.phone.slice(1))]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const failure = results.find((r) => r.status === 409)!;
  expect(JSON.stringify(failure.data)).not.toContain(guest.uid);
});
it('delivers pre-registration invitations with minimal DTO and grants nothing until approval', async () => {
  const created = await invite();
  expect(created.status).toBe(200);
  expect((await save(guest)).status).toBe(200);
  const data = (await inbox()).data.items;
  expect(data).toEqual([{ id: created.data.id, status: 'pending', version: 1 }]);
  expect(JSON.stringify(data)).not.toContain(clanId);
  expect((await store.doc('memberships/' + clanId + '_' + guest.uid).get()).exists).toBe(false);
  expect((await review(created.data.id)).status).toBe(409);
  expect((await respond(created.data.id)).status).toBe(200);
  const roster = await call(admin, 'phone-invites', { action: 'list', clanId });
  expect(roster.data.items[0].recipient.name).toBe('Người mẫu từ Auth');
  expect((await review(created.data.id, { confirmed: false })).status).toBe(400);
  expect((await review(created.data.id)).status).toBe(200);
  expect((await store.doc('memberships/' + clanId + '_' + guest.uid).get()).data()!.role).toBe(
    'member',
  );
  expect((await store.doc('clans/' + clanId + '/personLinks/' + personId).get()).data()!.uid).toBe(
    guest.uid,
  );
});
it('delivers post-registration invitations, scopes admin access and preserves existing roles', async () => {
  await save(guest);
  await save(outsider);
  const created = await invite();
  expect((await inbox(outsider)).data.items).toEqual([]);
  expect((await call(outsider, 'phone-invites', { action: 'list', clanId })).status).toBe(403);
  expect(
    (
      await call(outsider, 'phone-invites', {
        action: 'respond',
        id: created.data.id,
        version: 1,
        decision: 'accept',
      })
    ).status,
  ).toBe(403);
  const memberRef = store.doc('memberships/' + clanId + '_' + guest.uid);
  await memberRef.set({
    clanId,
    uid: guest.uid,
    role: 'editor',
    joinedAt: Timestamp.fromMillis(1234),
    invitationId: 'existing',
  });
  await respond(created.data.id);
  await review(created.data.id);
  expect((await memberRef.get()).data()).toMatchObject({
    role: 'editor',
    invitationId: 'existing',
  });
});
it('makes duplicate responses and parallel approvals idempotent without restoring removed access', async () => {
  await save(guest);
  const created = await invite();
  expect((await respond(created.data.id)).status).toBe(200);
  expect((await respond(created.data.id)).status).toBe(200);
  const results = await Promise.all([review(created.data.id), review(created.data.id)]);
  expect(results.every((r) => r.status === 200)).toBe(true);
  const ref = store.doc('memberships/' + clanId + '_' + guest.uid);
  await ref.delete();
  await review(created.data.id);
  expect((await ref.get()).exists).toBe(false);
});
it('never transfers old invitations to a later owner of the same phone', async () => {
  await save(guest);
  const created = await invite();
  await respond(created.data.id);
  const old = guest.phone;
  expect((await save(guest, phone(), 1)).status).toBe(200);
  expect((await save(outsider, old)).status).toBe(200);
  expect((await inbox(outsider)).data.items).toEqual([]);
  expect((await review(created.data.id)).status).toBe(409);
  expect(
    (await call(admin, 'phone-invites', { action: 'list', clanId })).data.items[0].status,
  ).toBe('stale');
});
it('invalidates pending invites even if the same user claims the original number again', async () => {
  await save(guest);
  const created = await invite();
  const old = guest.phone;
  await save(guest, phone(), 1);
  await save(guest, old, 2);
  expect((await inbox()).data.items).toEqual([]);
  expect((await respond(created.data.id)).status).toBe(403);
});
it('does not create invitations just by saving a contact', async () => {
  expect(
    (
      await call(admin, 'phone-invites', {
        action: 'contact',
        clanId,
        personId,
        phone: guest.phone,
      })
    ).status,
  ).toBe(200);
  await save(guest);
  expect((await inbox()).data.items).toEqual([]);
});
it('rejects archived/deceased profiles, lost admin authority, revoked and stale versions', async () => {
  await save(guest);
  const ref = store.doc('clans/' + clanId + '/people/' + personId);
  await ref.update({ lifeStatus: 'deceased' });
  expect((await invite()).status).toBe(409);
  await ref.update({ lifeStatus: 'living' });
  const created = await invite();
  await respond(created.data.id);
  await store.doc('memberships/' + clanId + '_' + admin.uid).update({ role: 'member' });
  expect((await review(created.data.id)).status).toBe(403);
  await store
    .doc('memberships/' + clanId + '_' + admin.uid)
    .update({ role: 'admin', managementVersion: 2 });
  expect((await review(created.data.id)).status).toBe(409);
  expect(
    (await call(admin, 'phone-invites', { action: 'revoke', id: created.data.id, version: 2 }))
      .status,
  ).toBe(200);
  expect((await respond(created.data.id)).status).toBe(409);
});
it('does not overwrite a competing person link', async () => {
  await save(guest);
  const created = await invite();
  await respond(created.data.id);
  await store
    .doc('clans/' + clanId + '/personLinks/' + personId)
    .set({ uid: outsider.uid, personId });
  expect((await review(created.data.id)).status).toBe(409);
  expect((await store.doc('memberships/' + clanId + '_' + guest.uid).get()).exists).toBe(false);
});
it('requires recent authentication and rejects stale account updates without losing the old phone', async () => {
  await save(guest);
  await expect(
    accountAction(
      guest.uid,
      { action: 'save', phone: phone(), displayName: 'Tên mẫu', version: 1 },
      0,
    ),
  ).rejects.toMatchObject({ status: 401 });
  expect((await call(guest, 'account', { action: 'get' })).data.account.phone).toBe(
    '+84' + guest.phone.slice(1),
  );
  expect((await save(guest, phone(), 99)).status).toBe(409);
});
it('paginates the inbox without exposing clan or profile fields', async () => {
  await save(guest);
  const created = await invite();
  const original = (await store.doc('membershipInvites/' + created.data.id).get()).data()!;
  const batch = store.batch();
  for (let i = 0; i < 24; i++)
    batch.set(store.doc('membershipInvites/paged-' + crypto.randomUUID()), original);
  await batch.commit();
  const first = await inbox();
  expect(first.data.items).toHaveLength(20);
  expect(first.data.cursor).toBeTruthy();
  const second = await call(guest, 'phone-invites', { action: 'inbox', cursor: first.data.cursor });
  expect(second.data.items).toHaveLength(5);
  expect(second.data.cursor).toBeNull();
  expect(
    new Set([...first.data.items, ...second.data.items].map((i: { id: string }) => i.id)).size,
  ).toBe(25);
  expect(JSON.stringify(first.data)).not.toContain(clanId);
});
it('a revoked invite or a profile archived after response cannot be approved', async () => {
  await save(guest);
  const created = await invite();
  await respond(created.data.id);
  await store.doc('clans/' + clanId + '/people/' + personId).update({ archived: true });
  expect((await review(created.data.id)).status).toBe(409);
  expect(
    (await call(admin, 'phone-invites', { action: 'revoke', id: created.data.id, version: 2 }))
      .status,
  ).toBe(200);
  expect((await review(created.data.id)).status).toBe(409);
});
it('routes a legacy link through admin approval and member-only rights', async () => {
  await save(guest);
  const token = 'a'.repeat(64);
  await store.doc('invitations/' + token).set({
    clanId,
    clanName: 'Tên gia phả bí mật',
    role: 'editor',
    createdBy: admin.uid,
    revoked: false,
    acceptedBy: null,
    expiresAt: Timestamp.fromMillis(Date.now() + 60000),
  });
  const submitted = await call(guest, 'join', { action: 'submitPrivate', token });
  expect(submitted.status).toBe(200);
  expect((await store.doc('memberships/' + clanId + '_' + guest.uid).get()).exists).toBe(false);
  expect(
    (
      await call(admin, 'join', {
        action: 'review',
        clanId,
        uid: guest.uid,
        version: 1,
        decision: 'approve',
      })
    ).status,
  ).toBe(200);
  expect((await store.doc('memberships/' + clanId + '_' + guest.uid).get()).data()!.role).toBe(
    'member',
  );
});
it('serializes revocation against approval without partial membership/link writes', async () => {
  await save(guest);
  const created = await invite();
  await respond(created.data.id);
  const outcomes = await Promise.all([
    review(created.data.id),
    call(admin, 'phone-invites', { action: 'revoke', id: created.data.id, version: 2 }),
  ]);
  expect(outcomes.map((result) => result.status).sort()).toEqual([200, 409]);
  const state = (await store.doc('membershipInvites/' + created.data.id).get()).data()!.status;
  const member = await store.doc('memberships/' + clanId + '_' + guest.uid).get();
  const link = await store.doc('clans/' + clanId + '/personLinks/' + personId).get();
  expect(member.exists).toBe(state === 'approved');
  expect(link.exists).toBe(state === 'approved');
});
it('supports a second clan without exposing either clan in the unapproved inbox', async () => {
  await save(guest);
  await invite();
  const otherClan = 'other-' + crypto.randomUUID();
  await store.doc('clans/' + otherClan).set({ name: 'Gia phả khác', ownerUid: admin.uid });
  await store
    .doc('memberships/' + otherClan + '_' + admin.uid)
    .set({ clanId: otherClan, uid: admin.uid, role: 'admin' });
  await store
    .doc('clans/' + otherClan + '/people/' + personId)
    .set({ ...blankPerson(), lifeStatus: 'living', archived: false });
  const other = await invite({ clanId: otherClan });
  expect(other.status).toBe(200);
  const result = await inbox();
  expect(result.data.items).toHaveLength(2);
  expect(JSON.stringify(result.data)).not.toContain(clanId);
  expect(JSON.stringify(result.data)).not.toContain(otherClan);
});
