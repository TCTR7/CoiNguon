import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-coinguon',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [clan, owner] of [
      ['alpha', 'owner-a'],
      ['beta', 'owner-b'],
    ]) {
      await setDoc(doc(db, 'clans', clan), {
        name: 'Gia đình ' + clan,
        ownerUid: owner,
        createdAt: Timestamp.now(),
      });
      await setDoc(doc(db, 'memberships', clan + '_' + owner), {
        clanId: clan,
        uid: owner,
        displayName: owner,
        role: 'admin',
        joinedAt: Timestamp.now(),
        invitationId: null,
      });
    }
    for (const [uid, role] of [
      ['member-a', 'member'],
      ['editor-a', 'editor'],
      ['admin-a', 'admin'],
    ])
      await setDoc(doc(db, 'memberships', 'alpha_' + uid), {
        clanId: 'alpha',
        uid,
        displayName: uid,
        role,
        joinedAt: Timestamp.now(),
        invitationId: null,
      });
  });
});
afterAll(async () => {
  await env?.cleanup();
});
const dbFor = (uid: string) => env.authenticatedContext(uid).firestore();
const token = 'a'.repeat(64);
async function seedInvitation(overrides: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), 'invitations', token), {
      clanId: 'alpha',
      clanName: 'Gia đình alpha',
      role: 'member',
      createdBy: 'owner-a',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
      revoked: false,
      acceptedBy: null,
      ...overrides,
    }),
  );
}
function join(uid: string, role = 'member') {
  const db = dbFor(uid),
    batch = writeBatch(db);
  batch.set(doc(db, 'memberships', 'alpha_' + uid), {
    clanId: 'alpha',
    uid,
    displayName: 'Người thử',
    role,
    joinedAt: serverTimestamp(),
    invitationId: token,
  });
  batch.update(doc(db, 'invitations', token), { acceptedBy: uid });
  return batch.commit();
}
it('denies unauthenticated and cross-clan reads/writes', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'clans', 'alpha')));
  await assertFails(getDoc(doc(dbFor('member-a'), 'clans', 'beta')));
  await assertFails(getDoc(doc(dbFor('member-a'), 'memberships', 'beta_owner-b')));
  await assertFails(
    updateDoc(doc(dbFor('owner-a'), 'memberships', 'beta_owner-b'), { role: 'member' }),
  );
});
it('creates a clan only with an atomic owner-admin membership', async () => {
  const db = dbFor('new-owner'),
    batch = writeBatch(db);
  batch.set(doc(db, 'clans', 'new'), {
    name: 'Gia đình mới',
    ownerUid: 'new-owner',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'memberships', 'new_new-owner'), {
    clanId: 'new',
    uid: 'new-owner',
    displayName: 'Người tạo',
    role: 'admin',
    joinedAt: serverTimestamp(),
    invitationId: null,
  });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(db, 'clans', 'new')));
  await assertFails(
    setDoc(doc(db, 'clans', 'orphan'), {
      name: 'Gia đình mới',
      ownerUid: 'new-owner',
      createdAt: serverTimestamp(),
    }),
  );
});
it('does not allow arbitrary or forged membership creation', async () => {
  const db = dbFor('outsider');
  await assertFails(
    setDoc(doc(db, 'memberships', 'alpha_outsider'), {
      clanId: 'alpha',
      uid: 'outsider',
      displayName: 'Người giả',
      role: 'admin',
      joinedAt: serverTimestamp(),
      invitationId: null,
    }),
  );
  await assertFails(
    setDoc(doc(db, 'memberships', 'alpha_owner-a'), {
      clanId: 'alpha',
      uid: 'outsider',
      displayName: 'Người giả',
      role: 'admin',
      joinedAt: serverTimestamp(),
      invitationId: null,
    }),
  );
});
it('allows only scoped membership queries', async () => {
  const db = dbFor('member-a');
  await assertSucceeds(
    getDocs(query(collection(db, 'memberships'), where('uid', '==', 'member-a'))),
  );
  await assertSucceeds(
    getDocs(query(collection(db, 'memberships'), where('clanId', '==', 'alpha'))),
  );
  await assertFails(getDocs(collection(db, 'memberships')));
  await assertFails(getDocs(query(collection(db, 'memberships'), where('clanId', '==', 'beta'))));
});
it('members and editors cannot promote themselves or modify another member', async () => {
  for (const uid of ['member-a', 'editor-a'])
    await assertFails(updateDoc(doc(dbFor(uid), 'memberships', 'alpha_' + uid), { role: 'admin' }));
  await assertFails(deleteDoc(doc(dbFor('member-a'), 'memberships', 'alpha_editor-a')));
});
it('direct client membership changes are denied even to admins', async () => {
  const ref = doc(dbFor('owner-a'), 'memberships', 'alpha_member-a');
  await assertFails(updateDoc(ref, { role: 'editor' }));
  await assertFails(updateDoc(ref, { uid: 'owner-a' }));
  await assertFails(updateDoc(ref, { clanId: 'beta' }));
  await assertFails(updateDoc(ref, { role: 'superadmin' }));
  await assertFails(updateDoc(ref, { email: 'private@example.test' }));
});
it('requires the backend for admin demotion/removal and keeps creator metadata immutable', async () => {
  for (const uid of ['owner-a', 'admin-a']) {
    const db = dbFor(uid);
    await assertFails(deleteDoc(doc(db, 'memberships', 'alpha_owner-a')));
    await assertFails(updateDoc(doc(db, 'memberships', 'alpha_owner-a'), { role: 'member' }));
  }
  await assertFails(updateDoc(doc(dbFor('owner-a'), 'clans', 'alpha'), { ownerUid: 'admin-a' }));
});
it('a valid invitation is consumed atomically with matching membership', async () => {
  await seedInvitation();
  await assertSucceeds(join('recipient'));
  await assertSucceeds(getDoc(doc(dbFor('recipient'), 'clans', 'alpha')));
  await assertFails(join('someone-else'));
});
it('does not allow consumption without joining or joining with a higher role', async () => {
  await seedInvitation();
  await assertFails(
    updateDoc(doc(dbFor('recipient'), 'invitations', token), { acceptedBy: 'recipient' }),
  );
  await assertFails(join('recipient', 'admin'));
});
it('rejects expired, revoked, consumed or orphaned invitations', async () => {
  for (const override of [
    { expiresAt: Timestamp.fromMillis(Date.now() - 10000) },
    { revoked: true },
    { acceptedBy: 'someone' },
    { createdBy: 'member-a' },
  ]) {
    await seedInvitation(override);
    await assertFails(join('recipient'));
  }
});
it('allows one winner when two recipients race to consume a link', async () => {
  await seedInvitation();
  const results = await Promise.allSettled([join('recipient-one'), join('recipient-two')]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
});
it('requires admin for creation, restricts scope/expiry and prevents invitation listing by members', async () => {
  const base = {
    clanId: 'alpha',
    clanName: 'Gia đình alpha',
    role: 'member',
    createdBy: 'owner-a',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
    revoked: false,
    acceptedBy: null,
  };
  await assertSucceeds(setDoc(doc(dbFor('owner-a'), 'invitations', token), base));
  await assertFails(
    setDoc(doc(dbFor('editor-a'), 'invitations', 'b'.repeat(64)), {
      ...base,
      createdBy: 'editor-a',
    }),
  );
  await assertFails(
    setDoc(doc(dbFor('owner-a'), 'invitations', 'c'.repeat(64)), { ...base, role: 'admin' }),
  );
  await assertFails(
    setDoc(doc(dbFor('owner-a'), 'invitations', 'd'.repeat(64)), {
      ...base,
      expiresAt: Timestamp.fromMillis(Date.now() + 9 * 86400000),
    }),
  );
  await assertSucceeds(
    getDocs(query(collection(dbFor('owner-a'), 'invitations'), where('clanId', '==', 'alpha'))),
  );
  await assertFails(
    getDocs(query(collection(dbFor('member-a'), 'invitations'), where('clanId', '==', 'alpha'))),
  );
});
it('revocation cannot be undone and recipients cannot rewrite invitation metadata', async () => {
  await seedInvitation();
  await assertFails(updateDoc(doc(dbFor('recipient'), 'invitations', token), { role: 'editor' }));
  await assertSucceeds(updateDoc(doc(dbFor('owner-a'), 'invitations', token), { revoked: true }));
  await assertFails(updateDoc(doc(dbFor('owner-a'), 'invitations', token), { revoked: false }));
  await assertFails(join('recipient'));
});
it('removal immediately revokes clan access and requires a fresh invitation to rejoin', async () => {
  await seedInvitation();
  await join('recipient');
  // Simulate a removal committed by the authorized backend; client deletion is denied.
  await env.withSecurityRulesDisabled((context) =>
    deleteDoc(doc(context.firestore(), 'memberships', 'alpha_recipient')),
  );
  await assertFails(getDoc(doc(dbFor('recipient'), 'clans', 'alpha')));
  await assertFails(join('recipient'));
});
it('requires the backend for departures and blocks clan deletion', async () => {
  await assertFails(deleteDoc(doc(dbFor('member-a'), 'memberships', 'alpha_member-a')));
  await assertFails(deleteDoc(doc(dbFor('owner-a'), 'clans', 'alpha')));
});

it('isolates genealogy reads, blocks direct writes and limits requests to their author or admin', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'clans/alpha/people/a'), { name: 'Người mẫu' });
    await setDoc(doc(db, 'clans/alpha/personRequests/r'), {
      uid: 'member-a',
      message: 'Đề nghị mẫu',
    });
  });
  await assertSucceeds(getDoc(doc(dbFor('member-a'), 'clans/alpha/people/a')));
  await assertFails(getDoc(doc(dbFor('owner-b'), 'clans/alpha/people/a')));
  await assertFails(
    updateDoc(doc(dbFor('owner-a'), 'clans/alpha/people/a'), { name: 'Ghi trực tiếp' }),
  );
  await assertFails(
    setDoc(doc(dbFor('owner-a'), 'clans/alpha/relationships/r'), { from: 'a', to: 'a' }),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(dbFor('member-a'), 'clans/alpha/personRequests'),
        where('uid', '==', 'member-a'),
      ),
    ),
  );
  await assertFails(getDocs(collection(dbFor('editor-a'), 'clans/alpha/personRequests')));
  await assertSucceeds(getDocs(collection(dbFor('owner-a'), 'clans/alpha/personRequests')));
});

