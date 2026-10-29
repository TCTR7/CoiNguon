import { spawn, type ChildProcess } from 'node:child_process';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { store } from '../../../../backend/service';
import { blankPerson } from '../../../../src/shared/domain/genealogy';
let server: ChildProcess,
  owner: { uid: string; token: string },
  editor: { uid: string; token: string },
  member: { uid: string; token: string },
  outsider: { uid: string; token: string };
const clanId = 'api-genealogy-tests';
async function account() {
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: crypto.randomUUID() + '@tests.test',
        password: 'local-test-12345',
        returnSecureToken: true,
      }),
    },
  );
  const body = await response.json();
  if (!response.ok) throw new Error('Could not create emulator account');
  return { uid: body.localId as string, token: body.idToken as string };
}
async function call(
  user: typeof owner | null,
  action: string,
  payload: Record<string, unknown> = {},
  clan = clanId,
) {
  const response = await fetch('http://127.0.0.1:8787/api/genealogy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
    },
    body: JSON.stringify({ clanId: clan, action, ...payload }),
  });
  return { status: response.status, data: await response.json() };
}
async function person(id: string) {
  const result = await call(owner, 'createPerson', {
    personId: id,
    person: { ...blankPerson(), name: 'Người ' + id },
  });
  expect(result.status).toBe(200);
  return id;
}
async function relation(from: string, to: string, extra: Record<string, unknown> = {}) {
  return call(owner, 'saveRelation', {
    relationship: {
      from,
      to,
      kind: 'parent',
      parentType: 'biological',
      status: 'current',
      source: 'Dữ liệu mẫu',
      verified: true,
      ...extra,
    },
    version: null,
  });
}
beforeAll(async () => {
  [owner, editor, member, outsider] = await Promise.all([
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
  await store.doc('clans/' + clanId).set({ name: 'Gia đình kiểm thử', ownerUid: owner.uid });
  for (const [user, role] of [
    [owner, 'admin'],
    [editor, 'editor'],
    [member, 'member'],
  ] as const)
    await store
      .doc('memberships/' + clanId + '_' + user.uid)
      .set({ clanId, uid: user.uid, displayName: 'Người thử', role });
});
afterAll(async () => {
  server?.kill();
  await store.recursiveDelete(store.doc('clans/' + clanId));
});
it('requires a valid token and current clan membership for direct API calls', async () => {
  expect((await call(null, 'createPerson')).status).toBe(401);
  expect((await call(outsider, 'createPerson')).status).toBe(403);
  expect((await call(member, 'createPerson')).status).toBe(403);
  expect((await call(owner, 'createPerson', {}, 'foreign-clan')).status).toBe(403);
});
it('validates server-side data and permits editor creation without an account link', async () => {
  const profile = {
    ...blankPerson(),
    name: 'Người thử',
    birth: { day: null, month: null, year: 1965, calendar: 'lunar', leapMonth: false },
  };
  expect(
    (await call(editor, 'createPerson', { personId: 'partial', person: profile })).status,
  ).toBe(200);
  const saved = (await store.doc('clans/' + clanId + '/people/partial').get()).data()!;
  expect(saved.birth).toEqual(profile.birth);
  expect(saved).not.toHaveProperty('uid');
  expect(
    (await call(editor, 'createPerson', { personId: 'bad', person: { ...profile, role: 'admin' } }))
      .status,
  ).toBe(400);
});
it('rejects stale writes and allows exactly one of two edits from the same version', async () => {
  await person('p1');
  const values = await Promise.all(
    ['Sửa một', 'Sửa hai'].map((name) =>
      call(editor, 'updatePerson', {
        personId: 'p1',
        version: 1,
        person: { ...blankPerson(), name },
      }),
    ),
  );
  expect(values.map((v) => v.status).sort()).toEqual([200, 409]);
  expect((await store.doc('clans/' + clanId + '/people/p1').get()).data()!.version).toBe(2);
});
it('rejects self edges, foreign/missing endpoints and reverse ancestry', async () => {
  await person('a');
  await person('b');
  expect((await relation('a', 'a')).status).toBe(400);
  expect((await relation('a', 'missing')).status).toBe(400);
  expect((await relation('a', 'b')).status).toBe(200);
  expect((await relation('b', 'a')).status).toBe(409);
});
it('serializes simultaneous edges that would together introduce a cycle', async () => {
  await person('a');
  await person('b');
  const result = await Promise.all([relation('a', 'b'), relation('b', 'a')]);
  expect(result.map((r) => r.status).sort()).toEqual([200, 409]);
});
it('preserves adoption and remarriage, with stale relationship edits rejected', async () => {
  for (const id of ['a', 'b', 'c']) await person(id);
  const adopt = await relation('a', 'b', { parentType: 'adoptive' });
  expect(adopt.status).toBe(200);
  expect((await relation('a', 'c', { kind: 'spouse', status: 'former' })).status).toBe(200);
  expect((await relation('b', 'c', { kind: 'spouse', status: 'current' })).status).toBe(200);
  const stale = await call(owner, 'saveRelation', {
    relationship: {
      from: 'a',
      to: 'b',
      kind: 'parent',
      parentType: 'biological',
      status: 'current',
      source: 'Dữ liệu mẫu',
      verified: true,
    },
    version: 0,
  });
  expect(stale.status).toBe(409);
});
it('archives without cascade and checks restored relationships against the current graph', async () => {
  await person('a');
  await person('b');
  const original = await relation('a', 'b');
  expect((await call(owner, 'archivePerson', { personId: 'a', version: 1 })).status).toBe(409);
  expect(
    (await call(owner, 'archiveRelation', { relationId: original.data.id, version: 1 })).status,
  ).toBe(200);
  expect((await call(owner, 'archivePerson', { personId: 'a', version: 1 })).status).toBe(200);
  expect((await store.doc('clans/' + clanId + '/people/b').get()).data()!.archived).toBe(false);
  expect((await call(owner, 'restorePerson', { personId: 'a', version: 2 })).status).toBe(200);
  expect((await relation('b', 'a')).status).toBe(200);
  expect(
    (await call(owner, 'restoreRelation', { relationId: original.data.id, version: 2 })).status,
  ).toBe(409);
});
it('keeps a correction as a request rather than letting a member overwrite the profile', async () => {
  await person('a');
  expect(
    (
      await call(member, 'request', {
        personId: 'a',
        kind: 'correction',
        message: 'Xin kiểm tra tên khác',
      })
    ).status,
  ).toBe(200);
  expect((await store.doc('clans/' + clanId + '/people/a').get()).data()!.name).toBe('Người a');
  expect(
    (
      await call(member, 'updatePerson', {
        personId: 'a',
        version: 1,
        person: { ...blankPerson(), name: 'Tên giả' },
      })
    ).status,
  ).toBe(403);
});
it('requires admin approval and prevents two accounts from claiming one profile', async () => {
  await person('a');
  const first = await call(member, 'request', {
    personId: 'a',
    kind: 'claim',
    message: 'Đây là hồ sơ của tôi',
  });
  const second = await call(editor, 'request', {
    personId: 'a',
    kind: 'claim',
    message: 'Xin nhận hồ sơ mẫu này',
  });
  expect(
    (
      await call(member, 'resolveRequest', {
        requestId: first.data.id,
        version: 1,
        decision: 'approve',
        resolution: 'Xác minh mẫu',
      })
    ).status,
  ).toBe(403);
  const results = await Promise.all(
    [first, second].map((r) =>
      call(owner, 'resolveRequest', {
        requestId: r.data.id,
        version: 1,
        decision: 'approve',
        resolution: 'Xác minh mẫu',
      }),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await store.doc('memberships/' + clanId + '_' + member.uid).get()).data()!.role).toBe(
    'member',
  );
});
it('refuses claim approval for a removed member or a deceased profile', async () => {
  await person('a');
  const request = await call(member, 'request', {
    personId: 'a',
    kind: 'claim',
    message: 'Hồ sơ của tôi trong gia đình',
  });
  await store.doc('memberships/' + clanId + '_' + member.uid).delete();
  expect(
    (
      await call(owner, 'resolveRequest', {
        requestId: request.data.id,
        version: 1,
        decision: 'approve',
        resolution: 'Xác minh mẫu',
      })
    ).status,
  ).toBe(409);
  await call(owner, 'updatePerson', {
    personId: 'a',
    version: 1,
    person: { ...blankPerson(), name: 'Người a', lifeStatus: 'deceased' },
  });
  expect(
    (await call(editor, 'request', { personId: 'a', kind: 'claim', message: 'Xin nhận hồ sơ này' }))
      .status,
  ).toBe(400);
});
it('rechecks membership after revocation for every write', async () => {
  await person('a');
  await store.doc('memberships/' + clanId + '_' + editor.uid).delete();
  expect((await call(editor, 'archivePerson', { personId: 'a', version: 1 })).status).toBe(403);
});
