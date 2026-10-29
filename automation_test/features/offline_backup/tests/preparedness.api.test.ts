import { request as httpRequest } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { store } from '../../../../backend/service';
import { mutateData, snapshot } from '../../../../backend/data';
import { mutateReminders, runReminderTick } from '../../../../backend/reminders';
import { portableFixture } from '../../../common_setup/fixtures/portable';
const clanId = 'preparedness-api-tests',
  b = 'clans/' + clanId + '/',
  admin = 'prep-admin',
  member = 'prep-member',
  eventId = 'p0_2090';
const due = Date.parse('2089-12-25T02:00:00Z');
const targetIds = new Set<string>();
const memberRef = (uid: string) => store.doc('memberships/' + clanId + '_' + uid);
let server: ChildProcess;
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
beforeEach(async () => {
  await store.recursiveDelete(store.doc('clans/' + clanId));
  await store.doc('clans/' + clanId).set({ name: 'Gia phả dữ liệu giả', ownerUid: admin });
  for (const [uid, role] of [
    [admin, 'admin'],
    [member, 'member'],
  ])
    await memberRef(uid).set({
      uid,
      clanId,
      role,
      displayName: 'Người thử',
      joinedAt: Timestamp.fromMillis(1000),
      invitationId: null,
    });
  const data = portableFixture();
  for (const [collection, rows] of [
    ['people', data.people],
    ['relationships', data.relationships],
    ['anniversaryRules', data.rules],
    ['events', data.events],
  ] as const)
    for (const { id, ...fields } of rows) await store.doc(b + collection + '/' + id).set(fields);
  await store
    .doc(b + 'events/' + eventId)
    .update({ reminderRevisionAt: Timestamp.fromMillis(due - 86400000) });
  await store.doc(b + 'assignments/p0').set({ hostUid: admin, hostEpoch: '1000:', version: 1 });
});
afterAll(async () => {
  if (server) {
    const stopped = new Promise<void>((r) => server.once('exit', () => r()));
    server.kill();
    await stopped;
  }

  await store.recursiveDelete(store.doc('clans/' + clanId));
  for (const uid of [admin, member]) await memberRef(uid).delete();
  for (const target of targetIds) {
    await store.recursiveDelete(store.doc('clans/' + target));
    await store.doc('memberships/' + target + '_' + admin).delete();
  }
  const sessions = await store.collection('restoreSessions').where('uid', '==', admin).get();
  for (const doc of sessions.docs) await doc.ref.delete();
});
const request = (uid: string, action: string, extra: Record<string, unknown> = {}) =>
  mutateData(uid, { clanId, action, ...extra });
const remind = (uid: string, action: string, extra: Record<string, unknown> = {}) =>
  mutateReminders(uid, { clanId, action, ...extra });
