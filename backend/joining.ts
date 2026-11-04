import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { ApiError, store } from './service.ts';
function id(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(value))
    throw new ApiError(400, 'Mã đối tượng không hợp lệ.');
  return value;
}
function tokenHash(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new ApiError(404, 'Link đăng ký không còn hiệu lực. Hãy xin link mới từ quản trị viên.');
  return createHash('sha256').update(value).digest('hex');
}
function text(value: unknown, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw new ApiError(400, 'Tên cần 2–80 ký tự; lời giới thiệu cần 5–300 ký tự.');
  return value.trim();
}
const unavailable = () =>
  new ApiError(404, 'Link đăng ký không còn hiệu lực. Hãy xin link mới từ quản trị viên.');
function active(link: DocumentData | null | undefined) {
  return !!link && !link.revoked && link.expiresAtMs > Date.now();
}
export async function previewJoin(body: Record<string, unknown>) {
  const hash = tokenHash(body.token);
  return store.runTransaction(async (tx) => {
    const link = (await tx.get(store.doc('joinLinks/' + hash))).data();
    if (!active(link)) throw unavailable();
    const clan = (await tx.get(store.doc('clans/' + link!.clanId))).data();
    if (!clan) throw unavailable();
    // Intentionally no roster, profile, admin identity, contact or permission fields.
    return {
      linkVersion: link!.version as number,
      clanId: link!.clanId as string,
      clanName: clan.name as string,
      expiresAtMs: link!.expiresAtMs as number,
    };
  });
}
export async function mutateJoining(uid: string, body: Record<string, unknown>) {
  const action = body.action;
  const newToken = action === 'createLink' ? randomBytes(32).toString('hex') : '';
  return store.runTransaction(
    async (tx) => {
      if (action === 'submit' || action === 'submitPrivate') {
        const account = (await tx.get(store.doc('accounts/' + uid))).data();
        if (!account?.complete)
          throw new ApiError(403, 'Hoàn tất tài khoản trước khi gửi yêu cầu.');
        const hash = tokenHash(body.token);
        const privateInvite =
          action === 'submitPrivate'
            ? (await tx.get(store.doc('invitations/' + body.token))).data()
            : null;
        const link = privateInvite
          ? { ...privateInvite, version: 1, expiresAtMs: privateInvite.expiresAt.toMillis() }
          : action === 'submitPrivate'
            ? null
            : (await tx.get(store.doc('joinLinks/' + hash))).data();
        if (privateInvite) {
          const creator = (
            await tx.get(
              store.doc('memberships/' + privateInvite.clanId + '_' + privateInvite.createdBy),
            )
          ).data();
          if (privateInvite.acceptedBy || creator?.role !== 'admin') throw unavailable();
        }
        if (!active(link)) throw unavailable();
        const clanId = id(link!.clanId);
        const [clan, member, existing] = await Promise.all([
          tx.get(store.doc('clans/' + clanId)),
          tx.get(store.doc('memberships/' + clanId + '_' + uid)),
          tx.get(store.doc('joinRequests/' + clanId + '_' + uid)),
        ]);
        if (!clan.exists) throw unavailable();
        if (member.exists) return { status: 'member', clanId };
        const previous = existing.data();
        if (previous?.status === 'pending' && previous.linkHash === hash)
          return { status: 'pending', clanId, version: previous.version };
        if (previous?.status === 'rejected' && previous.linkHash === hash)
          throw new ApiError(
            409,
            'Yêu cầu đã bị từ chối. Hãy trao đổi với quản trị viên để nhận link đăng ký mới.',
          );
        const displayName =
            action === 'submitPrivate' ? account.displayName : text(body.displayName, 2, 80),
          message =
            action === 'submitPrivate'
              ? 'Yêu cầu tham gia từ lời mời riêng. Cần admin xác nhận.'
              : text(body.message, 5, 300);
        tx.set(existing.ref, {
          uid,
          clanId,
          clanName: clan.data()!.name,
          displayName,
          message,
          linkHash: hash,
          linkExpiresAtMs: link!.expiresAtMs,
          linkVersion: link!.version,
          status: 'pending',
          version: (previous?.version || 0) + 1,
          createdAt: FieldValue.serverTimestamp(),
          resolution: '',
          reviewedBy: null,
          reviewedAt: null,
          privateToken: action === 'submitPrivate' ? body.token : null,
        });
        return { status: 'pending', clanId };
      }
      const clanId = id(body.clanId);
      const settingsRef = store.doc('clans/' + clanId + '/joinSettings/current');
      const actor = (await tx.get(store.doc('memberships/' + clanId + '_' + uid))).data();
      if (action === 'withdraw') {
        const ref = store.doc('joinRequests/' + clanId + '_' + uid);
        const request = (await tx.get(ref)).data();
        if (
          !request ||
          request.uid !== uid ||
          request.status !== 'pending' ||
          request.version !== body.version
        )
          throw new ApiError(409, 'Yêu cầu đã thay đổi. Vui lòng tải lại.');
        tx.update(ref, { status: 'cancelled', version: request.version + 1 });
        return { status: 'cancelled' };
      }
      if (actor?.role !== 'admin')
        throw new ApiError(403, 'Chỉ quản trị viên dòng họ được thực hiện thao tác này.');
      if (action === 'createLink' || action === 'revokeLink') {
        const old = (await tx.get(settingsRef)).data();
        if ((old ? old.version : null) !== body.version)
          throw new ApiError(409, 'Link đã thay đổi. Vui lòng tải bản mới.');
        if (old?.token) {
          const oldRef = store.doc('joinLinks/' + tokenHash(old.token));
          await tx.get(oldRef);
          tx.update(oldRef, { revoked: true });
        }
        if (action === 'revokeLink') {
          if (!old) throw new ApiError(404, 'Chưa có link đăng ký.');
          tx.update(settingsRef, { revoked: true, version: old.version + 1 });
          return { status: 'revoked' };
        }
        const expiresAtMs = Date.now() + 30 * 86400000;
        const fields = {
          version: (old?.version || 0) + 1,
          clanId,
          expiresAtMs,
          revoked: false,
          createdBy: uid,
          createdAt: FieldValue.serverTimestamp(),
        };
        tx.create(store.doc('joinLinks/' + tokenHash(newToken)), fields);
        // Raw token is retained only in the admin-readable settings so it can be shared again.
        tx.set(settingsRef, { ...fields, token: newToken, version: (old?.version || 0) + 1 });
        return { status: 'active' };
      }
      if (action === 'review') {
        const targetUid = id(body.uid);
        const ref = store.doc('joinRequests/' + clanId + '_' + targetUid);
        const request = (await tx.get(ref)).data();
        if (
          !request ||
          request.clanId !== clanId ||
          request.status !== 'pending' ||
          request.version !== body.version
        )
          throw new ApiError(409, 'Yêu cầu đã được xử lý hoặc thay đổi. Vui lòng tải lại.');
        if (body.decision !== 'approve' && body.decision !== 'reject')
          throw new ApiError(400, 'Lựa chọn không hợp lệ.');
        const memberRef = store.doc('memberships/' + clanId + '_' + targetUid);
        const [member, link, targetAccount, lock] = await Promise.all([
          tx.get(memberRef),
          tx.get(
            store.doc(
              request.privateToken
                ? 'invitations/' + request.privateToken
                : 'joinLinks/' + request.linkHash,
            ),
          ),
          tx.get(store.doc('accounts/' + targetUid)),
          tx.get(store.doc('clans/' + clanId + '/membershipMeta/lock')),
        ]);
        const privateCreator =
          request.privateToken && link.exists
            ? (
                await tx.get(store.doc('memberships/' + clanId + '_' + link.data()!.createdBy))
              ).data()
            : null;
        if (body.decision === 'approve') {
          const linked = link.data();
          const validLink = request.privateToken
            ? linked &&
              !linked.revoked &&
              !linked.acceptedBy &&
              linked.expiresAt.toMillis() > Date.now() &&
              privateCreator?.role === 'admin'
            : active(linked);
          if (!validLink || linked!.clanId !== clanId)
            throw new ApiError(
              409,
              'Link của yêu cầu đã hết hạn hoặc bị thu hồi. Người gửi cần đăng ký lại bằng link mới.',
            );
          if (!targetAccount.data()?.complete)
            throw new ApiError(409, 'Người nhận chưa hoàn tất tài khoản.');
          if (!member.exists)
            tx.create(memberRef, {
              clanId,
              uid: targetUid,
              displayName: request.displayName,
              role: 'member',
              joinedAt: FieldValue.serverTimestamp(),
              invitationId: 'join:' + request.linkHash + ':' + request.version,
            });
          if (request.privateToken) tx.update(link.ref, { acceptedBy: targetUid });
          tx.set(lock.ref, { version: (lock.data()?.version ?? 0) + 1 });
        }
        const status = body.decision === 'approve' ? 'approved' : 'rejected';
        tx.update(ref, {
          status,
          version: request.version + 1,
          reviewedBy: uid,
          reviewedAt: FieldValue.serverTimestamp(),
        });
        return { status };
      }
      throw new ApiError(400, 'Thao tác đăng ký không được hỗ trợ.');
    },
    { maxAttempts: 5 },
  );
}
