import { randomBytes, createHash } from 'node:crypto';
import { FieldValue, type DocumentData, type Transaction } from 'firebase-admin/firestore';
import { store, ApiError } from './service.ts';
import { memberEpoch } from './events.ts';
import {
  canonicalJSON,
  pick,
  personFields,
  relationshipFields,
  eventFields,
  validatePortable,
  type PortableData,
} from '../src/shared/domain/portable.ts';
function id(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value))
    throw new ApiError(400, 'Mã dòng họ không hợp lệ.');
  return value;
}
async function actor(tx: Transaction, uid: string, clanId: string, admin = false) {
  const member = (await tx.get(store.doc('memberships/' + clanId + '_' + uid))).data();
  if (
    !member ||
    member.uid !== uid ||
    member.clanId !== clanId ||
    (admin && member.role !== 'admin')
  )
    throw new ApiError(
      403,
      admin
        ? 'Chỉ quản trị viên được xuất/khôi phục dữ liệu.'
        : 'Bạn không còn quyền truy cập gia phả.',
    );
  return member;
}
function portable(value: unknown) {
  try {
    return validatePortable(value);
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
}
export async function snapshot(uid: string, clanId: string, admin = false) {
  return store.runTransaction(async (tx) => {
    const member = await actor(tx, uid, clanId, admin),
      clan = (await tx.get(store.doc('clans/' + clanId))).data();
    if (!clan) throw new ApiError(404, 'Không tìm thấy gia phả.');
    await tx.get(store.doc('clans/' + clanId + '/genealogyMeta/lock'));
    const [people, relationships, rules, events] = await Promise.all(
      ['people', 'relationships', 'anniversaryRules', 'events'].map((name) =>
        tx.get(store.collection('clans/' + clanId + '/' + name)),
      ),
    );
    const rows = (items: typeof people, fields: readonly string[]) =>
      items.docs.map((doc) => ({ id: doc.id, ...pick(doc.data(), fields) }));
    const data = portable({
      schemaVersion: 1,
      scope: 'genealogy-calendar',
      clanName: clan.name,
      exportedAtUTC: new Date().toISOString(),
      people: rows(people, [...personFields, 'version', 'archived']),
      relationships: rows(relationships, [...relationshipFields, 'version', 'archived']),
      rules: rows(rules, ['calendar', 'leapPolicy', 'missingDayPolicy', 'sourceDate', 'version']),
      events: rows(events, eventFields),
    });
    return { data, membershipEpoch: memberEpoch(member) };
  });
}
export async function mutateData(uid: string, body: Record<string, unknown>) {
  const clanId = id(body.clanId),
    action = body.action;
  if (action === 'download' || action === 'export') {
    const value = await snapshot(uid, clanId, action === 'export');
    return action === 'export'
      ? value.data
      : {
          ...value.data,
          uid,
          clanId,
          membershipEpoch: value.membershipEpoch,
          downloadedAtMs: Date.now(),
        };
  }
  if (action === 'validate') {
    return store.runTransaction(async (tx) => {
      const member = await actor(tx, uid, clanId);
      return { membershipEpoch: memberEpoch(member) };
    });
  }
  if (action !== 'previewRestore' && action !== 'restore')
    throw new ApiError(400, 'Thao tác dữ liệu không hợp lệ.');
  await store.runTransaction((tx) => actor(tx, uid, clanId, true));
  const data = portable(body.data);
  if (action === 'previewRestore')
    return {
      people: data.people.length,
      relationships: data.relationships.length,
      rules: data.rules.length,
      events: data.events.length,
      clanName: data.clanName,
    };
  const operation = id(body.operationId);
  if (operation.length < 16) throw new ApiError(400, 'Mã khôi phục chưa hợp lệ.');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 80 || body.confirm !== true)
    throw new ApiError(400, 'Nhập tên gia phả thử và xác nhận khôi phục riêng.');
  return restore(uid, clanId, data, operation, name);
}
async function restore(
  uid: string,
  sourceClan: string,
  data: PortableData,
  operation: string,
  name: string,
) {
  const fingerprint = createHash('sha256').update(canonicalJSON({ data, name })).digest('hex');
  const sessionId = createHash('sha256')
      .update(uid + ':' + operation)
      .digest('hex'),
    sessionRef = store.doc('restoreSessions/' + sessionId);
  const lease = randomBytes(16).toString('hex');
  const session = await store.runTransaction(async (tx) => {
    const member = await actor(tx, uid, sourceClan, true),
      old = (await tx.get(sessionRef)).data();
    if (old) {
      if (old.sourceClan !== sourceClan || old.fingerprint !== fingerprint || old.uid !== uid)
        throw new ApiError(409, 'Mã khôi phục đã dùng cho tệp hoặc tên khác.');
      if (old.status === 'completed') return old;
      if (old.leaseUntilMs > Date.now())
        throw new ApiError(409, 'Bản khôi phục này đang được xử lý. Vui lòng chờ rồi thử lại.');
    }
    const targetId = old?.targetId || 'restore_' + randomBytes(16).toString('hex');
    if ((await tx.get(store.doc('clans/' + targetId))).exists)
      throw new ApiError(409, 'Gia phả đích đã tồn tại; không ghi đè.');
    const value = {
      uid,
      sourceClan,
      fingerprint,
      targetId,
      status: 'processing',
      memberEpoch: memberEpoch(member),
      lease,
      leaseUntilMs: Date.now() + 300000,
    };
    tx.set(sessionRef, value);
    return value;
  });
  if (session.status === 'completed') return { clanId: session.targetId, status: 'completed' };
  const base = 'clans/' + session.targetId + '/';
  try {
    const docs: [string, DocumentData][] = [
      ...data.people.map(
        (p) =>
          [
            'people/' + p.id,
            {
              ...pick(p as unknown as Record<string, unknown>, [...personFields, 'archived']),
              version: 1,
            },
          ] as [string, DocumentData],
      ),
      ...data.relationships.map(
        (r) =>
          [
            'relationships/' + r.id,
            {
              ...pick(r as unknown as Record<string, unknown>, [...relationshipFields, 'archived']),
              version: 1,
            },
          ] as [string, DocumentData],
      ),
      ...data.rules.map(
        (r) =>
          [
            'anniversaryRules/' + r.id,
            {
              ...pick(r as unknown as Record<string, unknown>, [
                'calendar',
                'leapPolicy',
                'missingDayPolicy',
                'sourceDate',
              ]),
              version: 1,
            },
          ] as [string, DocumentData],
      ),
      ...data.events.map(
        (e) =>
          [
            'events/' + e.id,
            {
              ...e,
              version: 1,
              reminderRevision: 1,
              reminderRevisionAt: FieldValue.serverTimestamp(),
              status: 'draft',
              dateConfirmed: false,
              delegateUid: '',
              delegateEpoch: '',
              delegateAssignmentVersion: 0,
              updatedBy: uid,
              updatedAt: FieldValue.serverTimestamp(),
            },
          ] as [string, DocumentData],
      ),
    ];
    for (let start = 0; start < docs.length; start += 250) {
      // Staged children stay unreadable: the reserved restore_ parent and membership are activated last.
      await store.runTransaction(async (tx) => {
        const current = (await tx.get(sessionRef)).data();
        if (current?.lease !== lease || current.status !== 'processing')
          throw new ApiError(409, 'Phiên khôi phục đã thay đổi.');
        tx.update(sessionRef, { leaseUntilMs: Date.now() + 300000 });
        for (const [path, value] of docs.slice(start, start + 250))
          tx.set(store.doc(base + path), value);
      });
    }
    await store.runTransaction(async (tx) => {
      const member = await actor(tx, uid, sourceClan, true),
        current = (await tx.get(sessionRef)).data();
      const target = store.doc('clans/' + session.targetId),
        existing = await tx.get(target);
      if (
        current?.lease !== lease ||
        current.memberEpoch !== memberEpoch(member) ||
        existing.exists
      )
        throw new ApiError(
          409,
          'Quyền hoặc đích khôi phục đã thay đổi; chưa kích hoạt gia phả thử.',
        );
      tx.create(target, { name, ownerUid: uid, createdAt: FieldValue.serverTimestamp() });
      tx.create(store.doc('memberships/' + session.targetId + '_' + uid), {
        clanId: session.targetId,
        uid,
        displayName: member.displayName,
        role: 'admin',
        joinedAt: FieldValue.serverTimestamp(),
        invitationId: null,
      });
      tx.set(store.doc(base + 'genealogyMeta/lock'), { version: 1 });
      tx.update(sessionRef, {
        status: 'completed',
        leaseUntilMs: 0,
        completedAt: FieldValue.serverTimestamp(),
      });
    });
    return { clanId: session.targetId, status: 'completed' };
  } catch (e) {
    await store
      .runTransaction(async (tx) => {
        const current = (await tx.get(sessionRef)).data();
        if (current?.lease === lease && current.status !== 'completed')
          tx.update(sessionRef, { status: 'failed', leaseUntilMs: 0 });
      })
      .catch(() => undefined);
    throw e;
  }
}