it('keeps anniversary rules, events, stewardship and audit data inside their clan; only API can write', async () => {
  const collections = [
    'anniversaryRules',
    'assignments',
    'events',
    'delegations',
    'stewardChanges',
  ];
  await env.withSecurityRulesDisabled(async (context) => {
    for (const name of collections)
      await setDoc(doc(context.firestore(), 'clans', 'alpha', name, 'sample'), { version: 1 });
  });
  for (const name of collections) {
    const member = doc(dbFor('member-a'), 'clans', 'alpha', name, 'sample');
    await assertSucceeds(getDoc(member));
    await assertSucceeds(getDocs(collection(dbFor('member-a'), 'clans', 'alpha', name)));
    await assertFails(getDoc(doc(dbFor('owner-b'), 'clans', 'alpha', name, 'sample')));
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), 'clans', 'alpha', name, 'sample')),
    );
    await assertFails(
      updateDoc(doc(dbFor('owner-a'), 'clans', 'alpha', name, 'sample'), { version: 2 }),
    );
    await assertFails(
      setDoc(doc(dbFor('owner-a'), 'clans', 'alpha', name, 'forged'), { version: 1 }),
    );
  }
  await env.withSecurityRulesDisabled((context) =>
    deleteDoc(doc(context.firestore(), 'memberships', 'alpha_member-a')),
  );
  await assertFails(getDocs(collection(dbFor('member-a'), 'clans', 'alpha', 'events')));
});

