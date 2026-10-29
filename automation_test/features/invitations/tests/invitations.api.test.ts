import { spawn, type ChildProcess } from 'node:child_process';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { store } from '../../../../backend/service';
import { blankPerson } from '../../../../src/shared/domain/genealogy';
type User = { uid: string; token: string };
let server: ChildProcess, admin: User, host: User, delegate: User, outsider: User;
const clanId = 'invitations-api-tests',
  eventId = 'p_2090',
  base = 'clans/' + clanId + '/';
const death = { day: 1, month: 1, year: 2000, calendar: 'solar', leapMonth: false };
async function account(): Promise<User> {
  const res = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: crypto.randomUUID() + '@invite.test',
        password: 'local-invitation-123',
        returnSecureToken: true,
      }),
    },
  );
  const d = await res.json();
  if (!res.ok) throw new Error('Emulator account failed');
  return { uid: d.localId, token: d.idToken };
}
async function call(user: User | null, action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('http://127.0.0.1:8787/api/invitations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
    },
    body: JSON.stringify({ clanId, eventId, eventVersion: 1, action, ...payload }),
  });
  return { status: res.status, data: await res.json() };
}
async function guest(action: string, payload: Record<string, unknown>) {
  const res = await fetch('http://127.0.0.1:8787/api/guest/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return {
    status: res.status,
    data: await res.json(),
    cache: res.headers.get('Cache-Control'),
    referrer: res.headers.get('Referrer-Policy'),
  };
}
const preview = (token: string) => guest('preview', { token });
async function board() {
  const result = await call(admin, 'dashboard');
  expect(result.status).toBe(200);
  return result.data;
}
async function publish(extra: Record<string, unknown> = {}) {
  return call(admin, 'publishCard', {
    version: null,
    title: 'Ngày sum họp mẫu',
    message: 'Cùng về tưởng nhớ người thân.',
    contact: 'Ban tổ chức mẫu',
    consent: true,
    ...extra,
  });
}
async function group(label = 'Gia đình bác An') {
  if (!(await store.doc(base + 'invitationSettings/' + eventId).get()).exists)
    expect((await publish()).status).toBe(200);
  const id = crypto.randomUUID();
  expect((await call(host, 'createGroup', { label, operationId: id })).status).toBe(200);
  return (await board()).groups.find((g: { id: string }) => g.id === id);
}
async function input(token: string, extra: Record<string, unknown> = {}) {
  const p = await preview(token);
  expect(p.status).toBe(200);
  return {
    token,
    status: 'attending',
    adults: 3,
    children: 1,
    note: 'Nhóm dữ liệu mẫu',
    eventVersion: p.data.eventVersion,
    cardVersion: p.data.cardVersion,
    responseVersion: p.data.group?.responseVersion ?? 0,
    operationId: crypto.randomUUID(),
    ...extra,
  };
}
beforeAll(async () => {
  [admin, host, delegate, outsider] = await Promise.all([
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
  const tokens = await store.collection('guestTokens').where('clanId', '==', clanId).get();
  for (const d of tokens.docs) await d.ref.delete();
  await store
    .doc('clans/' + clanId)
    .set({ name: 'Gia phả nội bộ không công khai', ownerUid: admin.uid });
  for (const [user, role] of [
    [admin, 'admin'],
    [host, 'member'],
    [delegate, 'editor'],
  ] as const)
    await store.doc('memberships/' + clanId + '_' + user.uid).set({
      uid: user.uid,
      clanId,
      displayName: 'Thành viên mẫu',
      role,
      joinedAt: Timestamp.fromMillis(1000),
      invitationId: null,
    });
  await store
    .doc('memberships/other_' + outsider.uid)
    .set({ clanId: 'other', uid: outsider.uid, role: 'admin' });
  await store.doc(base + 'people/p').set({
    ...blankPerson(),
    name: 'Tên riêng bí mật',
    death,
    lifeStatus: 'deceased',
    archived: false,
  });
  await store.doc(base + 'anniversaryRules/p').set({
    calendar: 'solar',
    leapPolicy: 'unset',
    missingDayPolicy: 'unset',
    sourceDate: death,
    version: 1,
  });
  await store
    .doc(base + 'assignments/p')
    .set({ hostUid: host.uid, hostEpoch: '1000:', version: 1 });
  await store.doc(base + 'events/' + eventId).set({
    personId: 'p',
    personName: 'Tên riêng bí mật',
    year: 2090,
    status: 'published',
    version: 1,
    reminderRevision: 1,
    dateConfirmed: true,
    sourceDate: death,
    ruleVersion: 1,
    anniversaryDate: '2090-01-01',
    confirmationNote: '',
    scheduledDate: '2090-01-01',
    scheduledTime: '10:00',
    timeZone: 'Asia/Ho_Chi_Minh',
    startsAtUTC: '2090-01-01T03:00:00Z',
    rsvpDeadlineLocal: '2089-12-31T18:00',
    deadlineAtUTC: '2089-12-31T11:00:00Z',
    address: 'Địa chỉ sự kiện được đồng ý công bố',
    invitationText: '',
    delegateUid: '',
    delegateEpoch: '',
    delegateAssignmentVersion: 0,
  });
});
afterAll(async () => {
  if (server) {
    const exit = new Promise<void>((resolve) => server.once('exit', () => resolve()));
    server.kill();
    await exit;
  }
  await store.recursiveDelete(store.doc('clans/' + clanId));
});
it('requires current event authority; ordinary editors and another clan admin cannot manage guest lists', async () => {
  expect((await call(null, 'dashboard')).status).toBe(401);
  expect((await call(delegate, 'dashboard')).status).toBe(403);
  expect((await call(outsider, 'dashboard')).status).toBe(403);
  expect((await call(outsider, 'dashboard', { eventId: 'unknown-event' })).status).toBe(403);
  expect((await call(host, 'dashboard')).status).toBe(200);
});
it('requires explicit publication consent, a current version and a confirmed published event', async () => {
  expect((await publish({ consent: false })).status).toBe(400);
  expect((await publish({ eventVersion: 0 })).status).toBe(409);
  await store.doc(base + 'events/' + eventId).update({ dateConfirmed: false });
  expect((await publish()).status).toBe(409);
  await store.doc(base + 'events/' + eventId).update({ dateConfirmed: true, status: 'draft' });
  expect((await publish()).status).toBe(409);
  expect(
    (await call(host, 'createGroup', { label: 'Nhóm thử', operationId: crypto.randomUUID() }))
      .status,
  ).toBe(409);
});
it('public view contains only the approved card and no family profiles, membership or household data', async () => {
  await group('Hộ bí mật khác');
  const d = await board(),
    result = await preview(d.card.publicToken);
  expect(result.status).toBe(200);
  expect(result.cache).toBe('no-store');
  expect(result.referrer).toBe('no-referrer');
  expect(result.data.group).toBeNull();
  expect(result.data.canRespond).toBe(false);
  expect(Object.keys(result.data.card).sort()).toEqual([
    'address',
    'contact',
    'date',
    'deadline',
    'deadlineAtUTC',
    'message',
    'status',
    'time',
    'timeZone',
    'title',
  ]);
  expect(JSON.stringify(result.data)).not.toContain('Tên riêng bí mật');
  expect(JSON.stringify(result.data)).not.toContain('Hộ bí mật khác');
  expect(JSON.stringify(result.data)).not.toContain(admin.uid);
  expect(JSON.stringify(result.data)).not.toContain('ownerUid');
  expect((await guest('respond', await input(d.card.publicToken))).status).toBe(403);
});
it('a private link can read and edit only its own household even with forged IDs', async () => {
  const a = await group('Hộ một'),
    b = await group('Hộ hai');
  const p = await preview(a.token);
  expect(p.data.group.label).toBe('Hộ một');
  expect(JSON.stringify(p.data)).not.toContain('Hộ hai');
  expect(
    (
      await guest(
        'respond',
        await input(a.token, { groupId: b.id, clanId: 'other', role: 'admin' }),
      )
    ).status,
  ).toBe(200);
  const d = await board();
  expect(d.groups.find((g: { id: string }) => g.id === b.id).response.status).toBe('pending');
  expect(d.totals.people).toBe(4);
});
it('replaces a household response from four to three people; retries never add to totals', async () => {
  const g = await group(),
    first = await input(g.token);
  expect((await guest('respond', first)).status).toBe(200);
  expect((await guest('respond', first)).status).toBe(200);
  expect((await board()).totals.people).toBe(4);
  expect((await guest('respond', await input(g.token, { adults: 2, children: 1 }))).status).toBe(
    200,
  );
  const d = await board();
  expect(d.totals).toMatchObject({
    invited: 1,
    responded: 1,
    attending: 1,
    pending: 0,
    adults: 2,
    children: 1,
    people: 3,
  });
});
it('serializes simultaneous responses for one household and rejects older versions', async () => {
  const g = await group(),
    first = await input(g.token);
  const results = await Promise.all([
    guest('respond', first),
    guest('respond', { ...first, operationId: crypto.randomUUID(), adults: 1, children: 0 }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await board()).totals.responded).toBe(1);
  expect((await guest('respond', { ...first, operationId: crypto.randomUUID() })).status).toBe(409);
});
it('detects reuse of an idempotency key for different content', async () => {
  const g = await group(),
    first = await input(g.token);
  expect((await guest('respond', first)).status).toBe(200);
  expect((await guest('respond', { ...first, adults: 2 })).status).toBe(409);
  expect((await board()).totals.people).toBe(4);
});
it('validates counts, status and note at the API boundary', async () => {
  const g = await group(),
    first = await input(g.token);
  for (const changes of [
    { adults: -1 },
    { children: 1.5 },
    { adults: '3' },
    { adults: 0, children: 0 },
    { adults: 500, children: 1 },
    { status: ['attending'] },
    { note: 'x'.repeat(501) },
    { status: 'declined', adults: 1, children: 0 },
  ])
    expect((await guest('respond', { ...first, ...changes })).status).toBe(400);
  expect((await board()).totals.people).toBe(0);
});
it('tracks declined and unanswered groups independently', async () => {
  const a = await group('Hộ từ chối');
  await group('Hộ chưa trả lời');
  expect(
    (await guest('respond', await input(a.token, { status: 'declined', adults: 0, children: 0 })))
      .status,
  ).toBe(200);
  expect((await board()).totals).toMatchObject({
    invited: 2,
    responded: 1,
    declined: 1,
    pending: 1,
    people: 0,
  });
});
it('revocation and reissue block old links while preserving the response and group count', async () => {
  const g = await group();
  await guest('respond', await input(g.token));
  expect((await call(host, 'revokeGroup', { groupId: g.id, version: g.version })).status).toBe(200);
  expect((await preview(g.token)).status).toBe(404);
  expect(
    (await guest('respond', { ...(await input((await board()).card.publicToken)), token: g.token }))
      .status,
  ).toBe(404);
  expect((await call(host, 'rotateGroup', { groupId: g.id, version: 2 })).status).toBe(200);
  const current = (await board()).groups[0];
  expect(current.token).not.toBe(g.token);
  expect((await preview(current.token)).data.group.response.adults).toBe(3);
  expect((await preview(g.token)).status).toBe(404);
  expect((await board()).totals).toMatchObject({ invited: 1, people: 4 });
});
it('public-view link rotation is separate from private household capabilities', async () => {
  const g = await group(),
    old = (await board()).card;
  expect((await call(host, 'rotatePublic', { version: old.version })).status).toBe(200);
  expect((await preview(old.publicToken)).status).toBe(404);
  expect((await preview(g.token)).status).toBe(200);
  const current = (await board()).card;
  expect((await call(host, 'revokePublic', { version: current.version })).status).toBe(200);
  expect((await preview(current.publicToken)).status).toBe(404);
  expect((await preview(g.token)).status).toBe(200);
});
it('expired and unknown links cannot read or submit, regardless of supplied expiry fields', async () => {
  const g = await group();
  await store
    .doc(base + 'events/' + eventId)
    .update({ startsAtUTC: new Date(Date.now() - 8 * 86400000).toISOString() });
  expect((await preview(g.token)).status).toBe(404);
  expect(
    (
      await guest('respond', {
        token: g.token,
        status: 'attending',
        adults: 1,
        children: 0,
        note: '',
        operationId: crypto.randomUUID(),
        expiresAtMs: 999999999999999,
      })
    ).status,
  ).toBe(404);
  expect((await preview('a'.repeat(64))).status).toBe(404);
  expect((await preview('../wrong')).status).toBe(404);
});
it('withdrawing the card closes every kind of link', async () => {
  const g = await group(),
    card = (await board()).card;
  expect((await call(host, 'withdrawCard', { version: card.version })).status).toBe(200);
  expect((await preview(g.token)).status).toBe(404);
  expect((await preview(card.publicToken)).status).toBe(404);
});
it('rescheduling updates the card and blocks a response made against the old schedule', async () => {
  const g = await group(),
    old = await input(g.token);
  await store
    .doc(base + 'events/' + eventId)
    .update({ scheduledDate: '2090-01-02', startsAtUTC: '2090-01-02T03:00:00Z', version: 2 });
  expect((await preview(g.token)).data.card.date).toBe('2090-01-02');
  expect((await guest('respond', old)).status).toBe(409);
  expect((await guest('respond', await input(g.token))).status).toBe(200);
});
it('cancellation returns only cancellation information; completion is read-only and links can still be revoked', async () => {
  const g = await group(),
    second = await group('Hộ còn link'),
    old = await input(g.token);
  await store.doc(base + 'events/' + eventId).update({ status: 'cancelled', version: 2 });
  const p = await preview(g.token);
  expect(p.status).toBe(200);
  expect(p.data.state).toBe('cancelled');
  expect(p.data.card).toBeNull();
  expect(p.data.group).toBeNull();
  expect((await guest('respond', old)).status).toBe(409);
  expect(
    (await call(admin, 'revokeGroup', { eventVersion: 2, groupId: g.id, version: 1 })).status,
  ).toBe(200);
  await store.doc(base + 'events/' + eventId).update({ status: 'completed', version: 3 });
  const completed = await preview(second.token);
  expect(completed.status).toBe(200);
  expect(completed.data.card.status).toBe('completed');
  expect(completed.data.canRespond).toBe(false);
  expect((await guest('respond', await input(second.token))).status).toBe(409);
  expect(
    (await call(admin, 'revokeGroup', { eventVersion: 3, groupId: second.id, version: 1 })).status,
  ).toBe(200);
});
it('closes responses after the deadline; manager override needs a reason and never adds twice', async () => {
  const g = await group(),
    old = await input(g.token);
  await store
    .doc(base + 'events/' + eventId)
    .update({ deadlineAtUTC: new Date(Date.now() - 1000).toISOString() });
  expect((await preview(g.token)).data.canRespond).toBe(false);
  expect((await guest('respond', old)).status).toBe(409);
  const payload = {
    groupId: g.id,
    version: 1,
    responseVersion: 0,
    status: 'attending',
    adults: 2,
    children: 0,
    note: 'Nhập qua điện thoại',
    operationId: crypto.randomUUID(),
    reason: '',
  };
  expect((await call(host, 'recordResponse', payload)).status).toBe(400);
  const corrected = { ...payload, reason: 'Gia đình gọi báo sau hạn chốt' };
  expect((await call(host, 'recordResponse', corrected)).status).toBe(200);
  expect((await call(host, 'recordResponse', corrected)).status).toBe(200);
  expect((await board()).totals.people).toBe(2);
  expect((await board()).groups[0].lastReason).toContain('sau hạn');
});
it('honors the current accepted delegate, assignment generation and membership epoch', async () => {
  await group();
  await store
    .doc(base + 'events/' + eventId)
    .update({ delegateUid: delegate.uid, delegateEpoch: '1000:', delegateAssignmentVersion: 1 });
  expect((await call(delegate, 'dashboard')).status).toBe(200);
  await store.doc(base + 'assignments/p').update({ version: 2 });
  expect((await call(delegate, 'dashboard')).status).toBe(403);
  await store.doc(base + 'assignments/p').update({ version: 1 });
  await store
    .doc('memberships/' + clanId + '_' + delegate.uid)
    .update({ joinedAt: Timestamp.fromMillis(2000) });
  expect((await call(delegate, 'dashboard')).status).toBe(403);
});
it('a removed or rejoined host cannot manage old assignments; stale date sources stop publication', async () => {
  const g = await group();
  await store.doc('memberships/' + clanId + '_' + host.uid).delete();
  expect((await call(host, 'dashboard')).status).toBe(403);
  expect((await preview(g.token)).status).toBe(409);
  await store.doc('memberships/' + clanId + '_' + host.uid).set({
    uid: host.uid,
    clanId,
    role: 'member',
    joinedAt: Timestamp.fromMillis(3000),
    invitationId: 'new',
  });
  expect((await call(host, 'dashboard')).status).toBe(403);
  await store.doc(base + 'assignments/p').update({ hostEpoch: '3000:new' });
  await store.doc(base + 'people/p').update({ death: { ...death, day: 2 } });
  expect((await preview(g.token)).status).toBe(409);
  expect((await publish({ version: 1 })).status).toBe(409);
});
it('create-group retries are idempotent; a reused operation key cannot change the label', async () => {
  expect((await publish()).status).toBe(200);
  const operationId = crypto.randomUUID(),
    payload = { label: 'Nhóm tạo một lần', operationId };
  const results = await Promise.all([
    call(host, 'createGroup', payload),
    call(host, 'createGroup', payload),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect((await board()).totals.invited).toBe(1);
  expect((await call(host, 'createGroup', { ...payload, label: 'Nội dung khác' })).status).toBe(
    409,
  );
});
it('cannot edit a group from another event or send malformed management actions', async () => {
  const g = await group(),
    event = (await store.doc(base + 'events/' + eventId).get()).data()!;
  await store.doc(base + 'events/other').set(event);
  expect(
    (await call(host, 'revokeGroup', { eventId: 'other', groupId: g.id, version: 1 })).status,
  ).toBe(404);
  expect((await call(host, 'rotateGroup', { groupId: g.id, version: 99 })).status).toBe(409);
  expect((await publish({ version: 1, title: ['invalid'] })).status).toBe(400);
});
