import { createHash } from 'node:crypto';
import {
  FieldValue,
  FieldPath,
  type DocumentData,
  type Transaction,
} from 'firebase-admin/firestore';
import { normalizePhone } from '../src/shared/domain/phone.ts';
import { ApiError, adminAuth, store } from './service.ts';
import { phoneKey } from './accounts.ts';

const id = (value: unknown) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(value))
    throw new ApiError(400, 'Mã không hợp lệ.');
  return value;
};
const epoch = (m: DocumentData | undefined) =>
  m ? [m.joinedAt?.seconds ?? 0, m.joinedAt?.nanoseconds ?? 0, m.invitationId ?? ''].join(':') : '';
const closed = new Set(['approved', 'declined', 'rejected', 'revoked']);
async function validity(tx: Transaction, invite: DocumentData) {
  const [creator, person, claim, clan] = await Promise.all([
    tx.get(store.doc('memberships/' + invite.clanId + '_' + invite.createdBy)),
    tx.get(store.doc('clans/' + invite.clanId + '/people/' + invite.personId)),
    tx.get(store.doc('phoneClaims/' + invite.phoneKey)),
    tx.get(store.doc('clans/' + invite.clanId)),
  ]);
  const c = claim.data();
  const expected = c?.uid ? c.generation : (c?.generation ?? 0) + 1;
  return (
    clan.exists &&
    creator.data()?.role === 'admin' &&
    epoch(creator.data()) === invite.creatorEpoch &&
    (creator.data()?.managementVersion ?? 0) === invite.creatorManagementVersion &&
    person.exists &&
    !person.data()!.archived &&
    person.data()!.lifeStatus === 'living' &&
    expected === invite.phoneGeneration &&
    (!invite.targetUid || !c?.uid || c.uid === invite.targetUid)
  );
}