it('applicants can read only their own request and cannot use pending status to read a clan', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'joinRequests', 'alpha_applicant'), {
      uid: 'applicant',
      clanId: 'alpha',
      status: 'pending',
      message: 'Giới thiệu riêng',
    });
    await setDoc(doc(db, 'joinRequests', 'alpha_other'), {
      uid: 'other',
      clanId: 'alpha',
      status: 'pending',
    });
    await setDoc(doc(db, 'clans', 'alpha', 'people', 'person'), { name: 'Hồ sơ riêng' });
  });
  const applicant = dbFor('applicant');
  await assertSucceeds(
    getDocs(query(collection(applicant, 'joinRequests'), where('uid', '==', 'applicant'))),
  );
  await assertFails(getDocs(collection(applicant, 'joinRequests')));
  await assertFails(getDoc(doc(applicant, 'joinRequests', 'alpha_other')));
  await assertFails(getDoc(doc(applicant, 'clans', 'alpha')));
  await assertFails(getDocs(collection(applicant, 'clans', 'alpha', 'people')));
  await assertFails(
    getDocs(query(collection(applicant, 'memberships'), where('clanId', '==', 'alpha'))),
  );
  await assertFails(
    updateDoc(doc(applicant, 'joinRequests', 'alpha_applicant'), { status: 'approved' }),
  );
  await assertFails(
    setDoc(doc(applicant, 'memberships', 'alpha_applicant'), {
      uid: 'applicant',
      clanId: 'alpha',
      role: 'member',
    }),
  );
});
it('only clan admins can read request queues and raw shared links; clients cannot approve requests directly', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'joinRequests', 'alpha_applicant'), {
      uid: 'applicant',
      clanId: 'alpha',
      status: 'pending',
    });
    await setDoc(doc(db, 'clans', 'alpha', 'joinSettings', 'current'), {
      token: 'a'.repeat(64),
      version: 1,
    });
    await setDoc(doc(db, 'joinLinks', 'b'.repeat(64)), { clanId: 'alpha', revoked: false });
  });
  await assertSucceeds(
    getDocs(query(collection(dbFor('owner-a'), 'joinRequests'), where('clanId', '==', 'alpha'))),
  );
  await assertSucceeds(getDoc(doc(dbFor('owner-a'), 'clans', 'alpha', 'joinSettings', 'current')));
  for (const uid of ['member-a', 'editor-a', 'owner-b', 'applicant']) {
    await assertFails(
      getDocs(query(collection(dbFor(uid), 'joinRequests'), where('clanId', '==', 'alpha'))),
    );
    await assertFails(getDoc(doc(dbFor(uid), 'clans', 'alpha', 'joinSettings', 'current')));
  }
  await assertFails(
    getDoc(
      doc(env.unauthenticatedContext().firestore(), 'clans', 'alpha', 'joinSettings', 'current'),
    ),
  );
  await assertFails(getDoc(doc(dbFor('owner-a'), 'joinLinks', 'b'.repeat(64))));
  await assertFails(
    updateDoc(doc(dbFor('owner-a'), 'joinRequests', 'alpha_applicant'), { status: 'approved' }),
  );
  await assertFails(
    updateDoc(doc(dbFor('owner-a'), 'clans', 'alpha', 'joinSettings', 'current'), {
      revoked: true,
    }),
  );
});