const tick = (now = due) => runReminderTick({ clanId, now });
it('only members download and only admins export/restore; download excludes credentials and all access metadata', async () => {
  await expect(request('outsider', 'download')).rejects.toMatchObject({ status: 403 });
  await expect(request('outsider', 'download', { clanId: 'unknown' })).rejects.toMatchObject({
    status: 403,
  });
  await expect(request(member, 'export')).rejects.toMatchObject({ status: 403 });
  await expect(
    request(member, 'previewRestore', { data: portableFixture() }),
  ).rejects.toMatchObject({ status: 403 });
  await store
    .doc(b + 'events/' + eventId)
    .update({ delegateUid: 'secret-account', delegateEpoch: 'secret-epoch' });
  await store.doc(b + 'people/p0').update({ secretToken: 'secret-token' });
  const result = await request(member, 'download');
  expect(result).toMatchObject({ uid: member, clanId, membershipEpoch: '1000:' });
  expect(JSON.stringify(result)).not.toMatch(
    /secret-|delegateUid|ownerUid|guestTokens|memberships/,
  );
});
it('rejects a forged imported role and invalid graph before any restore staging', async () => {
  await expect(
    request(admin, 'previewRestore', {
      data: { ...portableFixture(), memberships: [{ role: 'admin' }] },
    }),
  ).rejects.toMatchObject({ status: 400 });
  const data = portableFixture();
  data.relationships[0].to = 'missing';
  await expect(
    request(admin, 'restore', {
      data,
      operationId: crypto.randomUUID(),
      name: 'Thử riêng',
      confirm: true,
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it('restores into an isolated clan idempotently with original dates/relations, draft events and exactly one admin', async () => {
  const exported = await request(admin, 'export');
  const input = {
    data: exported,
    operationId: crypto.randomUUID(),
    name: 'Gia phả khôi phục thử',
    confirm: true,
  };
  const result = (await request(admin, 'restore', input)) as { clanId: string };
  targetIds.add(result.clanId);
  expect(result.clanId).toMatch(/^restore_/);
  expect(await request(admin, 'restore', input)).toEqual(result);
  const restored = (await snapshot(admin, result.clanId)).data;
  expect(restored.people).toEqual(portableFixture().people);
  expect(restored.relationships).toEqual(portableFixture().relationships);
  expect(restored.rules).toEqual(portableFixture().rules);
  expect(restored.events[0]).toMatchObject({
    ...portableFixture().events[0],
    status: 'draft',
    dateConfirmed: false,
  });
  const members = await store.collection('memberships').where('clanId', '==', result.clanId).get();
  expect(members.docs.map((d) => d.data())).toMatchObject([{ uid: admin, role: 'admin' }]);
  expect((await store.doc('clans/' + result.clanId + '/assignments/p0').get()).exists).toBe(false);
  expect((await store.doc(b + 'events/' + eventId).get()).data()?.status).toBe('published');
  await expect(request(admin, 'restore', { ...input, name: 'Tên khác' })).rejects.toMatchObject({
    status: 409,
  });
  await memberRef(admin).delete();
  await expect(request(admin, 'restore', input)).rejects.toMatchObject({ status: 403 });
});
it('round-trips 1,000 synthetic profiles and 999 relationships through chunked restore and export', async () => {
  const data = portableFixture(1000),
    start = performance.now();
  const result = (await request(admin, 'restore', {
    data,
    operationId: crypto.randomUUID(),
    name: 'Thử tải một nghìn',
    confirm: true,
  })) as { clanId: string };
  targetIds.add(result.clanId);
  const restored = (await snapshot(admin, result.clanId)).data;
  expect(restored.people.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
    data.people.sort((a, b) => a.id.localeCompare(b.id)),
  );
  expect(restored.relationships.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
    data.relationships.sort((a, b) => a.id.localeCompare(b.id)),
  );
  console.log(
    'Synthetic 1000 restore + export (emulator): ' + Math.round(performance.now() - start) + ' ms',
  );
}, 60000);
it('deduplicates concurrent scans and generates distinct 7/3-day milestones per current recipient', async () => {
  await Promise.all([tick(), tick()]);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(2);
  await tick(due + 4 * 86400000);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(4);
  const list = (await remind(member, 'list')) as { items: { id: string; read: boolean }[] };
  expect(list.items).toHaveLength(2);
  await remind(member, 'read', { id: list.items[0].id });
  expect(((await remind(member, 'list')) as typeof list).items.filter((i) => i.read)).toHaveLength(
    1,
  );
  await expect(remind(admin, 'read', { id: list.items[0].id })).rejects.toMatchObject({
    status: 403,
  });
});
it('retries a failed delivery without duplicates and exposes final failures to admin only', async () => {
  await memberRef(member).delete();
  const fail = vi.fn(async () => {
    throw new Error('synthetic failure');
  });
  for (const now of [due, due + 60000, due + 360000]) await runReminderTick({ clanId, now, fail });
  expect(fail).toHaveBeenCalledTimes(3);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(0);
  const status = (await remind(admin, 'status')) as { counts: Record<string, number> };
  expect(status.counts.failed).toBe(1);
  await tick(due + 400000);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(0);
  await expect(remind('outsider', 'status')).rejects.toMatchObject({ status: 403 });
});
it('does not retry before its due time and recovers a failed attempt only once', async () => {
  await memberRef(member).delete();
  await runReminderTick({
    clanId,
    now: due,
    fail: async () => {
      throw new Error('once');
    },
  });
  await tick(due + 1000);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(0);
  await tick(due + 60000);
  await tick(due + 60001);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(1);
});
it.each([
  { dateConfirmed: false },
  { status: 'cancelled' },
  { status: 'draft' },
  { reminderRevisionAt: Timestamp.fromMillis(due + 1) },
])('does not create reminders for ineligible event %j', async (patch) => {
  await store.doc(b + 'events/' + eventId).update(patch);
  await tick(due + 1000);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(0);
});
it('invalidates old inbox on date revision and cancelled events; rejects removed members', async () => {
  await tick();
  await store.doc(b + 'events/' + eventId).update({
    reminderRevision: 2,
    reminderRevisionAt: Timestamp.fromMillis(due + 1),
    scheduledDate: '2090-01-02',
    startsAtUTC: '2090-01-02T03:00:00Z',
  });
  expect(await remind(member, 'list')).toEqual({ items: [] });
  await tick(due + 86400000);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(4);
  await store.doc(b + 'events/' + eventId).update({ status: 'cancelled' });
  expect(await remind(member, 'list')).toEqual({ items: [] });
  await memberRef(member).delete();
  await expect(remind(member, 'list')).rejects.toMatchObject({ status: 403 });
  await expect(request(member, 'validate')).rejects.toMatchObject({ status: 403 });
});
it('checks membership again between lease claim and delivery, including leave-and-rejoin epoch', async () => {
  await memberRef(admin).delete();
  await store.doc(b + 'assignments/p0').update({ hostUid: member, hostEpoch: '1000:' });
  let reached = false;
  await runReminderTick({
    clanId,
    now: due,
    fail: async () => {
      reached = true;
      await memberRef(member).update({ joinedAt: Timestamp.fromMillis(2000) });
    },
  });
  expect(reached).toBe(true);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(0);
  await memberRef(member).update({ joinedAt: Timestamp.fromMillis(1000) });
  await store.doc(b + 'events/' + eventId).update({ reminderRevision: 2 });
  reached = false;
  await runReminderTick({
    clanId,
    now: due,
    fail: async () => {
      reached = true;
      await memberRef(member).delete();
    },
  });
  expect(reached).toBe(true);
  expect((await store.collection(b + 'reminderInbox').get()).size).toBe(0);
});
it('members cannot trigger worker runs or see worker diagnostics', async () => {
  await expect(remind(member, 'status')).rejects.toMatchObject({ status: 403 });
  await expect(remind(member, 'run', { now: due })).rejects.toMatchObject({ status: 403 });
});

it('HTTP data/reminder routes verify bearer tokens and return no-store responses', async () => {
  for (const endpoint of ['data', 'reminders']) {
    const missing = await fetch('http://127.0.0.1:8787/api/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clanId, action: 'download' }),
    });
    expect(missing.status).toBe(401);
    expect(missing.headers.get('Cache-Control')).toBe('no-store');
  }
  const signup = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: crypto.randomUUID() + '@preparedness.test',
        password: 'local-test-12345',
        returnSecureToken: true,
      }),
    },
  );
  const account = await signup.json();
  expect(signup.ok).toBe(true);
  const call = (path: string, action: string) =>
    fetch('http://127.0.0.1:8787/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + account.idToken },
      body: JSON.stringify({ clanId, action }),
    });
  expect((await call('data', 'download')).status).toBe(403);
  await memberRef(account.localId).set({
    uid: account.localId,
    clanId,
    role: 'member',
    displayName: 'Người thử HTTP',
    joinedAt: Timestamp.fromMillis(1000),
    invitationId: null,
  });
  try {
    const downloaded = await call('data', 'download');
    expect(downloaded.status).toBe(200);
    expect((await downloaded.json()).people).toHaveLength(2);
    expect((await call('reminders', 'list')).status).toBe(200);
    expect((await call('reminders', 'run')).status).toBe(403);
    await memberRef(account.localId).update({ role: 'admin' });
    const data = portableFixture(1000);
    const payload = Buffer.from(JSON.stringify({ clanId, action: 'previewRestore', data }));
    expect(payload.length).toBeGreaterThan(32768);
    const split = payload.indexOf(Buffer.from('ữ')) + 1;
    expect(split).toBeGreaterThan(0);
    const result = await new Promise<{
      status: number;
      data: { clanName: string; people: number };
    }>((resolve, reject) => {
      const req = httpRequest(
        'http://127.0.0.1:8787/api/data',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + account.idToken,
            'Content-Length': payload.length,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('error', reject);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode!,
                data: JSON.parse(Buffer.concat(chunks).toString('utf8')),
              });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on('error', reject);
      req.write(payload.subarray(0, split));
      // Force a multibyte Vietnamese character across separate network reads.
      setTimeout(() => req.end(payload.subarray(split)), 30);
    });
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ clanName: data.clanName, people: 1000 });
  } finally {
    await memberRef(account.localId).delete();
  }
});
