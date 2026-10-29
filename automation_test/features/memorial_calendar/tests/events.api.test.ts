import { spawn, type ChildProcess } from 'node:child_process';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { store } from '../../../../backend/service';
import { blankPerson } from '../../../../src/shared/domain/genealogy';
let server: ChildProcess;
type User = { uid: string; token: string };
let admin: User, host: User, recipient: User, outsider: User;
const clanId = 'api-calendar-tests';
const base = 'clans/' + clanId + '/';
const death = { day: 1, month: 1, year: 2000, calendar: 'lunar', leapMonth: false };
async function account() {
  const res = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: crypto.randomUUID() + '@calendar.test',
        password: 'calendar-local-123',
        returnSecureToken: true,
      }),
    },
  );
  const d = await res.json();
  if (!res.ok) throw new Error('Emulator account failed');
  return { uid: d.localId, token: d.idToken };
}
async function call(
  user: User | null,
  action: string,
  payload: Record<string, unknown> = {},
  endpoint = 'events',
) {
  const res = await fetch('http://127.0.0.1:8787/api/' + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: 'Bearer ' + user.token } : {}),
    },
    body: JSON.stringify({ clanId, personId: 'p', action, ...payload }),
  });
  return { status: res.status, data: await res.json() };
}
const get = async (path: string) => (await store.doc(base + path).get()).data()!;
async function setupEvent() {
  expect((await call(admin, 'assignHost', { toUid: host.uid, version: null })).status).toBe(200);
  expect(
    (
      await call(host, 'saveRule', {
        version: null,
        rule: { calendar: 'lunar', leapPolicy: 'unset', missingDayPolicy: 'unset' },
      })
    ).status,
  ).toBe(200);
  expect((await call(host, 'createEvent', { year: 2026 })).status).toBe(200);
}
const form = {
  eventId: 'p_2026',
  version: 1,
  ruleVersion: 1,
  anniversaryDate: '2026-02-17',
  dateConfirmed: true,
  confirmationNote: '',
  scheduledDate: '2026-02-21',
  scheduledTime: '10:00',
  timeZone: 'Asia/Ho_Chi_Minh',
  rsvpDeadlineLocal: '2026-02-20T18:00',
  address: 'Nhà thờ họ mẫu',
  invitationText: 'Cùng về sum họp.',
};
beforeAll(async () => {
  [admin, host, recipient, outsider] = await Promise.all([
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
  await store.doc('clans/' + clanId).set({ name: 'Gia đình mẫu', ownerUid: admin.uid });
  for (const [user, role] of [
    [admin, 'admin'],
    [host, 'member'],
    [recipient, 'editor'],
  ] as const)
    await store.doc('memberships/' + clanId + '_' + user.uid).set({
      clanId,
      uid: user.uid,
      role,
      displayName: 'Người thử',
      joinedAt: Timestamp.fromMillis(1000),
      invitationId: null,
    });
  await store.doc(base + 'people/p').set({
    ...blankPerson(),
    name: 'Cụ Mẫu',
    lifeStatus: 'deceased',
    death,
    version: 1,
    archived: false,
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
it('enforces current membership, host authority and admin-only assignments', async () => {
  expect((await call(null, 'createEvent')).status).toBe(401);
  expect((await call(outsider, 'createEvent')).status).toBe(403);
  expect(
    (await call(recipient, 'assignHost', { toUid: recipient.uid, version: null })).status,
  ).toBe(403);
  expect((await call(admin, 'assignHost', { toUid: outsider.uid, version: null })).status).toBe(
    400,
  );
  await setupEvent();
  expect((await call(recipient, 'saveEvent', form)).status).toBe(403);
});
it('creates only one event per person/year, including simultaneous retries', async () => {
  await setupEvent();
  expect((await call(host, 'createEvent', { year: 2026 })).status).toBe(409);
  const results = await Promise.all([
    call(host, 'createEvent', { year: 2027 }),
    call(host, 'createEvent', { year: 2027 }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await store.collection(base + 'events').get()).size).toBe(2);
});
it('separates original, recurring and actual dates and invalidates previous reminder versions', async () => {
  await setupEvent();
  expect(
    (await call(host, 'transitionEvent', { eventId: 'p_2026', version: 1, status: 'published' }))
      .status,
  ).toBe(409);
  expect((await call(host, 'saveEvent', form)).status).toBe(200);
  const saved = await get('events/p_2026');
  expect(saved.startsAtUTC).toBe('2026-02-21T03:00:00Z');
  expect(saved.anniversaryDate).toBe('2026-02-17');
  expect((await get('people/p')).death).toEqual(death);
  expect(
    (await call(host, 'transitionEvent', { eventId: 'p_2026', version: 2, status: 'published' }))
      .status,
  ).toBe(200);
  expect(
    (await call(host, 'saveEvent', { ...form, version: 3, scheduledDate: '2026-02-22' })).status,
  ).toBe(200);
  expect((await get('events/p_2026')).reminderRevision).toBe(4);
  expect((await call(host, 'saveEvent', { ...form, version: 3 })).status).toBe(409);
});
it('rejects invalid dates, later deadlines, DST gaps and ambiguous local times', async () => {
  await setupEvent();
  for (const extra of [
    { scheduledDate: '2026-02-30' },
    { rsvpDeadlineLocal: '2026-02-22T10:00' },
    {
      scheduledDate: '2026-03-08',
      scheduledTime: '02:30',
      timeZone: 'America/New_York',
      rsvpDeadlineLocal: '',
    },
    {
      scheduledDate: '2026-11-01',
      scheduledTime: '01:30',
      timeZone: 'America/New_York',
      rsvpDeadlineLocal: '',
    },
    { anniversaryDate: '2027-02-06', confirmationNote: 'Gia đình chọn' },
  ])
    expect((await call(host, 'saveEvent', { ...form, ...extra })).status).toBe(400);
});
it('requires a reason for a manual date and an explicit current confirmation', async () => {
  await setupEvent();
  expect((await call(host, 'saveEvent', { ...form, anniversaryDate: '2026-02-18' })).status).toBe(
    400,
  );
  expect(
    (
      await call(host, 'saveEvent', {
        ...form,
        anniversaryDate: '2026-02-18',
        confirmationNote: 'Gia đình đã đối chiếu',
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(host, 'saveRule', {
        version: 1,
        rule: { calendar: 'lunar', leapPolicy: 'regular', missingDayPolicy: 'last-day' },
      })
    ).status,
  ).toBe(200);
  const updated = await get('events/p_2026');
  expect(updated.dateConfirmed).toBe(false);
  expect(updated.status).toBe('draft');
  expect(
    (
      await call(host, 'transitionEvent', {
        eventId: 'p_2026',
        version: updated.version,
        status: 'published',
      })
    ).status,
  ).toBe(409);
});
it('withdraws confirmation when an editor changes the original date', async () => {
  await setupEvent();
  await call(host, 'saveEvent', form);
  await call(host, 'transitionEvent', { eventId: 'p_2026', version: 2, status: 'published' });
  expect(
    (
      await call(
        recipient,
        'updatePerson',
        {
          version: 1,
          person: {
            ...blankPerson(),
            name: 'Cụ Mẫu',
            lifeStatus: 'deceased',
            death: { ...death, day: 2 },
          },
        },
        'genealogy',
      )
    ).status,
  ).toBe(200);
  const event = await get('events/p_2026');
  expect(event.status).toBe('draft');
  expect(event.dateConfirmed).toBe(false);
  expect((await call(host, 'saveEvent', { ...form, version: event.version })).status).toBe(409);
});
it('keeps the old host until atomic acceptance and never grants a transfer twice', async () => {
  await setupEvent();
  const request = await call(host, 'requestDelegation', {
    scope: 'permanent',
    toUid: recipient.uid,
  });
  expect(request.status).toBe(200);
  expect((await get('assignments/p')).hostUid).toBe(host.uid);
  expect(
    (await call(host, 'requestDelegation', { scope: 'permanent', toUid: admin.uid })).status,
  ).toBe(409);
  expect((await call(recipient, 'createEvent', { year: 2027 })).status).toBe(403);
  const results = await Promise.all(
    [1, 2].map(() =>
      call(recipient, 'respondDelegation', {
        requestId: request.data.id,
        version: 1,
        decision: 'accept',
      }),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await get('assignments/p')).hostUid).toBe(recipient.uid);
  expect((await call(host, 'createEvent', { year: 2027 })).status).toBe(403);
  expect((await call(recipient, 'createEvent', { year: 2027 })).status).toBe(200);
  expect((await store.collection(base + 'stewardChanges').get()).size).toBe(2);
});
it('invalidates stale assignments, expired requests and removed/rejoined recipients', async () => {
  await setupEvent();
  const request = (
    await call(host, 'requestDelegation', { scope: 'permanent', toUid: recipient.uid })
  ).data.id;
  await store.doc(base + 'delegations/' + request).update({ expiresAtMs: Date.now() - 1 });
  expect(
    (
      await call(recipient, 'respondDelegation', {
        requestId: request,
        version: 1,
        decision: 'accept',
      })
    ).data.status,
  ).toBe('expired');
  await call(host, 'requestDelegation', { scope: 'permanent', toUid: recipient.uid });
  await store
    .doc('memberships/' + clanId + '_' + recipient.uid)
    .update({ joinedAt: Timestamp.fromMillis(2000) });
  expect(
    (
      await call(recipient, 'respondDelegation', {
        requestId: request,
        version: 3,
        decision: 'accept',
      })
    ).data.status,
  ).toBe('cancelled');
  await call(host, 'requestDelegation', { scope: 'permanent', toUid: recipient.uid });
  await call(admin, 'assignHost', { toUid: admin.uid, version: 1 });
  expect(
    (
      await call(recipient, 'respondDelegation', {
        requestId: request,
        version: 5,
        decision: 'accept',
      })
    ).data.status,
  ).toBe('cancelled');
  expect((await get('assignments/p')).hostUid).toBe(admin.uid);
});
it('does not revive a removed host or recipient by rejoining with the same uid', async () => {
  await setupEvent();
  await call(host, 'requestDelegation', { scope: 'permanent', toUid: recipient.uid });
  await store.doc('memberships/' + clanId + '_' + host.uid).delete();
  expect((await call(host, 'saveEvent', form)).status).toBe(403);
  expect(
    (
      await call(recipient, 'respondDelegation', {
        requestId: 'permanent_p',
        version: 1,
        decision: 'accept',
      })
    ).data.status,
  ).toBe('cancelled');
  await store
    .doc('memberships/' + clanId + '_' + host.uid)
    .set({ clanId, uid: host.uid, role: 'member', joinedAt: Timestamp.fromMillis(3000) });
  expect((await call(host, 'saveEvent', form)).status).toBe(403);
});
it('delegates only the accepted event and ends authority on revocation or cancellation', async () => {
  await setupEvent();
  await call(host, 'createEvent', { year: 2027 });
  expect(
    (
      await call(host, 'requestDelegation', {
        scope: 'event',
        eventId: 'p_2026',
        toUid: recipient.uid,
      })
    ).status,
  ).toBe(200);
  expect((await call(recipient, 'saveEvent', form)).status).toBe(403);
  expect(
    (
      await call(recipient, 'respondDelegation', {
        requestId: 'event_p_2026',
        version: 1,
        decision: 'accept',
      })
    ).status,
  ).toBe(200);
  expect((await get('assignments/p')).hostUid).toBe(host.uid);
  expect((await call(recipient, 'saveEvent', { ...form, version: 2 })).status).toBe(200);
  expect((await call(recipient, 'saveEvent', { ...form, eventId: 'p_2027' })).status).toBe(403);
  expect(
    (await call(recipient, 'requestDelegation', { scope: 'permanent', toUid: admin.uid })).status,
  ).toBe(403);
  expect((await call(host, 'revokeDelegate', { eventId: 'p_2026', version: 3 })).status).toBe(200);
  expect((await call(recipient, 'saveEvent', { ...form, version: 4 })).status).toBe(403);
  await call(host, 'requestDelegation', {
    scope: 'event',
    eventId: 'p_2026',
    toUid: recipient.uid,
  });
  await call(recipient, 'respondDelegation', {
    requestId: 'event_p_2026',
    version: 3,
    decision: 'accept',
  });
  expect(
    (
      await call(recipient, 'transitionEvent', {
        eventId: 'p_2026',
        version: 5,
        status: 'cancelled',
      })
    ).status,
  ).toBe(200);
  expect((await get('events/p_2026')).delegateUid).toBe('');
  expect(
    (await call(recipient, 'transitionEvent', { eventId: 'p_2026', version: 6, status: 'draft' }))
      .status,
  ).toBe(403);
});
it('rejects acceptance after the event changes and reopens the same cancelled record', async () => {
  await setupEvent();
  await call(host, 'requestDelegation', {
    scope: 'event',
    eventId: 'p_2026',
    toUid: recipient.uid,
  });
  await call(host, 'saveEvent', form);
  expect(
    (
      await call(recipient, 'respondDelegation', {
        requestId: 'event_p_2026',
        version: 1,
        decision: 'accept',
      })
    ).data.status,
  ).toBe('cancelled');
  await call(host, 'transitionEvent', { eventId: 'p_2026', version: 2, status: 'cancelled' });
  expect((await call(host, 'createEvent', { year: 2026 })).status).toBe(409);
  expect(
    (await call(host, 'transitionEvent', { eventId: 'p_2026', version: 3, status: 'draft' }))
      .status,
  ).toBe(200);
  expect((await get('events/p_2026')).dateConfirmed).toBe(false);
});

it('ends accepted delegation on completion and preserves the completed record', async () => {
  await setupEvent();
  await call(host, 'requestDelegation', {
    scope: 'event',
    eventId: 'p_2026',
    toUid: recipient.uid,
  });
  await call(recipient, 'respondDelegation', {
    requestId: 'event_p_2026',
    version: 1,
    decision: 'accept',
  });
  expect((await call(recipient, 'saveEvent', { ...form, version: 2 })).status).toBe(200);
  expect(
    (
      await call(recipient, 'transitionEvent', {
        eventId: 'p_2026',
        version: 3,
        status: 'published',
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(recipient, 'transitionEvent', {
        eventId: 'p_2026',
        version: 4,
        status: 'completed',
      })
    ).status,
  ).toBe(200);
  expect((await get('events/p_2026')).delegateUid).toBe('');
  expect((await call(admin, 'saveEvent', { ...form, version: 5 })).status).toBe(409);
  expect(
    (
      await call(host, 'saveRule', {
        version: 1,
        rule: { calendar: 'lunar', leapPolicy: 'regular', missingDayPolicy: 'last-day' },
      })
    ).status,
  ).toBe(200);
  expect((await get('events/p_2026')).version).toBe(5);
  expect((await get('events/p_2026')).status).toBe('completed');
});

it('saves an incomplete draft without inventing a time, but cannot publish it', async () => {
  await setupEvent();
  const partial = { ...form, scheduledTime: '', rsvpDeadlineLocal: '', address: '' };
  expect((await call(host, 'saveEvent', partial)).status).toBe(200);
  const saved = await get('events/p_2026');
  expect(saved.scheduledDate).toBe(form.scheduledDate);
  expect(saved.startsAtUTC).toBe('');
  expect(saved.dateConfirmed).toBe(true);
  expect(
    (await call(host, 'transitionEvent', { eventId: 'p_2026', version: 2, status: 'published' }))
      .status,
  ).toBe(409);
  expect(
    (await call(host, 'saveEvent', { ...partial, version: 2, scheduledTime: '25:00' })).status,
  ).toBe(400);
  expect(
    (await call(host, 'saveEvent', { ...partial, version: 2, timeZone: 'Invalid/Zone' })).status,
  ).toBe(400);
});