it('blocks forged membership locks and management versions', async () => {
  for (const uid of ['owner-a', 'admin-a', 'member-a']) {
    const db = dbFor(uid);
    await assertFails(setDoc(doc(db, 'clans/alpha/membershipMeta/lock'), { version: 0 }));
    await assertFails(updateDoc(doc(db, 'memberships/alpha_owner-a'), { managementVersion: 0 }));
    await assertFails(getDoc(doc(db, 'clans/alpha/membershipMeta/lock')));
  }
});

it('a departed creator cannot bootstrap admin again from creator metadata', async () => {
  await env.withSecurityRulesDisabled((context) =>
    deleteDoc(doc(context.firestore(), 'memberships', 'alpha_owner-a')),
  );
  const db = dbFor('owner-a');
  await assertFails(getDoc(doc(db, 'clans', 'alpha')));
  await assertFails(
    setDoc(doc(db, 'memberships', 'alpha_owner-a'), {
      clanId: 'alpha',
      uid: 'owner-a',
      displayName: 'Người tạo quay lại',
      role: 'admin',
      joinedAt: serverTimestamp(),
      invitationId: null,
    }),
  );
});

it('guest tokens, card settings and household responses are accessible only through the backend', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'guestTokens', 'synthetic-guest-hash'), {
      clanId: 'alpha',
      eventId: 'event',
      kind: 'reply',
      groupId: 'household',
    });
    await setDoc(doc(db, 'clans/alpha/invitationSettings/event'), {
      publicToken: 'synthetic-public',
      published: true,
      version: 1,
    });
    await setDoc(doc(db, 'clans/alpha/invitationGroups/household'), {
      eventId: 'event',
      label: 'Hộ mẫu',
      token: 'synthetic-private',
      response: { status: 'pending', adults: 0, children: 0, note: '' },
    });
  });
  for (const uid of ['owner-a', 'admin-a', 'member-a', 'owner-b', 'applicant']) {
    const db = dbFor(uid);
    for (const path of [
      'guestTokens/synthetic-guest-hash',
      'clans/alpha/invitationSettings/event',
      'clans/alpha/invitationGroups/household',
    ]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(updateDoc(doc(db, path), { revoked: false }));
    }
    await assertFails(getDocs(collection(db, 'clans/alpha/invitationGroups')));
  }
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), 'guestTokens/synthetic-guest-hash')),
  );
  await assertFails(
    setDoc(doc(dbFor('owner-a'), 'guestTokens', 'forged-token'), {
      kind: 'reply',
      clanId: 'alpha',
    }),
  );
});

it('clients cannot forge reminder jobs/inboxes, inspect restore sessions or claim staged restore clans', async () => {
  for (const uid of ['owner-a', 'member-a', 'owner-b']) {
    const db = dbFor(uid);
    for (const path of [
      'clans/alpha/reminderJobs/forged',
      'clans/alpha/reminderInbox/forged',
      'clans/alpha/reminderMeta/status',
      'restoreSessions/forged',
    ]) {
      await assertFails(setDoc(doc(db, path), { uid, status: 'delivered' }));
      await assertFails(getDoc(doc(db, path)));
    }
  }
  const db = dbFor('owner-a'),
    batch = writeBatch(db),
    clan = 'restore_staged';
  batch.set(doc(db, 'clans', clan), {
    name: 'Chiếm bản thử',
    ownerUid: 'owner-a',
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'memberships', clan + '_owner-a'), {
    clanId: clan,
    uid: 'owner-a',
    role: 'admin',
    displayName: 'Người thử',
    joinedAt: serverTimestamp(),
    invitationId: null,
  });
  await assertFails(batch.commit());
  await env.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), 'clans', clan, 'people', 'staged'), { name: 'Chưa kích hoạt' }),
  );
  await assertFails(getDoc(doc(db, 'clans', clan, 'people', 'staged')));
});