export async function phoneInvites(uid: string, body: Record<string, unknown>) {
  const action = body.action;
  const accountRef = store.doc('accounts/' + uid);
  if (action === 'inbox' || action === 'list') {
    const admin = action === 'list';
    const clanId = admin ? id(body.clanId) : '';
    return store.runTransaction(async (tx) => {
      const account = (await tx.get(accountRef)).data();
      if (!account?.complete)
        throw new ApiError(403, 'Hoàn tất số điện thoại trước khi xem lời mời.');
      if (
        admin &&
        (await tx.get(store.doc('memberships/' + clanId + '_' + uid))).data()?.role !== 'admin'
      )
        throw new ApiError(403, 'Chỉ admin gia phả được xem danh sách mời.');
      let query = store
        .collection('membershipInvites')
        .where(admin ? 'clanId' : 'phoneKey', '==', admin ? clanId : account.phoneKey)
        .orderBy(FieldPath.documentId())
        .limit(21);
      if (admin && body.personId) query = query.where('personId', '==', id(body.personId));
      if (body.cursor) query = query.startAfter(id(body.cursor));
      const snapshot = await tx.get(query);
      const contact =
        admin && body.personId
          ? (
              await tx.get(store.doc('clans/' + clanId + '/personContacts/' + id(body.personId)))
            ).data()
          : null;
      const rows = [];
      for (const doc of snapshot.docs.slice(0, 20)) {
        const inv = doc.data();
        if (
          !admin &&
          (inv.phoneGeneration !== account.phoneGeneration ||
            (inv.targetUid && inv.targetUid !== uid))
        )
          continue;
        const status = closed.has(inv.status)
          ? inv.status
          : (await validity(tx, inv))
            ? inv.status
            : 'stale';
        if (admin) {
          const profile = (
            await tx.get(store.doc('clans/' + inv.clanId + '/people/' + inv.personId))
          ).data();
          const identity =
            inv.status === 'responded' && inv.respondedBy
              ? await adminAuth.getUser(inv.respondedBy).catch(() => null)
              : null;
          rows.push({
            id: doc.id,
            personId: inv.personId,
            personName: profile?.name ?? 'Hồ sơ không còn hoạt động',
            phone: inv.phone,
            status,
            version: inv.version,
            recipient: identity
              ? { name: identity.displayName || '', email: identity.email || '' }
              : null,
          });
        } else rows.push({ id: doc.id, status, version: inv.version });
      }
      return {
        items: rows,
        cursor: snapshot.size > 20 ? snapshot.docs[19].id : null,
        ...(admin && body.personId ? { contactPhone: contact?.phone ?? '' } : {}),
      };
    });
  }

  let hash = '',
    phone = '';
  if (action === 'create' || action === 'contact') {
    try {
      phone = normalizePhone(body.phone);
    } catch (e) {
      throw new ApiError(400, (e as Error).message);
    }
    hash = await phoneKey(phone);
  }
  const clanId = action === 'create' || action === 'contact' ? id(body.clanId) : '';
  const personId = clanId ? id(body.personId) : '';
  const inviteId = clanId
    ? createHash('sha256')
        .update(clanId + '\0' + personId)
        .digest('hex')
    : id(body.id);
  return store.runTransaction(
    async (tx) => {
      const account = (await tx.get(accountRef)).data();
      if (!account?.complete) throw new ApiError(403, 'Hoàn tất số điện thoại trước khi tiếp tục.');
      const ref = store.doc('membershipInvites/' + inviteId);
      const old = (await tx.get(ref)).data();
      const targetClan = clanId || old?.clanId;
      if (!targetClan) throw new ApiError(404, 'Không tìm thấy lời mời.');
      const member = (await tx.get(store.doc('memberships/' + targetClan + '_' + uid))).data();
      const managing = ['create', 'contact', 'review', 'revoke'].includes(String(action));
      if (managing && member?.role !== 'admin')
        throw new ApiError(403, 'Chỉ admin gia phả được quản lý lời mời.');
      if (action === 'contact' || action === 'create') {
        const person = (await tx.get(store.doc('clans/' + clanId + '/people/' + personId))).data();
        const link = await tx.get(store.doc('clans/' + clanId + '/personLinks/' + personId));
        const claim = (await tx.get(store.doc('phoneClaims/' + hash))).data();
        if (!person || person.archived || person.lifeStatus !== 'living')
          throw new ApiError(409, 'Chỉ mời hồ sơ còn sống và đang hoạt động.');
        if (action === 'create' && link.exists)
          throw new ApiError(409, 'Hồ sơ đã liên kết tài khoản.');
        if (action === 'create' && (old?.version ?? null) !== body.version)
          throw new ApiError(409, 'Lời mời đã thay đổi. Hãy tải lại.');
        tx.set(store.doc('clans/' + clanId + '/personContacts/' + personId), {
          phone,
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (action === 'contact') return { status: 'saved' };
        const generation = claim?.uid ? claim.generation : (claim?.generation ?? 0) + 1;
        tx.set(ref, {
          clanId,
          personId,
          phone,
          phoneKey: hash,
          phoneGeneration: generation,
          targetUid: claim?.uid ?? null,
          createdBy: uid,
          creatorEpoch: epoch(member),
          creatorManagementVersion: member?.managementVersion ?? 0,
          status: 'pending',
          version: (old?.version ?? 0) + 1,
          respondedBy: null,
          createdAt: FieldValue.serverTimestamp(),
        });
        return { id: inviteId, status: 'pending' };
      }
      if (!old) throw new ApiError(404, 'Không tìm thấy lời mời.');
      if (
        !managing &&
        (account.phoneKey !== old.phoneKey ||
          account.phoneGeneration !== old.phoneGeneration ||
          (old.targetUid && old.targetUid !== uid))
      )
        throw new ApiError(403, 'Lời mời không dành cho tài khoản này.');
      const nextStatus =
        action === 'respond'
          ? body.decision === 'accept'
            ? 'responded'
            : body.decision === 'decline'
              ? 'declined'
              : ''
          : action === 'review'
            ? body.decision === 'approve'
              ? 'approved'
              : body.decision === 'reject'
                ? 'rejected'
                : ''
            : action === 'revoke'
              ? 'revoked'
              : '';
      if (!nextStatus) throw new ApiError(400, 'Thao tác lời mời không hợp lệ.');
      // Retry of the exact transition is safe; older versions from a reissued invitation are not.
      if (old.status === nextStatus && old.version === Number(body.version) + 1)
        return { status: nextStatus };
      if (old.version !== body.version || closed.has(old.status))
        throw new ApiError(409, 'Lời mời đã được xử lý hoặc thay đổi.');
      if (action !== 'revoke' && !(await validity(tx, old)))
        throw new ApiError(409, 'Lời mời cần được admin tạo lại.');
      if (action === 'respond' && old.status !== 'pending')
        throw new ApiError(409, 'Bạn đã phản hồi lời mời.');
      if (action === 'review') {
        if (old.status !== 'responded' || !old.respondedBy)
          throw new ApiError(409, 'Người nhận cần phản hồi trước.');
        if (body.decision === 'approve' && body.confirmed !== true)
          throw new ApiError(400, 'Cần xác nhận đã đối chiếu đúng người.');
        const target = old.respondedBy as string;
        const targetAccount = (await tx.get(store.doc('accounts/' + target))).data();
        if (
          targetAccount?.phoneKey !== old.phoneKey ||
          targetAccount?.phoneGeneration !== old.phoneGeneration
        )
          throw new ApiError(409, 'Số điện thoại người nhận đã thay đổi. Cần mời lại.');
        const memberRef = store.doc('memberships/' + old.clanId + '_' + target);
        const linkRef = store.doc('clans/' + old.clanId + '/personLinks/' + old.personId);
        const mLock = store.doc('clans/' + old.clanId + '/membershipMeta/lock');
        const gLock = store.doc('clans/' + old.clanId + '/genealogyMeta/lock');
        const [existingMember, existingLink, ml, gl] = await Promise.all([
          tx.get(memberRef),
          tx.get(linkRef),
          tx.get(mLock),
          tx.get(gLock),
        ]);
        if (body.decision === 'approve') {
          const identity = await adminAuth.getUser(target);
          if (identity.disabled) throw new ApiError(409, 'Tài khoản người nhận không hoạt động.');
          if (existingLink.exists && existingLink.data()!.uid !== target)
            throw new ApiError(409, 'Hồ sơ đã có tài khoản khác.');
          if (!existingMember.exists)
            tx.create(memberRef, {
              clanId: old.clanId,
              uid: target,
              displayName: targetAccount!.displayName,
              role: 'member',
              joinedAt: FieldValue.serverTimestamp(),
              invitationId: 'phone:' + inviteId + ':' + old.version,
            });
          tx.set(linkRef, {
            personId: old.personId,
            uid: target,
            approvedBy: uid,
            approvedAt: FieldValue.serverTimestamp(),
          });
          tx.set(mLock, { version: (ml.data()?.version ?? 0) + 1 });
          tx.set(gLock, {
            version: (gl.data()?.version ?? 0) + 1,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      tx.update(ref, {
        status: nextStatus,
        version: old.version + 1,
        updatedAt: FieldValue.serverTimestamp(),
        ...(action === 'respond' ? { respondedBy: uid, targetUid: uid } : { reviewedBy: uid }),
      });
      return { status: nextStatus };
    },
    { maxAttempts: 5 },
  );
}
