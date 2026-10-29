import { type DocumentData } from 'firebase-admin/firestore';
import { ApiError, store } from './service.ts';

function id(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(value))
    throw new ApiError(400, 'Mã dòng họ hoặc thành viên không hợp lệ.');
  return value;
}
function epoch(member: DocumentData) {
  return [
    member.joinedAt?.seconds ?? 0,
    member.joinedAt?.nanoseconds ?? 0,
    member.invitationId ?? '',
  ].join(':');
}
export async function mutateMemberships(uid: string, body: Record<string, unknown>) {
  const clanId = id(body.clanId),
    targetUid = id(body.uid);
  const action = body.action;
  if (typeof action !== 'string' || !['changeRole', 'remove', 'leave'].includes(action))
    throw new ApiError(400, 'Thao tác thành viên không hợp lệ.');
  if (action === 'leave' && targetUid !== uid)
    throw new ApiError(403, 'Bạn chỉ có thể tự rời gia phả của mình.');
  if (
    action === 'changeRole' &&
    (typeof body.role !== 'string' || !['admin', 'editor', 'member'].includes(body.role))
  )
    throw new ApiError(400, 'Vai trò không hợp lệ.');
  return store.runTransaction(
    async (tx) => {
      const actorRef = store.doc('memberships/' + clanId + '_' + uid);
      const targetRef = store.doc('memberships/' + clanId + '_' + targetUid);
      const lockRef = store.doc('clans/' + clanId + '/membershipMeta/lock');
      const [actorSnap, targetSnap, lock, clan] = await Promise.all([
        tx.get(actorRef),
        tx.get(targetRef),
        tx.get(lockRef),
        tx.get(store.doc('clans/' + clanId)),
      ]);
      const actor = actorSnap.data(),
        target = targetSnap.data();
      if (!clan.exists || !actor || actor.clanId !== clanId || actor.uid !== uid)
        throw new ApiError(403, 'Bạn không còn quyền truy cập dòng họ này.');
      if (action !== 'leave' && actor.role !== 'admin')
        throw new ApiError(403, 'Chỉ quản trị viên được thay đổi vai trò hoặc gỡ người khác.');
      if (!target || target.clanId !== clanId || target.uid !== targetUid)
        throw new ApiError(409, 'Thành viên đã thay đổi hoặc rời gia phả. Vui lòng tải lại.');
      if (
        body.expectedRole !== target.role ||
        body.version !== (target.managementVersion ?? 0) ||
        body.epoch !== epoch(target)
      )
        throw new ApiError(
          409,
          'Thông tin thành viên đã thay đổi. Vui lòng tải lại trước khi thao tác.',
        );

      // Every admin promotion, demotion and membership removal shares this lock, including old clans
      // without a lock yet. The count is read from current memberships, never a client counter.
      const losingAdmin =
        target.role === 'admin' && (action !== 'changeRole' || body.role !== 'admin');
      if (losingAdmin) {
        const admins = await tx.get(
          store
            .collection('memberships')
            .where('clanId', '==', clanId)
            .where('role', '==', 'admin'),
        );
        if (admins.size <= 1)
          throw new ApiError(
            409,
            'Gia phả cần ít nhất một quản trị viên. Hãy cấp quyền quản trị cho người khác trước.',
          );
      }
      if (action === 'changeRole' && body.role === target.role) return { status: 'unchanged' };
      if (action === 'changeRole')
        tx.update(targetRef, {
          role: body.role,
          managementVersion: (target.managementVersion ?? 0) + 1,
        });
      else tx.delete(targetRef);
      tx.set(lockRef, { version: (lock.data()?.version ?? 0) + 1 });
      return { status: action === 'changeRole' ? 'updated' : 'removed' };
    },
    { maxAttempts: 5 },
  );
}
